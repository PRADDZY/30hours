"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioChunk, EpisodePlan, PlanRequest, QuizResult, SavedEpisode } from "@/lib/types";
import { createDemoEpisode, demoCompactRecaps, demoExtensions } from "@/lib/demo";
import { getEpisodes, saveEpisode } from "@/lib/storage";
import { fitTiming, quizBudget, remainingBudget, scheduleUnplayed } from "@/lib/timing";
import { audioBlob, decodedDuration, readableError, requestJson } from "@/lib/client-api";

export function useEpisode(onError: (message: string) => void) {
  const [episode, setEpisode] = useState<SavedEpisode>();
  const [library, setLibrary] = useState<SavedEpisode[]>([]);
  const [generating, setGenerating] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [completed, setCompleted] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>();
  const [adapting, setAdapting] = useState(false);
  const current = useRef<SavedEpisode | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const intentToPlay = useRef(false);
  const indexRef = useRef(0);
  const lastSave = useRef(0);
  const seekOffset = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const persistQueue = useRef(Promise.resolve());
  const adaptingRef = useRef(false);
  const playbackRateRef = useRef(1);
  const adaptRef = useRef<(seconds: number) => Promise<void>>(async () => {});
  const fittedPlans = useRef(new Set<string>());
  const fitAdjustments = useRef(new Map<string, number>());
  const errorRef = useRef(onError);
  useEffect(() => { errorRef.current = onError; }, [onError]);

  const refreshLibrary = useCallback(async () => {
    try { setLibrary(await getEpisodes()); } catch { /* Storage errors are surfaced on saving. */ }
  }, []);

  const update = useCallback((next: SavedEpisode, persist = true) => {
    current.current = next;
    if (mounted.current) setEpisode(next);
    if (persist) persistQueue.current = persistQueue.current.then(async () => {
      await saveEpisode(next);
      if (mounted.current) await refreshLibrary();
    }).catch(error => { if (mounted.current) errorRef.current(readableError(error)); });
  }, [refreshLibrary]);

  const updateTrip = useCallback((trip: SavedEpisode["trip"]) => {
    const latest = current.current;
    if (latest) update({ ...latest, trip });
  }, [update]);

  useEffect(() => {
    mounted.current = true;
    const initialLoad = window.setTimeout(() => { void refreshLibrary(); }, 0);
    const audio = new Audio(); audio.preload = "auto"; audioRef.current = audio;
    return () => { mounted.current = false; window.clearTimeout(initialLoad); audio.pause(); audio.removeAttribute("src"); controller.current?.abort(); };
  }, [refreshLibrary]);

  const buildAudio = useCallback(async (initial: SavedEpisode, aborter: AbortController) => {
    setGenerating(true);
    setStatus(initial.plan.demo ? "Getting your prepared listen ready…" : "Making your opening. The rest will follow as you listen.");
    const ordered = [...initial.plan.chunks].sort((a, b) => {
      const rank = (id: string, priority: string) => id === initial.plan.chunks[0]?.id ? 0 : priority === "recap" ? 1 : 2;
      return rank(a.id, a.priority) - rank(b.id, b.priority);
    });
    const pending = ordered.filter(chunk => !initial.audio.some(audio => audio.id === chunk.id && audio.blob?.size));
    let cursor = 0;
    const errors: string[] = [];
    const worker = async () => {
      while (cursor < pending.length && !aborter.signal.aborted) {
        const chunk = pending[cursor++];
        if (current.current?.id !== initial.id || current.current.plan.version !== initial.plan.version) return;
        try {
          let result: AudioChunk | undefined;
          const fixture = initial.audio.find(audio => audio.id === chunk.id && audio.url);
          if (initial.plan.demo && fixture?.url) {
            const response = await fetch(fixture.url, { signal: aborter.signal });
            if (!response.ok) throw new Error("The prepared audio isn't available yet. Run the demo audio setup, then try again.");
            result = { ...fixture, blob: await response.blob() };
          } else result = await requestJson<AudioChunk>("/api/audio", { id: chunk.id, planVersion: initial.plan.version, script: chunk.script, language: initial.plan.language, targetSeconds: chunk.targetSeconds }, aborter.signal);
          const blob = audioBlob(result);
          if (!blob?.size) throw new Error("The narrator returned no audio. Please try again.");
          const measured = await decodedDuration(blob, result.durationSeconds);
          const latest = current.current;
          if (!latest || latest.id !== initial.id || latest.plan.version !== initial.plan.version || aborter.signal.aborted) return;
          const audio: AudioChunk = { ...result, id: chunk.id, blob, durationSeconds: measured, audioBase64: undefined, planVersion: latest.plan.version };
          const audioItems = [...latest.audio.filter(item => item.id !== chunk.id), audio];
          const ready = latest.plan.chunks.every(item => audioItems.some(sound => sound.id === item.id && sound.blob?.size));
          update({ ...latest, audio: audioItems, offlineReady: ready });
          const percent = Math.round(latest.plan.chunks.filter(item => audioItems.some(sound => sound.id === item.id && sound.blob?.size)).length / latest.plan.chunks.length * 100);
          if (mounted.current) { setDownloadProgress(percent); setStatus(ready ? "Your whole listen is ready to go offline." : `Your listen is taking shape · ${percent}% ready`); }
        } catch (error) {
          if (aborter.signal.aborted) return;
          errors.push(readableError(error));
          if (chunk.id === initial.plan.chunks[0]?.id) { aborter.abort(); errorRef.current(readableError(error)); break; }
        }
      }
    };
    await Promise.all([worker(), worker()]);
    if (mounted.current && current.current?.id === initial.id && current.current?.plan.version === initial.plan.version) {
      setGenerating(false);
      if (errors.length) { setStatus("Some chapters couldn't download. You can retry saving the episode."); if (!aborter.signal.aborted) errorRef.current(errors[0]); }
      const latest = current.current;
      const allReady = latest.plan.chunks.every(item => latest.audio.some(sound => sound.id === item.id && sound.blob?.size));
      const fitKey = `${latest.id}:${latest.plan.version}`;
      if (allReady && !aborter.signal.aborted && !fittedPlans.current.has(fitKey)) {
        fittedPlans.current.add(fitKey);
        const remaining = remainingBudget(latest.trip.arrivalTime);
        const quizSeconds = latest.plan.quiz.length ? quizBudget(latest.plan.targetSeconds) : 0;
        const target = Math.max(0, remaining - quizSeconds);
        if (target >= 15 && !latest.plan.chunks.every(item => latest.playedChunkIds.includes(item.id))) {
          const firstPending = Math.min(indexRef.current, latest.plan.chunks.length - 1);
          const suffix = latest.plan.chunks.slice(firstPending);
          const currentId = latest.plan.chunks[firstPending]?.id;
          const measured = suffix.map(item => {
            const sound = latest.audio.find(audio => audio.id === item.id)!;
            const left = item.id === currentId ? Math.max(0.1, sound.durationSeconds - (audioRef.current?.currentTime || 0)) : sound.durationSeconds;
            return { ...sound, durationSeconds: left };
          });
          const activeIds = [...latest.playedChunkIds, ...latest.plan.chunks.slice(0, firstPending + 1).map(item => item.id)];
          const coveredConcepts = latest.plan.chunks.slice(0, firstPending + 1).flatMap(item => item.concepts);
          const schedule = scheduleUnplayed(latest.plan, { remainingSeconds: remaining, playedChunkIds: activeIds, coveredConcepts, audio: latest.audio });
          const safeToDrop = new Set(schedule.droppableIds);
          const optional = suffix.filter(item => item.priority === "optional" && safeToDrop.has(item.id)).map(item => item.id);
          const fit = fitTiming(measured, target, optional);
          if (fit.droppedIds.length) {
            const dropped = new Set(fit.droppedIds);
            const next = { ...latest, plan: { ...latest.plan, chunks: latest.plan.chunks.filter(item => !dropped.has(item.id)) }, audio: latest.audio.filter(item => !dropped.has(item.id)) };
            next.offlineReady = next.plan.chunks.every(item => next.audio.some(sound => sound.id === item.id && sound.blob?.size));
            update(next);
          }
          if (fit.withinTolerance) {
            playbackRateRef.current = fit.playbackRate;
            if (audioRef.current) audioRef.current.playbackRate = fit.playbackRate;
            setStatus(fit.droppedIds.length ? "The essentials fit the time ahead." : "Your listen is paced for the time ahead.");
            fitAdjustments.current.delete(latest.id);
          } else {
            const attempts = fitAdjustments.current.get(latest.id) || 0;
            if (attempts < 3 && remaining >= 45) {
              fitAdjustments.current.set(latest.id, attempts + 1);
              setStatus(fit.driftSeconds > 0 ? "Shaping the ending to fit your arrival." : "Finding one more idea for the time ahead.");
              void adaptRef.current(remaining);
            } else {
              const drift = Math.round(Math.abs(fit.driftSeconds));
              setStatus(`This listen is about ${drift} seconds ${fit.driftSeconds > 0 ? "over" : "short of"} the available lesson time. Adjust your journey to make room.`);
            }
          }
        }
      }
    }
  }, [update]);

  const start = useCallback(async (input: PlanRequest, demo: boolean) => {
    controller.current?.abort(); audioRef.current?.pause();
    playbackRateRef.current = 1;
    if (audioRef.current) audioRef.current.playbackRate = 1;
    const aborter = new AbortController(); controller.current = aborter;
    setGenerating(true); setBuffering(true); setCompleted(false); setIndex(0); indexRef.current = 0; setProgress(0); setDownloadProgress(0);
    intentToPlay.current = true;
    setStatus(demo ? "Getting your little escape ready…" : "Finding the thread for your journey…");
    try {
      const initial: SavedEpisode = demo ? createDemoEpisode(input.language) : {
        id: crypto.randomUUID(), plan: await requestJson<EpisodePlan>("/api/episodes/plan", input, aborter.signal),
        trip: input.trip, audio: [], playedChunkIds: [], position: 0, savedAt: new Date().toISOString(), offlineReady: false, results: [],
      };
      if (aborter.signal.aborted) return;
      // The trip countdown begins when the opening becomes playable, not while preparing the plan.
      initial.id = demo ? initial.plan.id + "-" + crypto.randomUUID() : initial.plan.id;
      initial.trip = { ...initial.trip, arrivalTime: initial.trip.mode === "TRANSIT" && initial.trip.transitArrivalTime ? initial.trip.transitArrivalTime : Date.now() + initial.trip.durationSeconds * 1000 };
      update(initial); void buildAudio(initial, aborter);
    } catch (error) {
      if (!aborter.signal.aborted) { errorRef.current(readableError(error)); setStatus(""); setBuffering(false); setGenerating(false); }
    }
  }, [buildAudio, update]);

  const chunk = episode?.plan.chunks[index];
  const sound = episode?.audio.find(item => item.id === chunk?.id && item.blob?.size);
  const soundBlob = sound?.blob;
  // Preserve the active Audio element while replacement chunks download.
  const chunkKey = `${episode?.id}:${chunk?.id}`;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !chunk) return;
    if (!soundBlob) {
      const bufferingTimer = window.setTimeout(() => { if (mounted.current) { setBuffering(true); setPlaying(false); } }, 0);
      audio.pause();
      return () => window.clearTimeout(bufferingTimer);
    }
    const url = URL.createObjectURL(soundBlob);
    audio.src = url;
    audio.playbackRate = playbackRateRef.current;
    audio.onloadedmetadata = () => {
      if (seekOffset.current !== undefined) { audio.currentTime = Math.min(seekOffset.current, Math.max(0, audio.duration - 0.1)); seekOffset.current = undefined; }
      setBuffering(false);
      if (intentToPlay.current) void audio.play().catch(() => { setPlaying(false); setStatus("Your opening is ready. Tap play when you're ready."); });
    };
    audio.onerror = () => { setBuffering(false); setPlaying(false); errorRef.current("This audio couldn't play. Try saving it again."); };
    audio.onplay = () => setPlaying(true); audio.onpause = () => setPlaying(false);
    audio.ontimeupdate = () => {
      const latest = current.current; if (!latest) return;
      const before = latest.plan.chunks.slice(0, indexRef.current).reduce((sum, item) => sum + (latest.audio.find(a => a.id === item.id)?.durationSeconds || item.targetSeconds), 0);
      const position = before + audio.currentTime;
      setProgress(position);
      current.current = { ...latest, position };
      if (Date.now() - lastSave.current > 5000) { lastSave.current = Date.now(); update(current.current); }
    };
    audio.onended = () => {
      const latest = current.current; if (!latest) return;
      const heard = [...new Set([...latest.playedChunkIds, latest.plan.chunks[indexRef.current].id])];
      update({ ...latest, playedChunkIds: heard });
      if (indexRef.current < latest.plan.chunks.length - 1) { indexRef.current += 1; setIndex(indexRef.current); }
      else { intentToPlay.current = false; setPlaying(false); setCompleted(true); setStatus(latest.plan.quiz.length && navigator.onLine ? "A few questions to make the ideas stick." : latest.plan.quiz.length ? "You've arrived with something new. Quiz skipped while offline." : "You've arrived with something new."); }
    };
    return () => { audio.pause(); audio.onloadedmetadata = null; audio.ontimeupdate = null; audio.onended = null; audio.onerror = null; URL.revokeObjectURL(url); };
  // Chunk identity and Blob are stable while unrelated downloads complete.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkKey, soundBlob]);

  const toggle = useCallback(() => {
    const audio = audioRef.current; if (!audio || !current.current) return;
    if (!audio.paused) { intentToPlay.current = false; audio.pause(); }
    else { intentToPlay.current = true; void audio.play().catch(error => errorRef.current(readableError(error))); }
  }, []);

  const pause = useCallback(() => { intentToPlay.current = false; audioRef.current?.pause(); }, []);
  const seek = useCallback((position: number) => {
    const latest = current.current; if (!latest) return;
    let remaining = position;
    let nextIndex = 0;
    while (nextIndex < latest.plan.chunks.length - 1) {
      const item = latest.plan.chunks[nextIndex]; const duration = latest.audio.find(a => a.id === item.id)?.durationSeconds || item.targetSeconds;
      if (remaining < duration) break; remaining -= duration; nextIndex++;
    }
    setCompleted(false);
    if (nextIndex === indexRef.current && audioRef.current) audioRef.current.currentTime = remaining;
    else { seekOffset.current = remaining; indexRef.current = nextIndex; setIndex(nextIndex); }
    setProgress(position);
  }, []);
  const skip = useCallback((direction: -1 | 1) => {
    const latest = current.current; if (!latest) return;
    const next = Math.max(0, Math.min(latest.plan.chunks.length - 1, indexRef.current + direction));
    const position = latest.plan.chunks.slice(0, next).reduce((sum, item) => sum + (latest.audio.find(a => a.id === item.id)?.durationSeconds || item.targetSeconds), 0);
    seek(position);
  }, [seek]);

  const download = useCallback(() => {
    if (!current.current) return;
    if (!navigator.onLine) { errorRef.current("Reconnect to finish downloading this listen."); return; }
    controller.current?.abort(); const aborter = new AbortController(); controller.current = aborter;
    void buildAudio(current.current, aborter);
  }, [buildAudio]);

  const resume = useCallback((saved: SavedEpisode) => {
    controller.current?.abort(); audioRef.current?.pause();
    playbackRateRef.current = 1;
    if (audioRef.current) audioRef.current.playbackRate = 1;
    const refreshed = { ...saved, trip: { ...saved.trip, arrivalTime: Date.now() + Math.max(60, saved.plan.targetSeconds - saved.position) * 1000 } };
    current.current = refreshed; setEpisode(refreshed); setCompleted(false); intentToPlay.current = true;
    seek(saved.position); setStatus(saved.offlineReady ? "Picked up right where you left off." : "Your saved listen. Reconnect to download missing chapters.");
    setDownloadProgress(saved.offlineReady ? 100 : undefined);
    if (saved.offlineReady || navigator.onLine) { const aborter = new AbortController(); controller.current = aborter; void buildAudio(refreshed, aborter); }
  }, [buildAudio, seek]);

  const adapt = useCallback(async (remainingSeconds: number) => {
    const latest = current.current;
    if (!latest || adaptingRef.current || !Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return;
    if (!navigator.onLine && !latest.plan.demo) { setStatus("You're offline. Keeping your downloaded listen and last known arrival."); return; }
    adaptingRef.current = true; setAdapting(true); setStatus("Fitting the rest of your listen to the time ahead…");
    const oldIndex = indexRef.current;
    const prefix = latest.plan.chunks.slice(0, oldIndex + 1);
    const prefixIds = prefix.map(item => item.id);
    const currentSound = latest.audio.find(item => item.id === prefix.at(-1)?.id);
    const currentRemaining = Math.max(0, (currentSound?.durationSeconds || prefix.at(-1)?.targetSeconds || 0) - (audioRef.current?.currentTime || 0));
    const postCurrentRemaining = Math.max(0, remainingSeconds - currentRemaining);
    const preservedDurationSeconds = prefix.reduce((sum, item) => sum + (latest.audio.find(sound => sound.id === item.id)?.durationSeconds || item.targetSeconds), 0);
    const covered = latest.plan.chunks.filter(item => latest.playedChunkIds.includes(item.id)).flatMap(item => item.concepts);
    try {
      let plan: EpisodePlan;
      if (latest.plan.demo) {
        const future = latest.plan.chunks.filter(item => !prefixIds.includes(item.id));
        const extension = demoExtensions[latest.plan.language].filter(item => !latest.plan.chunks.some(chunk => chunk.id === item.id));
        const candidate = { ...latest.plan, chunks: [...prefix, ...future.filter(item => item.priority !== "recap"), ...extension, ...future.filter(item => item.priority === "recap")] };
        const schedule = scheduleUnplayed(candidate, { remainingSeconds: Math.max(0, remainingSeconds - currentRemaining), playedChunkIds: prefixIds, coveredConcepts: [...covered, ...(prefix.at(-1)?.concepts || [])], audio: latest.audio });
        let rest = schedule.chunks;
        if (!rest.length || (remainingSeconds < 35 && !prefix.some(item => item.priority === "recap"))) rest = [demoCompactRecaps[latest.plan.language]];
        plan = { ...latest.plan, version: latest.plan.version + 1, chunks: [...prefix, ...rest], targetSeconds: progress + remainingSeconds };
      } else {
        if (postCurrentRemaining < 30) { setStatus("There isn't enough time after this chapter to reshape the ending."); return; }
        const result = await requestJson<EpisodePlan>("/api/episodes/replan", { plan: latest.plan, remainingSeconds: postCurrentRemaining, playedChunkIds: prefixIds, coveredConcepts: covered, preservedDurationSeconds });
        plan = { ...result, chunks: [...prefix, ...result.chunks.filter(item => !prefixIds.includes(item.id))] };
      }
      // Build replacements without interrupting the current audio element.
      const present = current.current; if (!present || present.id !== latest.id || present.plan.version !== latest.plan.version) return;
      controller.current?.abort();
      const next: SavedEpisode = { ...present, plan, trip: { ...present.trip, arrivalTime: Date.now() + remainingSeconds * 1000 }, audio: present.audio.map(item => ({ ...item, planVersion: plan.version })), offlineReady: false };
      // Demo alternates are already generated alongside the base episode.
      if (plan.demo) {
        const extras = [...demoExtensions[plan.language], demoCompactRecaps[plan.language]];
        for (const item of extras) if (plan.chunks.some(chunk => chunk.id === item.id) && !next.audio.some(a => a.id === item.id)) next.audio.push({ id: item.id, planVersion: plan.version, durationSeconds: item.targetSeconds, spokenTranscript: item.script, mimeType: "audio/mpeg", url: `/demo/${plan.language}-${item.id}.mp3` });
      }
      const offset = audioRef.current?.currentTime || 0;
      seekOffset.current = offset;
      update(next); const aborter = new AbortController(); controller.current = aborter; void buildAudio(next, aborter);
      setStatus("Your essentials stay. The rest now fits your journey.");
    } catch (error) { errorRef.current(readableError(error)); setStatus("Keeping your current listen. You can try adjusting again."); }
    finally { adaptingRef.current = false; setAdapting(false); }
  }, [buildAudio, progress, update]);

  useEffect(() => { adaptRef.current = adapt; }, [adapt]);

  const saveResults = useCallback((results: QuizResult[]) => { if (current.current) update({ ...current.current, results }); }, [update]);
  const duration = episode?.plan.chunks.reduce((sum, item) => sum + (episode.audio.find(audio => audio.id === item.id)?.durationSeconds || item.targetSeconds), 0) || 0;
  return { episode, library, generating, buffering, playing, progress, index, status, completed, downloadProgress, adapting,
    duration, chunk, start, toggle, pause, seek, skip, download, resume, adapt, refreshLibrary, updateTrip, saveResults, quizSeconds: episode ? episode.plan.quiz.length ? quizBudget(episode.plan.targetSeconds) : 0 : 60 };
}
