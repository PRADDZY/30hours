import { endpoint } from '@/lib/server/http';
import { audioConfig } from '@/lib/server/openai';
export const runtime = 'nodejs';
export const GET = endpoint(async () => ({openai:!!process.env.OPENAI_API_KEY?.trim(),maps:!!process.env.GOOGLE_MAPS_API_KEY?.trim(),browserMaps:!!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim(),voice:!!audioConfig().apiKey}),'config',120);
