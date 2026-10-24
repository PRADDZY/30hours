import type { AudioChunk, Language } from '../types';
import { ApiError } from './http';
import { audioConfig } from './openai';
import { encodePcm, synthesize } from './voice-provider.mjs';

export const pcmToMp3 = encodePcm;

export async function generateAudio(input:{id:string;planVersion:number;script:string;language:Language;targetSeconds?:number},signal?:AbortSignal):Promise<AudioChunk> {
  const {apiKey,baseURL}=audioConfig();
  if(!apiKey)throw new ApiError(503,'Voice is not configured. Add OPENAI_AUDIO_API_KEY for a provider that supports Realtime audio and transcription.');
  try {
    const audio=await synthesize({apiKey,baseURL,model:process.env.OPENAI_VOICE_MODEL||'gpt-realtime-2.1-mini',voice:process.env.OPENAI_VOICE||'marin',script:input.script,language:input.language,targetSeconds:input.targetSeconds,signal});
    return {id:input.id,planVersion:input.planVersion,...audio,mimeType:'audio/mpeg'};
  }catch(error){
    if(error instanceof Error && 'status' in error && typeof error.status==='number')throw new ApiError(error.status,error.message);
    throw error;
  }
}
