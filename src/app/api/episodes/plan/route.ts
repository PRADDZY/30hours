import { endpoint,readJson,requireOpenAI } from '@/lib/server/http';
import { planRequestSchema } from '@/lib/server/schemas';
import { createPlan } from '@/lib/server/planner';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const POST = endpoint(async request => {const input=await readJson(request,planRequestSchema);requireOpenAI();return createPlan(input,request.signal);},'plan',3);
