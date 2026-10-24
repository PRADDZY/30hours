import { endpoint,readJson,requireOpenAI } from '@/lib/server/http';
import { replanRequestSchema } from '@/lib/server/schemas';
import { replanEpisode } from '@/lib/server/planner';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const POST = endpoint(async request => {const input=await readJson(request,replanRequestSchema,400_000);requireOpenAI();return replanEpisode(input,request.signal);},'replan',6);
