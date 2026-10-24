import { z } from 'zod';

export const languageSchema = z.enum(['en', 'hi', 'hinglish']);
export const placeSchema = z.object({ id: z.string().min(1).max(300), label: z.string().min(1).max(500), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const travelModeSchema = z.enum(['DRIVE', 'TRANSIT', 'TWO_WHEELER', 'WALK', 'BICYCLE']);
export const tripSchema = z.object({
  id: z.string().min(1).max(200), origin: placeSchema, destination: placeSchema, mode: travelModeSchema,
  durationSeconds: z.number().min(1).max(86400), distanceMeters: z.number().min(0).max(50_000_000), arrivalTime: z.number().finite(),
  polyline: z.string().max(100_000).optional(), summary: z.string().max(1000).optional(), warnings: z.array(z.string().max(1000)).max(20).optional(), transitArrivalTime: z.number().finite().optional(), demo: z.boolean().optional(),
});
export const sourceSchema = z.object({ id: z.string().max(200), title: z.string().min(1).max(1000), text: z.string().min(1).max(200_000), url: z.string().url().max(4000).optional(), kind: z.enum(['notes','pdf','url','discovery']), retrievedAt: z.string().max(100).optional() });
export const chunkSchema = z.object({
  id: z.string().min(1).max(200), chapter: z.string().min(1).max(300), title: z.string().min(1).max(300), script: z.string().min(20).max(2000),
  targetSeconds: z.number().min(15).max(60), priority: z.enum(['essential','optional','recap']), concepts: z.array(z.string().min(1).max(100)).max(10), prerequisites: z.array(z.string().min(1).max(100)).max(10),
});
export const questionSchema = z.object({ id: z.string().min(1).max(200), question: z.string().min(1).max(1000), expectedAnswer: z.string().min(1).max(3000), concepts: z.array(z.string().min(1).max(100)).max(10) });
export const citationSchema = z.object({ title: z.string().max(1000), url: z.string().url().max(4000), retrievedAt: z.string().max(100).optional() });
export const episodeSchema = z.object({
  id: z.string().min(1).max(200), version: z.number().int().min(1).max(10000), title: z.string().min(1).max(300), description: z.string().max(2000), language: languageSchema,
  targetSeconds: z.number().min(1).max(10_000), chunks: z.array(chunkSchema).min(1).max(120), quiz: z.array(questionSchema).max(3), sources: z.array(citationSchema).max(30), createdAt: z.string().max(100), demo: z.boolean().optional(),
});
export const planRequestSchema = z.object({ trip: tripSchema, source: sourceSchema.optional(), interests: z.array(z.string().trim().min(1).max(150)).max(12), language: languageSchema });
export const replanRequestSchema = z.object({ plan: episodeSchema, remainingSeconds: z.number().min(0).max(3600), playedChunkIds: z.array(z.string().max(200)).max(120), coveredConcepts: z.array(z.string().max(100)).max(1200), preservedDurationSeconds:z.number().min(0).max(7200).optional() });
export const routeRequestSchema = z.object({ origin: placeSchema, destination: placeSchema, mode: travelModeSchema });
export const sourceRequestSchema = z.object({ url: z.string().url().max(4000) });
export const audioRequestSchema = z.object({ id: z.string().min(1).max(200), planVersion: z.number().int().min(1).max(10000), script: z.string().trim().min(1).max(2000), language: languageSchema, targetSeconds: z.number().min(1).max(75).optional() });
export const gradeRequestSchema = z.object({ question: questionSchema, answer: z.string().trim().max(4000), language: languageSchema });
