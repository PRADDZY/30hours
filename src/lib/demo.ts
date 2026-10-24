import manifest from "../../public/demo/manifest.json";
import type { AudioChunk, EpisodePlan, Language, LessonChunk, SavedEpisode, Trip } from "./types";

export const demoTrip = manifest.trip as Trip;
export const demoPlans = manifest.plans as Record<Language, EpisodePlan>;
export const demoExtensions = manifest.extensions as Record<Language, LessonChunk[]>;
export const demoCompactRecaps = manifest.compactRecaps as Record<Language, LessonChunk>;
export function demoAudio(language: Language): AudioChunk[] {
  return structuredClone(manifest.audio[language]) as AudioChunk[];
}
export function createDemoEpisode(language: Language = "en"): SavedEpisode {
  return {
    id: demoPlans[language].id, plan: structuredClone(demoPlans[language]),
    trip: { ...structuredClone(demoTrip), arrivalTime: Date.now() + demoTrip.durationSeconds * 1000 },
    audio: demoAudio(language), playedChunkIds: [], position: 0,
    savedAt: new Date().toISOString(), offlineReady: false, results: [],
  };
}
