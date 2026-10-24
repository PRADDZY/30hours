import { endpoint,readJson,requireOpenAI } from '@/lib/server/http';
import { gradeRequestSchema } from '@/lib/server/schemas';
import { gradeAnswer } from '@/lib/server/quiz';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = endpoint(async request => {const input=await readJson(request,gradeRequestSchema,12_000);requireOpenAI();return gradeAnswer(input,request.signal);},'grade',15);
