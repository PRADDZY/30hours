import { endpoint,readJson } from '@/lib/server/http';
import { routeRequestSchema } from '@/lib/server/schemas';
import { computeTrips } from '@/lib/server/maps';
export const runtime = 'nodejs';
export const POST = endpoint(async request => {const input=await readJson(request,routeRequestSchema,10_000);return {trips:await computeTrips(input.origin,input.destination,input.mode,request.signal)};},'route',15);
