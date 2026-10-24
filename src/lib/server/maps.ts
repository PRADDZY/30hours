import { randomUUID } from 'node:crypto';
import type { Place, Trip, TravelMode } from '../types';
import { ApiError, combinedSignal, requireMaps } from './http';

async function google(path: string, body: unknown, mask: string, signal?: AbortSignal) {
  const response = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json','X-Goog-Api-Key':requireMaps(),'X-Goog-FieldMask':mask}, body:JSON.stringify(body),signal:combinedSignal(signal,20_000) });
  if (!response.ok) throw new ApiError(response.status === 429 ? 429 : 502, response.status === 403 ? 'Google Maps rejected this request. Check the server key, billing, and enabled Places and Routes APIs.' : 'Google Maps could not complete this request. Try another place or travel mode.');
  return response.json();
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2 || q.length > 200) throw new ApiError(400,'Place searches must contain 2–200 characters.');
  const data = await google('https://places.googleapis.com/v1/places:searchText',{textQuery:q,pageSize:5},'places.id,places.displayName,places.formattedAddress,places.location',signal);
  return (data.places || []).filter((p:GooglePlace) => p.location && typeof p.location.latitude === 'number' && typeof p.location.longitude === 'number').map((p:GooglePlace) => ({id:p.id,label:[p.displayName?.text,p.formattedAddress].filter(Boolean).join(', '),lat:p.location!.latitude,lng:p.location!.longitude}));
}
interface GooglePlace {id:string;displayName?:{text:string};formattedAddress?:string;location?:{latitude:number;longitude:number}}
interface GoogleStep { staticDuration?:string; transitDetails?:{stopDetails?:{arrivalTime?:string}} }
interface GoogleRoute {duration:string;distanceMeters:number;polyline?:{encodedPolyline?:string};description?:string;warnings?:string[];legs?:{steps?:GoogleStep[]}[]}

function seconds(value?: string) { const n = Number.parseFloat(value || '0'); return Number.isFinite(n) ? n : 0; }
export async function computeTrips(origin:Place,destination:Place,mode:TravelMode,signal?:AbortSignal):Promise<Trip[]> {
  const departure = new Date();
  const body: Record<string,unknown> = {origin:{location:{latLng:{latitude:origin.lat,longitude:origin.lng}}},destination:{location:{latLng:{latitude:destination.lat,longitude:destination.lng}}},travelMode:mode,computeAlternativeRoutes:true,units:'METRIC'};
  if (mode === 'DRIVE' || mode === 'TWO_WHEELER') Object.assign(body,{routingPreference:'TRAFFIC_AWARE'});
  if (mode === 'TRANSIT') Object.assign(body,{transitPreferences:{routingPreference:'FEWER_TRANSFERS'}});
  const data = await google('https://routes.googleapis.com/directions/v2:computeRoutes',body,'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.warnings,routes.legs.steps.staticDuration,routes.legs.steps.transitDetails.stopDetails.arrivalTime',signal);
  if (!data.routes?.length) throw new ApiError(422,'No routes were found for this travel mode. Try another mode or destination.');
  return data.routes.slice(0,3).map((route:GoogleRoute) => {
    const durationSeconds = Math.ceil(seconds(route.duration));
    if (!durationSeconds) throw new ApiError(502,'Google Maps returned an incomplete route. Please try again.');
    let scheduled: number | undefined;
    if (mode === 'TRANSIT') {
      for (const leg of route.legs || []) for (const step of leg.steps || []) {
        const arrival = step.transitDetails?.stopDetails?.arrivalTime;
        if (arrival && Number.isFinite(Date.parse(arrival))) scheduled = Date.parse(arrival);
        else if (scheduled) scheduled += seconds(step.staticDuration) * 1000;
      }
    }
    return {id:randomUUID(),origin,destination,mode,durationSeconds,distanceMeters:route.distanceMeters || 0,arrivalTime:scheduled || departure.getTime()+durationSeconds*1000,polyline:route.polyline?.encodedPolyline,summary:route.description || `${origin.label.split(',')[0]} to ${destination.label.split(',')[0]}`,warnings:route.warnings || [],...(scheduled ? {transitArrivalTime:scheduled} : {})};
  });
}
