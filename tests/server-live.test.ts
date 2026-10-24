import {describe,expect,it} from 'vitest';
import {createPlan,replanEpisode} from '../src/lib/server/planner';
import {generateAudio} from '../src/lib/server/audio';
import {gradeAnswer,transcribeAnswer} from '../src/lib/server/quiz';
import {computeTrips} from '../src/lib/server/maps';
import {quizBudget} from '../src/lib/timing';
import type {PlanRequest} from '../src/lib/types';

/** Explicit opt-in: this integration check makes billable provider requests. */
describe.skipIf(process.env.RUN_LIVE_SERVER_TESTS!=='1')('live lesson pipeline',()=>{
  it('writes full scripts and a grounded quiz, then shortens without replacing played content',async()=>{
    const place={id:'test-place',label:'Test location',lat:12.97,lng:77.59};
    const request:PlanRequest={
      trip:{id:'test-trip',origin:place,destination:{...place,id:'destination'},mode:'DRIVE',durationSeconds:300,distanceMeters:2000,arrivalTime:Date.now()+300000},
      source:{id:'practice-notes',title:'Retrieval practice notes',kind:'notes',text:'Retrieval practice means trying to recall information from memory. It can include answering a question without looking at notes, explaining an idea in your own words, or recalling a sequence of steps. Checking the answer afterward helps identify mistakes. Rereading can make material feel familiar, while recall asks whether it can be produced without the page. A useful study routine is a short attempt, a check against the source, and a later attempt. Begin with material that has already been taught. A missed answer is information about what to revisit, not a judgment about a learner. Practice questions should match the learning goal.'},
      interests:['learning'],language:'en',
    };
    const plan=await createPlan(request,AbortSignal.timeout(180000));
    expect(plan.chunks.length).toBeGreaterThanOrEqual(5);
    expect(plan.targetSeconds).toBe(300);
    const narrationTarget=300-quizBudget(300);
    expect(plan.chunks.reduce((total,chunk)=>total+chunk.targetSeconds,0)).toBe(narrationTarget);
    expect(plan.quiz.length).toBeGreaterThanOrEqual(2);
    expect(plan.chunks.every(chunk=>chunk.script.split(/\s+/u).length>=chunk.targetSeconds*0.8)).toBe(true);
    const shortened=await replanEpisode({plan,remainingSeconds:90,playedChunkIds:[plan.chunks[0].id],coveredConcepts:plan.chunks[0].concepts},AbortSignal.timeout(120000));
    expect(shortened.version).toBe(2);
    expect(shortened.chunks[0]).toEqual(plan.chunks[0]);
    expect(shortened.chunks.filter(chunk=>chunk.id!==plan.chunks[0].id).reduce((n,chunk)=>n+chunk.targetSeconds,0)).toBeLessThanOrEqual(90);
    const concepts=new Set(shortened.chunks.flatMap(chunk=>chunk.concepts));
    expect(shortened.quiz.every(question=>question.concepts.every(concept=>concepts.has(concept)))).toBe(true);
    let spokenSeconds=0;
    for(let offset=0;offset<plan.chunks.length;offset+=2){
      const tracks=await Promise.all(plan.chunks.slice(offset,offset+2).map(async chunk=>{
        const narration=await generateAudio({id:chunk.id,planVersion:plan.version,script:chunk.script,language:plan.language,targetSeconds:chunk.targetSeconds},AbortSignal.timeout(120000));
        expect(narration.durationSeconds).toBeGreaterThan(5);
        expect(narration.durationSeconds).toBeLessThanOrEqual(75);
        expect(Buffer.from(narration.audioBase64!,'base64').length).toBeGreaterThan(1000);
        expect(narration.spokenTranscript.length).toBeGreaterThan(chunk.script.length/2);
        return narration;
      }));
      spokenSeconds+=tracks.reduce((n,track)=>n+track.durationSeconds,0);
    }
    expect(spokenSeconds).toBeGreaterThanOrEqual(narrationTarget*0.85);
    expect(spokenSeconds).toBeLessThanOrEqual(narrationTarget*1.25);
    const question=plan.quiz[0];
    const answerAudio=await generateAudio({id:'live-answer',planVersion:plan.version,script:question.expectedAnswer,language:plan.language,targetSeconds:15},AbortSignal.timeout(120000));
    const form=new FormData();
    form.append('language','en');
    form.append('file',new File([new Uint8Array(Buffer.from(answerAudio.audioBase64!,'base64'))],'answer.mp3',{type:'audio/mpeg'}));
    const transcribed=await transcribeAnswer(new Request('http://localhost/api/quiz/transcribe',{method:'POST',body:form}));
    expect(transcribed.text.length).toBeGreaterThan(5);
    const grade=await gradeAnswer({question,answer:transcribed.text,language:plan.language},AbortSignal.timeout(60000));
    expect(grade.questionId).toBe(question.id);
    expect(grade.score).toBeGreaterThanOrEqual(70);
    expect(grade.score).toBeLessThanOrEqual(100);
    expect(grade.feedback.length).toBeGreaterThan(5);
  },300000);
  it('computes a live traffic-aware driving route',async()=>{
    const origin={id:'bengaluru-centre',label:'Bengaluru',lat:12.9716,lng:77.5946};
    const destination={id:'koramangala',label:'Koramangala',lat:12.9352,lng:77.6245};
    const trips=await computeTrips(origin,destination,'DRIVE',AbortSignal.timeout(30000));
    expect(trips.length).toBeGreaterThan(0);
    expect(trips[0].durationSeconds).toBeGreaterThan(0);
    expect(trips[0].distanceMeters).toBeGreaterThan(0);
    expect(trips[0].mode).toBe('DRIVE');
    expect(trips[0].demo).not.toBe(true);
  },40000);
});
