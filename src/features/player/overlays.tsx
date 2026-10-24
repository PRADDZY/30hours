"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CheckCheck, Headphones, LoaderCircle, Mic, SkipForward, X } from "lucide-react";
import type { AudioChunk, QuizQuestion, QuizResult, SavedEpisode } from "@/lib/types";
import { audioBlob, readableError, requestJson } from "@/lib/client-api";

export function Modal({ title, children, onClose, className = "" }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog className={`session-dialog ${className}`} ref={ref} onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }} aria-label={title}>
    <div className="session-dialog-head"><span className="eyebrow">{title}</span><button className="icon-button" onClick={onClose} aria-label={`Close ${title}`}><X size={20} /></button></div>{children}
  </dialog>;
}

export function Transcript({ episode, onClose, onChapter }: { episode: SavedEpisode; onClose: () => void; onChapter: (index: number) => void }) {
  return <Modal title="Your listen, in words" onClose={onClose} className="transcript-dialog"><h2>{episode.plan.title}</h2><p className="dialog-lead">A few ideas worth coming back to.</p><div className="transcript-body">{episode.plan.chunks.map((chunk, i) => <section key={chunk.id}><button onClick={() => { onChapter(i); onClose(); }}><span>{String(i + 1).padStart(2, "0")}</span><h3>{chunk.title}</h3><Headphones size={15} /></button><p>{episode.audio.find(a => a.id === chunk.id)?.spokenTranscript || chunk.script}</p></section>)}</div>{episode.plan.sources.length > 0 && <div className="episode-sources"><h3>A little further reading</h3>{episode.plan.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowRight size={14} /></a>)}</div>}</Modal>;
}

