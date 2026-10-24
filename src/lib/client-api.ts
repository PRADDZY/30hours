import type { AudioChunk } from "./types";

export async function requestJson<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, body === undefined ? { signal } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `That request couldn't finish (${response.status}). Please try again.`);
  return data as T;
}

export function audioBlob(audio: AudioChunk): Blob | undefined {
  if (audio.blob?.size) return audio.blob;
  if (!audio.audioBase64) return undefined;
  const raw = atob(audio.audioBase64);
  return new Blob([Uint8Array.from(raw, character => character.charCodeAt(0))], { type: audio.mimeType || "audio/mpeg" });
}

export async function decodedDuration(blob: Blob, fallback: number): Promise<number> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<number>(resolve => {
      const audio = new Audio();
      const timer = setTimeout(() => done(fallback), 5000);
      const done = (value: number) => { clearTimeout(timer); audio.removeAttribute("src"); audio.load(); resolve(value); };
      audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallback);
      audio.onerror = () => done(fallback);
      audio.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "Something interrupted your listen. Please try again.";
}
