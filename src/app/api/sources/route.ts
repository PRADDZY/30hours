import { endpoint,readJson } from '@/lib/server/http';
import { sourceRequestSchema } from '@/lib/server/schemas';
import { extractSource } from '@/lib/server/sources';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = endpoint(async request => {const input=await readJson(request,sourceRequestSchema,6000);return {source:await extractSource(input.url,request.signal)};},'sources',10);