export function QuizDialog({ episode, onClose, onComplete }: { episode: SavedEpisode; onClose: () => void; onComplete: (results: QuizResult[]) => void }) {
  const heardConcepts = new Set(episode.plan.chunks.filter(c => episode.playedChunkIds.includes(c.id)).flatMap(c => c.concepts));
  const questions = episode.plan.quiz.filter(q => q.concepts.every(concept => heardConcepts.has(concept)));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<"ready" | "speaking" | "listening" | "processing" | "feedback" | "done">("ready");
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<QuizResult[]>([]);
  const [countdown, setCountdown] = useState(15);
  const [error, setError] = useState("");
  const [useVoice, setUseVoice] = useState(true);
  const media = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const playback = useRef<HTMLAudioElement | null>(null);
  const aborter = useRef(new AbortController());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const active = useRef(true);
  const question = questions[questionIndex];
  const deadline = episode.trip.arrivalTime;
  const [remaining, setRemaining] = useState(1);
  const currentQuestion = useRef<QuizQuestion | undefined>(question);
  const deadlineHandled = useRef(false);
  useEffect(() => { currentQuestion.current = question; }, [question]);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; aborter.current.abort(); playback.current?.pause(); media.current?.getTracks().forEach(t => t.stop()); if (recorder.current?.state === "recording") recorder.current.stop(); timers.current.forEach(clearTimeout); };
  }, [deadline]);

  const finish = useCallback((next: QuizResult[]) => { onComplete(next); setPhase("done"); }, [onComplete]);
  useEffect(() => {
    if (phase === "done") return;
    const interval = setInterval(() => {
      const seconds = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !deadlineHandled.current) {
        deadlineHandled.current = true;
        if (recorder.current?.state === "recording") recorder.current.stop();
        playback.current?.pause(); aborter.current.abort(); finish(results);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, phase, results, finish]);

  async function grade(text: string) {
    if (!currentQuestion.current || !active.current) return;
    setPhase("processing"); setAnswer(text);
    const timeout = setTimeout(() => aborter.current.abort(), 12000); timers.current.push(timeout);
    try {
      const result = await requestJson<QuizResult>("/api/quiz/grade", { question: currentQuestion.current, answer: text, language: episode.plan.language }, aborter.current.signal);
      if (!active.current) return;
      setResults(old => [...old, result]); setPhase("feedback");
    } catch (e) {
      if (active.current) { setError(readableError(e)); setPhase("ready"); aborter.current = new AbortController(); }
    } finally { clearTimeout(timeout); }
  }

  async function recordAnswer() {
    if (!active.current || !useVoice) { setPhase("ready"); return; }
    if (!media.current) { setUseVoice(false); setPhase("ready"); return; }
    const parts: Blob[] = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const instance = new MediaRecorder(media.current, { mimeType }); recorder.current = instance;
    instance.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
    instance.onstop = async () => {
      if (!active.current || aborter.current.signal.aborted || Date.now() >= deadline) return;
      setPhase("processing");
      const form = new FormData(); form.append("file", new Blob(parts, { type: mimeType }), "answer.webm"); form.append("language", episode.plan.language);
      const timeout = setTimeout(() => aborter.current.abort(), 12000); timers.current.push(timeout);
      try {
        const response = await fetch("/api/quiz/transcribe", { method: "POST", body: form, signal: aborter.current.signal });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Your answer couldn't be transcribed. Try typing it instead.");
        clearTimeout(timeout);
        if (!data.text?.trim()) { setPhase("ready"); setError("We didn't catch that. Try again, or type your answer."); return; }
        await grade(data.text);
      } catch (e) { clearTimeout(timeout); if (active.current) { setError(readableError(e)); setUseVoice(false); setPhase("ready"); aborter.current = new AbortController(); } }
    };
    setPhase("listening"); let seconds = Math.min(15, Math.max(1, Math.floor((deadline - Date.now()) / 1000) - 8)); setCountdown(seconds);
    instance.start();
    const ticker = setInterval(() => { seconds -= 1; setCountdown(Math.max(0, seconds)); if (seconds <= 0) { clearInterval(ticker); if (instance.state === "recording") instance.stop(); } }, 1000);
    instance.addEventListener("stop", () => clearInterval(ticker), { once: true });
  }

  async function speakQuestion() {
    if (!question) return;
    if (!navigator.onLine) { setError("The voice quiz needs a connection. Your downloaded lesson is still yours."); return; }
    setError(""); setPhase("speaking");
    try {
      if (useVoice && !media.current) {
        try { media.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
        catch { setUseVoice(false); setError("Microphone access isn't available. You can type your answer below."); }
      }
      let blob: Blob | undefined;
      if (episode.plan.demo) { const response = await fetch(`/demo/${episode.plan.language}-quiz-${question.id}.mp3`, { signal: aborter.current.signal }); if (response.ok) blob = await response.blob(); }
      if (!blob) { const result = await requestJson<AudioChunk>("/api/audio", { id: `quiz-${question.id}`, planVersion: episode.plan.version, script: question.question, language: episode.plan.language, targetSeconds: 10 }, aborter.current.signal); blob = audioBlob(result); }
      if (!blob) throw new Error("This question couldn't be spoken. You can read it and type an answer.");
      const url = URL.createObjectURL(blob); const audio = new Audio(url); playback.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); void recordAnswer(); };
      audio.onerror = () => { URL.revokeObjectURL(url); setUseVoice(false); setPhase("ready"); };
      await audio.play();
    } catch (e) { if (active.current) { setError(readableError(e)); setUseVoice(false); setPhase("ready"); } }
  }

  function next() {
    if (questionIndex >= questions.length - 1 || remaining < 25) { finish(results); return; }
    setQuestionIndex(i => i + 1); setAnswer(""); setError(""); setPhase("ready");
  }
  function skip() {
    playback.current?.pause();
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (!question) { finish(results); return; }
    const nextResults = [...results, { questionId: question.id, answer: "", score: 0, feedback: "Skipped", skipped: true }];
    setResults(nextResults);
    if (questionIndex >= questions.length - 1 || remaining < 25) finish(nextResults);
    else { setQuestionIndex(i => i + 1); setPhase("ready"); setAnswer(""); }
  }
  const assessed = results.filter(r => !r.skipped);
  const score = assessed.length ? Math.round(assessed.reduce((sum, item) => sum + item.score, 0) / assessed.length) : 0;
  return <Modal title="A little reflection" onClose={onClose} className="quiz-dialog">
      {phase === "done" || !question ? <div className="quiz-finished"><span className="quiz-finished-icon"><CheckCheck size={32} /></span><span className="eyebrow">SOMETHING TO TAKE WITH YOU</span><h2>{assessed.length ? "A new perspective, kept." : "Keep a little curiosity."}</h2><p>{assessed.length ? `${score}% understanding · ${assessed.length} reflection${assessed.length === 1 ? "" : "s"} completed.` : questions.length ? "Your journey is complete. Come back for another listen." : episode.plan.quiz.length ? "Listen to a complete chapter first. Your questions will follow the ideas you've heard." : "This journey left more time for listening than reflection."}</p><button className="primary-button" onClick={onClose}>Take it with you<ArrowRight size={17} /></button></div> : <>
      <div className="quiz-progress"><span>QUESTION {questionIndex + 1} / {questions.length}</span><span>{remaining}s until arrival</span></div><h2>{question.question}</h2>
      {phase === "feedback" ? <div className="quiz-feedback"><span className="quiz-score">{results.at(-1)?.score}%</span><p>{results.at(-1)?.feedback}</p><blockquote>{answer}</blockquote><button className="primary-button" onClick={next}>{questionIndex < questions.length - 1 && remaining >= 25 ? "One more thought" : "Finish reflection"}<ArrowRight size={17} /></button></div> : <>
        <div className={`quiz-mic ${phase}`} aria-live="polite">{phase === "processing" || phase === "speaking" ? <LoaderCircle className="spin" size={30} /> : <Mic size={30} />}<strong>{phase === "speaking" ? "A question for the road…" : phase === "listening" ? `Listening · ${countdown}s` : phase === "processing" ? "Connecting the dots…" : "A little thought, in your own words."}</strong><small>{phase === "listening" ? "Your microphone is recording. Speak naturally." : "English, Hindi, or a little of both."}</small></div>
        {phase === "ready" && <><button className="primary-button quiz-start" onClick={() => void speakQuestion()}><Headphones size={17} />{useVoice ? "Listen & answer hands-free" : "Hear the question"}</button><div className="quiz-type"><label htmlFor="quiz-answer">Or put it in writing</label><textarea id="quiz-answer" value={answer} onChange={e => setAnswer(e.target.value)} maxLength={3000} placeholder="What stayed with you?" /><button className="secondary-button" onClick={() => void grade(answer)} disabled={!answer.trim()}>Send my answer<ArrowRight size={15} /></button></div></>}
        {phase === "listening" && <button className="secondary-button" onClick={() => recorder.current?.stop()}>That’s my answer<CheckCheck size={15} /></button>}
        <button className="quiz-skip" onClick={skip} disabled={phase === "processing"}><SkipForward size={14} />Skip this question</button>
      </>}{error && <p className="inline-error" role="alert">{error}</p>}
    </>}
  </Modal>;
}
