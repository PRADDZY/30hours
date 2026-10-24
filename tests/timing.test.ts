import { describe, expect, it } from "vitest";
import { fitTiming, quizBudget, quizQuestionCount, remainingBudget, scheduleUnplayed, shouldReplan } from "../src/lib/timing";
import type { AudioChunk, EpisodePlan } from "../src/lib/types";

const plan: EpisodePlan = { id: "lesson", version: 1, title: "Attention", description: "", language: "en", targetSeconds: 240, sources: [], quiz: [], createdAt: "2026-10-24", chunks: [
  { id: "foundation", chapter: "1", title: "Foundation", script: "", targetSeconds: 30, priority: "essential", concepts: ["focus"], prerequisites: [] },
  { id: "example", chapter: "2", title: "Example", script: "", targetSeconds: 50, priority: "optional", concepts: ["example"], prerequisites: ["focus"] },
  { id: "practice", chapter: "3", title: "Practice", script: "", targetSeconds: 30, priority: "essential", concepts: ["practice"], prerequisites: ["focus"] },
  { id: "recap", chapter: "4", title: "Recap", script: "", targetSeconds: 20, priority: "recap", concepts: [], prerequisites: ["practice"] },
] };
const audio = (id: string, durationSeconds: number): AudioChunk => ({ id, durationSeconds, planVersion: 1, spokenTranscript: "", mimeType: "audio/mpeg" });

describe("honest adaptive timing", () => {
  it("reserves short and long quiz budgets and uses wall time", () => {
    expect([quizBudget(900), quizBudget(901)]).toEqual([60, 90]);
    expect([quizQuestionCount(900), quizQuestionCount(901)]).toEqual([2, 3]);
    expect(remainingBudget(150_000, 100_000)).toBe(50);
    expect(remainingBudget(50_000, 100_000)).toBe(0);
  });
  it("replans at either thirty seconds or five percent", () => {
    expect(shouldReplan(300, 284)).toBe(true);
    expect(shouldReplan(1200, 1169)).toBe(true);
    expect(shouldReplan(300, 286)).toBe(false);
  });
  it("drops optional audio first, preserving prerequisite order and recap", () => {
    const result = scheduleUnplayed(plan, { remainingSeconds: 145, playedChunkIds: [], coveredConcepts: [], audio: [audio("foundation", 35), audio("example", 70), audio("practice", 30), audio("recap", 20)] });
    expect(result.chunks.map(c => c.id)).toEqual(["foundation", "practice", "recap"]);
    expect(result.estimatedSeconds).toBe(85);
    expect(result.droppedIds).toContain("example");
  });
  it("does not replay covered concepts and refuses unsupported prerequisites", () => {
    const result = scheduleUnplayed(plan, { remainingSeconds: 300, playedChunkIds: ["foundation"], coveredConcepts: ["focus"] });
    expect(result.chunks.map(c => c.id)).toEqual(["example", "practice", "recap"]);
    const broken = { ...plan, chunks: plan.chunks.filter(c => c.id !== "foundation") };
    expect(scheduleUnplayed(broken, { remainingSeconds: 300, playedChunkIds: [], coveredConcepts: [] }).chunks).toEqual([]);
  });
  it("fits measured speech with modest speed and trims optional audio", () => {
    const result = fitTiming([audio("a", 70), audio("detail", 30), audio("recap", 30)], 100, ["detail"]);
    expect(result.droppedIds).toEqual(["detail"]);
    expect(result.withinTolerance).toBe(true);
    expect(result.playbackRate).toBeGreaterThanOrEqual(.95);
    expect(result.playbackRate).toBeLessThanOrEqual(1.08);
  });
  it("retains an optional prerequisite when an essential concept needs it", () => {
    const dependent = structuredClone(plan);
    dependent.chunks[2].prerequisites = ["example"];
    const result = scheduleUnplayed(dependent, { remainingSeconds: 100, playedChunkIds: [], coveredConcepts: [] });
    expect(result.chunks.map(c => c.id)).toEqual(["foundation", "example", "practice", "recap"]);
    expect(result.droppableIds).not.toContain("example");
  });
  it("reports unavoidable drift without padding or extreme speed", () => {
    const result = fitTiming([audio("essential", 100)], 30);
    expect(result.withinTolerance).toBe(false);
    expect(result.driftSeconds).toBeGreaterThan(60);
    expect(result.playbackRate).toBe(1.08);
  });
});
