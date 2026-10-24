import { endpoint,readJson } from '@/lib/server/http';
import { audioRequestSchema } from '@/lib/server/schemas';
import { generateAudio } from '@/lib/server/audio';
export const runtime = 'nodejs';
export const maxDuration = 120;
export const POST = endpoint(async request => generateAudio(await readJson(request,audioRequestSchema,12_000),request.signal),'audio',30);
