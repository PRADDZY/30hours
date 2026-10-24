export type Language = "en" | "hi" | "hinglish";
export type TravelMode = "DRIVE" | "TRANSIT" | "TWO_WHEELER" | "WALK" | "BICYCLE";
export interface Place { id: string; label: string; lat: number; lng: number }
export interface Trip {
  id: string; origin: Place; destination: Place; mode: TravelMode;
  durationSeconds: number; distanceMeters: number; arrivalTime: number;
  polyline?: string; summary?: string; warnings?: string[];
  transitArrivalTime?: number; demo?: boolean;
}
export interface SourceMaterial { id: string; title: string; text: string; url?: string; kind: "notes" | "pdf" | "url" | "discovery"; retrievedAt?: string }
export interface Citation { title: string; url: string; retrievedAt?: string }
export interface LessonChunk {
  id: string; chapter: string; title: string; script: string;
  targetSeconds: number; priority: "essential" | "optional" | "recap";
  concepts: string[]; prerequisites: string[];
}
export interface QuizQuestion { id: string; question: string; expectedAnswer: string; concepts: string[] }
export interface EpisodePlan {
  id: string; version: number; title: string; description: string; language: Language;
  targetSeconds: number; chunks: LessonChunk[]; quiz: QuizQuestion[];
  sources: Citation[]; createdAt: string; demo?: boolean;
}
export interface AudioChunk {
  id: string; planVersion: number; durationSeconds: number; spokenTranscript: string;
  mimeType: string; audioBase64?: string; url?: string; blob?: Blob;
}
export interface QuizResult { questionId: string; answer: string; score: number; feedback: string; skipped?: boolean }
export interface SavedEpisode {
  id: string; plan: EpisodePlan; trip: Trip; audio: AudioChunk[];
  playedChunkIds: string[]; position: number; savedAt: string;
  offlineReady: boolean; results: QuizResult[];
}
export interface Preferences { interests: string[]; language: Language; onboarded: boolean }
export interface PlanRequest { trip: Trip; source?: SourceMaterial; interests: string[]; language: Language }
export interface ReplanRequest { plan: EpisodePlan; remainingSeconds: number; playedChunkIds: string[]; coveredConcepts: string[]; preservedDurationSeconds?: number }
export interface GradeRequest { question: QuizQuestion; answer: string; language: Language }
export interface AppCapabilities { openai: boolean; maps: boolean; browserMaps: boolean; voice?: boolean }
