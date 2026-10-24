import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { synthesize } from '../src/lib/server/voice-provider.mjs';

const directory = path.resolve('public/demo');
const manifestPath = path.join(directory,'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath,'utf8'));
const base = process.env.DEMO_SERVER_URL || 'http://localhost:3000';
const force = process.argv.includes('--force');
const direct = process.argv.includes('--direct');
const onlyId = process.argv.find(argument => argument.startsWith('--only='))?.slice('--only='.length);
await mkdir(directory,{recursive:true});
let generated = 0;
async function record({language,id,script,targetSeconds,planVersion,url,saveTo}) {
  const basename=path.basename(url);
  if (!basename.endsWith('.mp3')) throw new Error('Demo audio URLs must end in .mp3');
  const output=path.join(directory,basename);
  const existing=await stat(output).catch(()=>null);
  if (!force && existing?.size>1000) { console.log(`Keeping ${basename}`); return; }
  console.log(`Generating ${basename}`);
  let result;
  if(direct){
    const textBase=process.env.OPENAI_BASE_URL||process.env.OPENAI_API_BASE||'https://api.openai.com/v1';
    const official=new URL(textBase).hostname==='api.openai.com';
    const apiKey=process.env.OPENAI_AUDIO_API_KEY||(official?process.env.OPENAI_API_KEY:undefined);
    if(!apiKey)throw new Error('Set OPENAI_AUDIO_API_KEY to record demo speech.');
    for(let attempt=0;attempt<3;attempt++){
      try{
        result=await synthesize({apiKey,baseURL:process.env.OPENAI_AUDIO_BASE_URL||'https://api.openai.com/v1',model:process.env.OPENAI_VOICE_MODEL||'gpt-realtime-2.1-mini',voice:process.env.OPENAI_VOICE||'marin',script,language,targetSeconds,signal:AbortSignal.timeout(120000)});
        break;
      }catch(error){
        if(attempt===2)throw error;
        console.log(`Retrying ${basename} (${attempt+2}/3)`);
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
    }
  }else{
    const response=await fetch(`${base}/api/audio`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,planVersion,script,language,targetSeconds}),signal:AbortSignal.timeout(120_000)});
    result=await response.json();
    if(!response.ok)throw new Error(result.error||`Audio generation failed (${response.status})`);
  }
  if (!result.audioBase64) throw new Error(`No MP3 bytes returned for ${basename}`);
  await writeFile(output,Buffer.from(result.audioBase64,'base64'));
  Object.assign(saveTo,{durationSeconds:result.durationSeconds,spokenTranscript:result.spokenTranscript,mimeType:'audio/mpeg'});
  generated++;
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
manifest.quizAudio ||= {};
for (const language of ['en','hi','hinglish']) {
  const plan = manifest.plans[language];
  for (const audio of manifest.audio[language]) {
    if (onlyId && audio.id !== onlyId) continue;
    const chunk = [...plan.chunks,...(manifest.extensions?.[language] || []),...(manifest.compactRecaps?.[language]?[manifest.compactRecaps[language]]:[])].find(c=>c.id===audio.id);
    const script = audio.spokenTranscript || chunk?.script;
    if (!script) throw new Error(`Missing script for ${language}/${audio.id}`);
    await record({language,id:audio.id,script,targetSeconds:chunk?.targetSeconds || audio.durationSeconds,planVersion:plan.version,url:audio.url,saveTo:audio});
  }
  if (onlyId) continue;
  manifest.quizAudio[language] ||= [];
  for (const question of plan.quiz) {
    const url=`/demo/${language}-quiz-${question.id}.mp3`;
    let audio=manifest.quizAudio[language].find(audio=>audio.id===question.id);
    if (!audio) { audio={id:question.id,planVersion:plan.version,url,mimeType:'audio/mpeg',durationSeconds:0,spokenTranscript:question.question}; manifest.quizAudio[language].push(audio); }
    await record({language,id:question.id,script:question.question,targetSeconds:Math.max(5,Math.min(20,question.question.split(/\s+/u).length/2.1)),planVersion:plan.version,url,saveTo:audio});
  }
}
console.log(`Generated ${generated} MP3 recordings.`);
