import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AudioChunk, Preferences, SavedEpisode } from "./types";

interface LibraryDB extends DBSchema {
  episodes: { key: string; value: SavedEpisode };
  pending: { key: string; value: SavedEpisode };
  preferences: { key: string; value: Preferences };
}
let database: Promise<IDBPDatabase<LibraryDB>> | undefined;
function db() {
  database ??= openDB<LibraryDB>("30hours-library", 1, {
    upgrade(database) {
      database.createObjectStore("episodes", { keyPath: "id" });
      database.createObjectStore("pending", { keyPath: "id" });
      database.createObjectStore("preferences");
    },
  });
  return database;
}

function storedAudio(audio: AudioChunk, planVersion: number): AudioChunk {
  if (audio.planVersion !== planVersion) throw new Error("Stale audio response rejected: its plan version is no longer current.");
  let blob = audio.blob;
  if (!blob && audio.audioBase64) {
    const bytes = Uint8Array.from(atob(audio.audioBase64), (character) => character.charCodeAt(0));
    blob = new Blob([bytes], { type: audio.mimeType });
  }
  return {
    id: audio.id, planVersion: audio.planVersion, durationSeconds: audio.durationSeconds,
    spokenTranscript: audio.spokenTranscript, mimeType: audio.mimeType,
    ...(blob ? { blob } : {}),
    ...(audio.url && !audio.url.startsWith("blob:") ? { url: audio.url } : {}),
  };
}
function deriveReadiness(episode: SavedEpisode): SavedEpisode {
  const ready = new Set(episode.audio.filter((audio) => audio.planVersion === episode.plan.version && audio.blob instanceof Blob && audio.blob.size > 0 && Number.isFinite(audio.durationSeconds) && audio.durationSeconds > 0).map((audio) => audio.id));
  return { ...episode, offlineReady: episode.plan.chunks.length > 0 && episode.plan.chunks.every((chunk) => ready.has(chunk.id)) };
}

/**
 * A new version is staged atomically. A complete existing version stays active
 * until every chunk in the replacement manifest has durable audio.
 * Quota/transaction failures propagate to the caller.
 */
export async function saveEpisode(episode: SavedEpisode): Promise<SavedEpisode> {
  const converted = episode.audio.map((audio) => storedAudio(audio, episode.plan.version));
  const database = await db();
  const transaction = database.transaction(["episodes", "pending"], "readwrite");
  try {
    const activeStore = transaction.objectStore("episodes");
    const pendingStore = transaction.objectStore("pending");
    const active = await activeStore.get(episode.id);
    const pending = await pendingStore.get(episode.id);
    if ((active && episode.plan.version < active.plan.version) || (pending && episode.plan.version < pending.plan.version && episode.plan.version !== active?.plan.version)) {
      transaction.abort();
      // Observe the rejection produced by our explicit abort.
      await transaction.done.catch(() => undefined);
      throw new Error("Stale episode version rejected.");
    }
    const previous = pending?.plan.version === episode.plan.version ? pending : active?.plan.version === episode.plan.version ? active : undefined;
    const merged = new Map((previous?.audio || []).map((audio) => [audio.id, audio]));
    for (const audio of converted) {
      const saved = merged.get(audio.id);
      merged.set(audio.id, { ...audio, ...(audio.blob ? {} : saved?.blob ? { blob: saved.blob } : {}) });
    }
    const next = deriveReadiness({
      id: episode.id, plan: episode.plan, trip: episode.trip,
      audio: [...merged.values()], playedChunkIds: episode.playedChunkIds,
      position: episode.position, savedAt: episode.savedAt,
      results: episode.results, offlineReady: false,
    });
    if (active && deriveReadiness(active).offlineReady && active.plan.version !== next.plan.version && !next.offlineReady) {
      await pendingStore.put(next);
      await transaction.done;
      return deriveReadiness(active);
    }
    await activeStore.put(next);
    if (!pending || pending.plan.version <= next.plan.version) await pendingStore.delete(episode.id);
    await transaction.done;
    return next;
  } catch (error) {
    await transaction.done.catch(() => undefined);
    throw error;
  }
}
export async function getEpisodes(): Promise<SavedEpisode[]> {
  const database = await db();
  return (await database.getAll("episodes")).map(deriveReadiness).sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}
export async function getEpisode(id: string): Promise<SavedEpisode | undefined> {
  const episode = await (await db()).get("episodes", id);
  return episode ? deriveReadiness(episode) : undefined;
}
export async function deleteEpisode(id: string): Promise<void> {
  const database = await db();
  const transaction = database.transaction(["episodes", "pending"], "readwrite");
  await Promise.all([transaction.objectStore("episodes").delete(id), transaction.objectStore("pending").delete(id)]);
  await transaction.done;
}
export async function savePreferences(preferences: Preferences): Promise<void> {
  await (await db()).put("preferences", { interests: preferences.interests, language: preferences.language, onboarded: preferences.onboarded }, "user");
}
export async function getPreferences(): Promise<Preferences | undefined> {
  return (await db()).get("preferences", "user");
}
