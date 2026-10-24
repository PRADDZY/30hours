import { endpoint } from '@/lib/server/http';
import { searchPlaces } from '@/lib/server/maps';
export const runtime = 'nodejs';
export const GET = endpoint(async request => ({places:await searchPlaces(new URL(request.url).searchParams.get('q') || '',request.signal)}),'places',30);
