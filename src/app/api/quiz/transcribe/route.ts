import { endpoint } from '@/lib/server/http';
import { transcribeAnswer } from '@/lib/server/quiz';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = endpoint(transcribeAnswer,'transcribe',15);
