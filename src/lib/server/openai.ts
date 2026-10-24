import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { ApiError, combinedSignal, requireOpenAI } from './http';

export function textClient() {
  return new OpenAI({apiKey:requireOpenAI(),baseURL:process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || undefined,timeout:120_000,maxRetries:1});
}
export const textModel = () => process.env.OPENAI_TEXT_MODEL || 'gpt-6.1-sol';
export async function structured<T>(schema:z.ZodType<T>,name:string,instructions:string,input:string,signal?:AbortSignal,maxOutputTokens=12_000):Promise<T> {
  const response = await textClient().responses.parse({model:textModel(),instructions,input,text:{format:zodTextFormat(schema,name)},max_output_tokens:maxOutputTokens},{signal:combinedSignal(signal,180_000)});
  if (response.status !== 'completed' || !response.output_parsed) throw new ApiError(502,'The lesson response was incomplete. Please try again or choose a shorter journey.');
  return response.output_parsed;
}

export function audioConfig() {
  const textBase = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  let official = false;
  try { official = new URL(textBase).hostname === 'api.openai.com'; } catch { /* Invalid provider configuration is handled by the provider call. */ }
  const apiKey = process.env.OPENAI_AUDIO_API_KEY?.trim() || (official ? process.env.OPENAI_API_KEY?.trim() : undefined);
  const baseURL = process.env.OPENAI_AUDIO_BASE_URL?.trim() || (official ? textBase : 'https://api.openai.com/v1');
  return {apiKey,baseURL};
}
export function audioClient() {
  const config = audioConfig();
  if (!config.apiKey) throw new ApiError(503,'Voice is not configured. Add OPENAI_AUDIO_API_KEY for a provider that supports Realtime audio and transcription.');
  return new OpenAI({apiKey:config.apiKey,baseURL:config.baseURL,timeout:60_000,maxRetries:0});
}
