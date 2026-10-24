import type { AudioChunk, EpisodePlan, LessonChunk } from "./types";

export function quizBudget(totalSeconds: number): number { return totalSeconds <= 900 ? 60 : 90; }
export function quizQuestionCount(totalSeconds: number): number { return totalSeconds <= 900 ? 2 : 3; }
export function remainingBudget(arrivalTime: number, now = Date.now()): number { return Math.max(0, (arrivalTime - now) / 1000); }
export function shouldReplan(oldRemaining: number, newRemaining: number): boolean {
  const change = Math.abs(newRemaining - oldRemaining);
  return change >= 30 || (change > 0 && change / Math.max(1, oldRemaining) >= .05);
}

export interface ScheduleOptions {
  remainingSeconds: number;
  playedChunkIds: string[];
  coveredConcepts: string[];
  audio?: AudioChunk[];
}
export interface ScheduleResult {
  chunks: LessonChunk[];
  droppedIds: string[];
  droppableIds: string[];
  estimatedSeconds: number;
  quizSeconds: number;
}

/** Keep the smallest coherent lesson before allocating time to optional detail. */
export function scheduleUnplayed(plan: EpisodePlan, options: ScheduleOptions): ScheduleResult {
  const played = new Set(options.playedChunkIds);
  const known = new Set(options.coveredConcepts);
  for (const chunk of plan.chunks) if (played.has(chunk.id)) chunk.concepts.forEach((concept) => known.add(concept));
  const candidates = plan.chunks.filter((chunk) => !played.has(chunk.id) && (chunk.priority === "recap" || !chunk.concepts.length || !chunk.concepts.every((concept) => known.has(concept))));
  const measured = new Map((options.audio || []).filter((chunk) => chunk.planVersion === plan.version && chunk.durationSeconds > 0).map((chunk) => [chunk.id, chunk.durationSeconds]));
  const duration = (chunk: LessonChunk) => measured.get(chunk.id) ?? chunk.targetSeconds;
  const quizSeconds = plan.quiz.length ? quizBudget(plan.targetSeconds) : 0;
  const budget = Math.max(0, options.remainingSeconds - quizSeconds);

  function coherent(seeds: LessonChunk[]): LessonChunk[] {
    const result: LessonChunk[] = [];
    const resolved = new Set(known);
    const added = new Set<string>();
    const visiting = new Set<string>();
    function add(chunk: LessonChunk): boolean {
      if (added.has(chunk.id)) return true;
      if (visiting.has(chunk.id)) return false;
      visiting.add(chunk.id);
      for (const concept of chunk.prerequisites) {
        if (resolved.has(concept)) continue;
        const provider = candidates.find((candidate) => candidate.id !== chunk.id && candidate.concepts.includes(concept));
        if (!provider || !add(provider)) { visiting.delete(chunk.id); return false; }
      }
      visiting.delete(chunk.id);
      added.add(chunk.id);
      result.push(chunk);
      chunk.concepts.forEach((concept) => resolved.add(concept));
      return true;
    }
    seeds.forEach(add);
    return result;
  }
  const required = candidates.filter((chunk) => chunk.priority !== "optional");
  let chunks = coherent(required);
  const protectedIds = new Set(chunks.map((chunk) => chunk.id));
  for (const optional of candidates.filter((chunk) => chunk.priority === "optional")) {
    const selected = new Set([...chunks.map((chunk) => chunk.id), optional.id]);
    const trial = coherent(candidates.filter((chunk) => selected.has(chunk.id)));
    if (trial.reduce((sum, chunk) => sum + duration(chunk), 0) <= budget) chunks = trial;
  }
  const selected = new Set(chunks.map((chunk) => chunk.id));
  const droppableIds = chunks.filter((chunk) => !protectedIds.has(chunk.id) && !chunks.some((dependent) => dependent.id !== chunk.id && dependent.prerequisites.some((concept) => chunk.concepts.includes(concept)))).map((chunk) => chunk.id);
  return { chunks, droppedIds: candidates.filter((chunk) => !selected.has(chunk.id)).map((chunk) => chunk.id), droppableIds, estimatedSeconds: chunks.reduce((sum, chunk) => sum + duration(chunk), 0), quizSeconds };
}

export interface TimingFit {
  audio: AudioChunk[];
  playbackRate: number;
  actualSeconds: number;
  targetSeconds: number;
  driftSeconds: number;
  withinTolerance: boolean;
  droppedIds: string[];
}

/** Measured speech only: no silent padding and no promise to fit an impossible ETA. */
export function fitTiming(audio: AudioChunk[], targetSeconds: number, optionalChunkIds: string[] = []): TimingFit {
  if (!Number.isFinite(targetSeconds) || targetSeconds < 0 || audio.some((chunk) => !Number.isFinite(chunk.durationSeconds) || chunk.durationSeconds <= 0)) throw new RangeError("Timing requires finite positive measured audio durations and a nonnegative target.");
  const optional = new Set(optionalChunkIds);
  const droppedIds: string[] = [];
  let selected = [...audio];
  const evaluate = (chunks: AudioChunk[]) => {
    const measured = chunks.reduce((sum, chunk) => sum + chunk.durationSeconds, 0);
    const playbackRate = measured === 0 ? 1 : Math.max(.95, Math.min(1.08, targetSeconds > 0 ? measured / targetSeconds : 1.08));
    const actualSeconds = measured / playbackRate;
    return { playbackRate, actualSeconds, driftSeconds: actualSeconds - targetSeconds };
  };
  while (selected.length) {
    const current = evaluate(selected);
    if (Math.abs(current.driftSeconds) <= targetSeconds * .05) break;
    let best: AudioChunk | undefined;
    let error = Math.abs(current.driftSeconds);
    for (const candidate of selected) {
      if (!optional.has(candidate.id)) continue;
      const nextError = Math.abs(evaluate(selected.filter((chunk) => chunk.id !== candidate.id)).driftSeconds);
      if (nextError < error) { error = nextError; best = candidate; }
    }
    if (!best) break;
    droppedIds.push(best.id);
    selected = selected.filter((chunk) => chunk.id !== best.id);
  }
  const fit = evaluate(selected);
  return { audio: selected, ...fit, targetSeconds, withinTolerance: Math.abs(fit.driftSeconds) <= targetSeconds * .05, droppedIds };
}
