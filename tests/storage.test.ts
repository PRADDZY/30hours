import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteEpisode, getEpisode, getEpisodes, getPreferences, saveEpisode, savePreferences } from "../src/lib/storage";
import type { SavedEpisode } from "../src/lib/types";

function episode(version = 1): SavedEpisode {
  return { id: "lesson", plan: { id: "lesson", version, title: "Attention", description: "", language: "en", targetSeconds: 240, sources: [], quiz: [], createdAt: "2026-10-24", chunks: [{ id: "a", chapter: "1", title: "A", script: "Hello", targetSeconds: 30, priority: "essential", concepts: [], prerequisites: [] }] }, trip: { id: "trip", origin: { id: "a", label: "A", lat: 0, lng: 0 }, destination: { id: "b", label: "B", lat: 0, lng: 0 }, mode: "WALK", durationSeconds: 240, distanceMeters: 500, arrivalTime: 100 }, audio: [{ id: "a", planVersion: version, mimeType: "audio/mpeg", audioBase64: "SGVsbG8=", durationSeconds: 30, spokenTranscript: "Hello" }], playedChunkIds: [], position: 0, savedAt: "2026-10-24", offlineReady: false, results: [] };
}
beforeEach(async () => { for (const saved of await getEpisodes()) await deleteEpisode(saved.id); });
describe("transactional offline library", () => {
  it("stores real Blobs and derives readiness rather than trusting flags or URLs", async () => {
    await saveEpisode(episode());
    const saved = await getEpisode("lesson");
    expect(saved?.offlineReady).toBe(true);
    expect(await saved?.audio[0].blob?.text()).toBe("Hello");
    expect(saved?.audio[0].audioBase64).toBeUndefined();
    const remote = episode(); remote.id = "remote"; remote.audio = [{ ...remote.audio[0], audioBase64: undefined, url: "/demo/a.mp3" }]; remote.offlineReady = true;
    expect((await saveEpisode(remote)).offlineReady).toBe(false);
  });
  it("retains a complete old manifest until the replacement is complete", async () => {
    await saveEpisode(episode());
    const next = episode(2); next.audio = [];
    await saveEpisode(next);
    expect((await getEpisode("lesson"))?.plan.version).toBe(1);
    await saveEpisode(episode(2));
    expect((await getEpisode("lesson"))?.plan.version).toBe(2);
  });
  it("rejects stale audio without replacing valid stored audio", async () => {
    await saveEpisode(episode(2));
    const stale = episode(2); stale.audio[0].planVersion = 1;
    await expect(saveEpisode(stale)).rejects.toThrow(/stale/i);
    expect((await getEpisode("lesson"))?.offlineReady).toBe(true);
  });
  it("saves preferences and deletes the library record", async () => {
    const prefs = { interests: ["Psychology"], language: "hinglish" as const, onboarded: true };
    await savePreferences(prefs);
    expect(await getPreferences()).toEqual(prefs);
    await saveEpisode(episode()); await deleteEpisode("lesson");
    expect(await getEpisodes()).toEqual([]);
  });
  it("merges completed audio chunks from incremental saves", async () => {
    const first = episode();
    first.plan.chunks.push({ ...first.plan.chunks[0], id: "b", priority: "recap" });
    expect((await saveEpisode(first)).offlineReady).toBe(false);
    const second = structuredClone(first); second.audio = [{ ...first.audio[0], id: "b" }];
    expect((await saveEpisode(second)).offlineReady).toBe(true);
    expect((await getEpisode(first.id))?.audio).toHaveLength(2);
  });
});
