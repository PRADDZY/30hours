import { afterEach,describe,expect,it,vi } from 'vitest';
import { ApiError,endpoint,readJson } from '../src/lib/server/http';
import { z } from 'zod';
import { computeTrips } from '../src/lib/server/maps';
import { pcmToMp3 } from '../src/lib/server/audio';
import { audioConfig } from '../src/lib/server/openai';

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('API safety',()=>{
  it('never leaks provider errors or key material',async()=>{
    const response=await endpoint(async()=>{throw new Error('sk-secret-provider-value');})(new Request('http://localhost/test'));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('sk-secret');
  });
  it('returns actionable declared errors',async()=>{
    const response=await endpoint(async()=>{throw new ApiError(503,'Voice is not configured.');})(new Request('http://localhost/test'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({error:'Voice is not configured.'});
  });
  it('enforces body limits without trusting Content-Length',async()=>{
    await expect(readJson(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({text:'a'.repeat(1000)})}),z.object({text:z.string()}),200)).rejects.toMatchObject({status:413});
  });
  it('does not send a third-party gateway key to the official audio endpoint',()=>{
    vi.stubEnv('OPENAI_BASE_URL','https://gateway.example/v1');vi.stubEnv('OPENAI_API_KEY','gateway-key');vi.stubEnv('OPENAI_AUDIO_API_KEY','');
    expect(audioConfig().apiKey).toBeUndefined();
  });
});
describe('route timing',()=>{
  const origin={id:'o',label:'Origin',lat:12.9,lng:77.6};
  const destination={id:'d',label:'Destination',lat:13,lng:77.7};
  it('requests traffic-aware driving instead of a static baseline',async()=>{
    vi.stubEnv('GOOGLE_MAPS_API_KEY','test');
    const fetch=vi.fn().mockResolvedValue(Response.json({routes:[{duration:'900s',distanceMeters:5000}]}));
    vi.stubGlobal('fetch',fetch);
    const trips=await computeTrips(origin,destination,'DRIVE');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE'});
    expect(trips[0].durationSeconds).toBe(900);
  });
  it('uses scheduled transit arrival and adds the final walk',async()=>{
    vi.stubEnv('GOOGLE_MAPS_API_KEY','test');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({routes:[{duration:'900s',distanceMeters:5000,legs:[{steps:[{transitDetails:{stopDetails:{arrivalTime:'2026-10-24T10:00:00Z'}}},{staticDuration:'120s'}]}]}]})));
    const [trip]=await computeTrips(origin,destination,'TRANSIT');
    expect(trip.transitArrivalTime).toBe(Date.parse('2026-10-24T10:02:00Z'));
    expect(trip.arrivalTime).toBe(trip.transitArrivalTime);
  });
});
describe('audio encoding',()=>{
  it('reports duration from actual PCM sample count and produces MP3 bytes',()=>{
    const pcm=Buffer.alloc(24_000*2);
    for(let i=0;i<24_000;i++) pcm.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/24_000)*4000),i*2);
    const result=pcmToMp3(pcm);
    expect(result.durationSeconds).toBe(1);
    expect(Buffer.from(result.audioBase64,'base64').length).toBeGreaterThan(5000);
  });
  it('rejects malformed and oversize PCM',()=>{
    expect(()=>pcmToMp3(Buffer.alloc(3))).toThrow();
    expect(()=>pcmToMp3(Buffer.alloc(3_600_002))).toThrow();
  });
});
