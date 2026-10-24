import { describe, expect, it } from 'vitest';
import { isPublicAddress, validatePublicUrl } from '../src/lib/server/sources';
import { planRequestSchema, replanRequestSchema } from '../src/lib/server/schemas';
import { normalizePlan, adaptPlan, outlineSchema } from '../src/lib/server/planner';
import * as planner from '../src/lib/server/planner';
import type { z } from 'zod';

describe('source URL security', () => {
  it.each(['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','172.16.2.2','0.0.0.0','::1','::','fc00::1','fe80::1','::ffff:127.0.0.1','::ffff:7f00:1','64:ff9b::a00:1'])('blocks private or special address %s', (address) => expect(isPublicAddress(address)).toBe(false));
  it.each(['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])('accepts public address %s', (address) => expect(isPublicAddress(address)).toBe(true));
  it('rejects mixed public/private DNS answers', async () => {
    await expect(validatePublicUrl('https://example.org/article', async () => [{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}])).rejects.toThrow(/public/);
  });
  it.each(['file:///etc/passwd','http://user:pass@example.org/','http://localhost/','http://127.1/','http://2130706433/','https://example.org:444/'])('rejects unsafe URL %s', async (url) => {
    await expect(validatePublicUrl(url)).rejects.toThrow();
  });
});

describe('request validation', () => {
  it('rejects unbounded requests before provider work', () => {
    expect(planRequestSchema.safeParse({trip:{durationSeconds:999999},language:'en',interests:[]}).success).toBe(false);
    expect(replanRequestSchema.safeParse({remainingSeconds:-1}).success).toBe(false);
  });
  it('rejects a journey too short for narration and quiz instead of extending its ETA',async()=>{
    const place={id:'p',label:'A place',lat:12,lng:77};
    await expect(planner.createPlan({trip:{id:'tiny-trip',origin:place,destination:place,mode:'WALK',durationSeconds:60,distanceMeters:60,arrivalTime:Date.now()+60000},source:{id:'notes',title:'Notes',text:'Recall what you have learned, then check it against your notes.',kind:'notes'},interests:[],language:'en'})).rejects.toMatchObject({status:422});
  });
  it('constrains generated quiz identifiers to concepts actually taught', () => {
    expect(planner).toHaveProperty('quizSchemaForConcepts');
    const makeSchema=Reflect.get(planner,'quizSchemaForConcepts') as (concepts:string[])=>z.ZodType;
    const schema=makeSchema(['retrieval','feedback']);
    const question={id:'q1',question:'What helps learning?',expectedAnswer:'Retrieval and feedback',concepts:['retrieval']};
    expect(schema.safeParse({quiz:[question,{...question,id:'q2',concepts:['feedback']}]}).success).toBe(true);
    expect(schema.safeParse({quiz:[question,{...question,id:'q2',concepts:['invented-id']}]}).success).toBe(false);
    expect(schema.safeParse({quiz:[question,{...question,id:'q2',concepts:[]}]}).success).toBe(false);
  });
  it('constrains outline concepts before asking the provider to write full scripts', () => {
    const outline={title:'Lesson',description:'Description',chunks:[{chapter:'One',title:'Recall',priority:'essential',concepts:['a'.repeat(101)],prerequisites:[],objective:'Teach recall'}]};
    expect(outlineSchema.safeParse(outline).success).toBe(false);
    expect(outlineSchema.safeParse({...outline,chunks:[{...outline.chunks[0],concepts:['recall']}]}).success).toBe(true);
  });
  it('teaches missing prerequisites explicitly and orders dependent chunks before the recap', () => {
    expect(planner).toHaveProperty('prepareOutline');
    type OutlineChunk=import('zod').infer<typeof outlineSchema>['chunks'][number];
    const prepare=Reflect.get(planner,'prepareOutline') as (chunks:OutlineChunk[])=>OutlineChunk[];
    const make=(title:string,concepts:string[],prerequisites:string[],priority:'essential'|'recap'='essential'):OutlineChunk=>({chapter:'One',title,concepts,prerequisites,priority,objective:'Explain with an example.'});
    const prepared=prepare([make('Application',['apply'],['recall']),make('Recall',['recall'],['memory']),make('Ending',['summary'],['apply'],'recap')]);
    expect(prepared[0].title).toBe('Recall');
    expect(prepared[0].concepts).toContain('memory');
    expect(prepared[0].objective).toContain('memory');
    const taught=new Set<string>();
    for(const chunk of prepared){expect(chunk.prerequisites.every(concept=>taught.has(concept))).toBe(true);chunk.concepts.forEach(concept=>taught.add(concept));}
    expect(prepared.at(-1)?.priority).toBe('recap');
  });
});

describe('duration and adaptation', () => {
  const chunk = (id:string,priority:'essential'|'optional'|'recap', concepts:string[] = []) => ({id,chapter:'One',title:id,script:'A complete short lesson script.',targetSeconds:45,priority,concepts,prerequisites:[]});
  const plan = {id:'ep',version:1,title:'Learning',description:'A lesson',language:'en' as const,targetSeconds:300,chunks:[chunk('a','essential',['a']),chunk('b','essential',['b']),chunk('c','optional',['c']),chunk('d','recap',['a'])],quiz:[{id:'q',question:'What is a?',expectedAnswer:'a',concepts:['a']}],sources:[],createdAt:new Date().toISOString()};
  it('does not claim an incomplete short script set fills a long commute', () => {
    expect(() => normalizePlan(plan,1800,'en')).toThrow(/duration|script/i);
  });
  it('preserves played chunks, essential priorities and a recap on shorter ETA', () => {
    const result = adaptPlan(plan,150,['a'],['a']);
    expect(result.version).toBe(2);
    expect(result.chunks[0]).toEqual(plan.chunks[0]);
    expect(result.chunks.map(c=>c.id)).toEqual(['a','b','d']);
    expect(result.targetSeconds).toBe(195);
  });
  it('keeps the trip budget while validating only the narration allocation',()=>{
    const prepared={...plan,targetSeconds:300,chunks:Array.from({length:6},(_,i)=>({...chunk(`p${i}`,'essential',[`c${i}`]),targetSeconds:40,script:'A useful explanation with a clear example and a practical takeaway. '.repeat(5)}))};
    expect(normalizePlan(prepared,240,'en').targetSeconds).toBe(300);
  });
  it('uses a brief ending and skips the quiz when the new ETA cannot fit both',()=>{
    const result=adaptPlan(plan,30,['a'],['a']);
    expect(result.quiz).toEqual([]);
    expect(result.targetSeconds).toBe(75);
    expect(result.chunks.filter(c=>c.id!=='a').reduce((sum,c)=>sum+c.targetSeconds,0)).toBeLessThanOrEqual(30);
  });
});
