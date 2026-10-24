import { z } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const windows = new Map<string, { start: number; count: number }>();
let active = 0;
let globalWindow = { start: Date.now(), count: 0 };

/** Bounded, process-local guest protection. Production deployments should add a shared gateway limiter. */
export function limitRequest(request: Request, category = 'general', limit = 30) {
  const now = Date.now();
  if (now - globalWindow.start > 60_000) globalWindow = { start: now, count: 0 };
  if (++globalWindow.count > 300) throw new ApiError(429, 'The service is busy. Please try again in a minute.');
  const address = (request.headers.get('x-forwarded-for')?.split(',')[0] || 'guest').trim().slice(0, 100);
  const key = `${category}:${address}`;
  let entry = windows.get(key);
  if (!entry || now - entry.start > 60_000) {
    if (windows.size >= 1000) {
      for (const [oldKey, value] of windows) if (now - value.start > 60_000) windows.delete(oldKey);
      if (windows.size >= 1000) throw new ApiError(429, 'The service is busy. Please try again shortly.');
    }
    entry = { start: now, count: 0 };
    windows.set(key, entry);
  }
  if (++entry.count > limit) throw new ApiError(429, 'Too many requests. Please try again in a minute.');
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 400_000): Promise<T> {
  const size = Number(request.headers.get('content-length') || 0);
  if (size > maxBytes) throw new ApiError(413, 'This request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A JSON request body is required.');
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, 'This request is too large.');
      }
      parts.push(value);
    }
    let data: unknown;
    try { data = JSON.parse(Buffer.concat(parts).toString('utf8')); }
    catch { throw new ApiError(400, 'Please send valid JSON.'); }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new ApiError(400, `Invalid request: ${parsed.error.issues[0]?.path.join('.') || 'body'}.`);
    return parsed.data;
  } finally { reader.releaseLock(); }
}

export function endpoint(handler: (request: Request) => Promise<unknown>, category = 'general', limit = 30) {
  return async (request: Request) => {
    let acquired = false;
    try {
      limitRequest(request, category, limit);
      if (active >= 12) throw new ApiError(429, 'The service is busy. Please try again shortly.');
      active++; acquired = true;
      const result = await handler(request);
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store', ...(error.status === 429 ? { 'Retry-After': '60' } : {}) } });
      if (error instanceof Error && error.name === 'AbortError') return Response.json({ error: 'The request was cancelled or timed out. Please try again.' }, { status: 408 });
      // Provider errors can contain credentials, source contents or request headers: never echo them.
      return Response.json({ error: 'The service could not complete this request. Please try again.' }, { status: 502 });
    } finally { if (acquired) active--; }
  };
}

export function requireOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new ApiError(503, 'OpenAI is not configured. Add OPENAI_API_KEY on the server to enable this feature.');
  return key;
}

export function requireMaps() {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new ApiError(503, 'Google Maps is not configured. Add GOOGLE_MAPS_API_KEY on the server to plan live journeys.');
  return key;
}

export function combinedSignal(signal?: AbortSignal, timeout = 120_000) {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
}
