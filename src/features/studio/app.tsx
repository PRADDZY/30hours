"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, WifiOff } from "lucide-react";
import {
  AppShell, EpisodeLibrary, EpisodePlayer, Onboarding, PreferencesPanel, RouteCard,
  SourceComposer, StudioHero, StudioNotes, TripBuilder, type StartInput, type View,
} from "@/components/studio";
import type { AppCapabilities, Language, Preferences, SavedEpisode, Trip } from "@/lib/types";
import { getPreferences, savePreferences, deleteEpisode } from "@/lib/storage";
import { remainingBudget, shouldReplan } from "@/lib/timing";
import { readableError, requestJson } from "@/lib/client-api";
import { useEpisode } from "@/hooks/use-episode";
import { Modal, QuizDialog, Transcript } from "@/features/player/overlays";

const defaults: Preferences = { interests: ["Technology & AI", "History & culture"], language: "en", onboarded: false };

export function ThirtyHours({ initialDemo = false }: { initialDemo?: boolean }) {
  const [view, setView] = useState<View>("studio");
  const [demo, setDemo] = useState(initialDemo);
  const [online, setOnline] = useState(true);
  const [preferences, setPreferences] = useState(defaults);
  const [capabilities, setCapabilities] = useState<AppCapabilities>();
  const [trip, setTrip] = useState<Trip>();
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [dismissedQuizEpisode, setDismissedQuizEpisode] = useState<string>();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [openingLanguage, setOpeningLanguage] = useState<Language>("en");
  const lastAdaptedAt = useRef(0);
  const episodeRef = useRef<SavedEpisode | undefined>(undefined);
  const tripRef = useRef<Trip | undefined>(undefined);
  const adaptRef = useRef<(seconds: number) => Promise<void>>(async () => {});
  const updatingRoute = useRef(false);
  const onError = useCallback((message: string) => setError(message), []);
  const session = useEpisode(onError);
  useEffect(() => {
    episodeRef.current = session.episode;
    tripRef.current = trip;
    adaptRef.current = session.adapt;
  }, [session.episode, trip, session.adapt]);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      getPreferences().catch(() => undefined),
      requestJson<AppCapabilities>("/api/config").catch(() => undefined),
    ]).then(([saved, config]) => {
      if (!alive) return;
      if (saved) setPreferences(saved);
      if (config) setCapabilities(config);
    });
    const connection = () => setOnline(navigator.onLine);
    connection(); window.addEventListener("online", connection); window.addEventListener("offline", connection);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    const welcomeTimer = window.setTimeout(() => { if (!localStorage.getItem("30hours-welcomed") && !initialDemo) setShowWelcome(true); }, 0);
    return () => { alive = false; window.clearTimeout(welcomeTimer); window.removeEventListener("online", connection); window.removeEventListener("offline", connection); };
  }, [initialDemo]);

  const commitPreferences = useCallback((next: Preferences) => {
    const value = { ...next, interests: [...new Set(next.interests)].slice(0, 16) };
    setPreferences(value);
    void savePreferences(value).catch(problem => onError(readableError(problem)));
  }, [onError]);

  const updateRoute = useCallback(async () => {
    const currentTrip = tripRef.current;
    const episode = episodeRef.current;
    if (!currentTrip || !episode || currentTrip.demo || updatingRoute.current || !navigator.onLine || document.hidden) return;
    updatingRoute.current = true;
    try {
      const origin = currentTrip.origin.id === "current-location"
        ? await new Promise<Trip["origin"]>((resolve, reject) => navigator.geolocation.getCurrentPosition(
          value => resolve({ ...currentTrip.origin, lat: value.coords.latitude, lng: value.coords.longitude }), reject, { timeout: 8000, maximumAge: 60000 }))
        : currentTrip.origin;
      const result = await requestJson<{ trips: Trip[] }>("/api/route", { origin, destination: currentTrip.destination, mode: currentTrip.mode });
      const route = result.trips.find(item => item.id === currentTrip.id) || result.trips[0];
      if (!route) return;
      const oldRemaining = remainingBudget(currentTrip.arrivalTime);
      const arrivalTime = route.mode === "TRANSIT" && route.transitArrivalTime ? route.transitArrivalTime : Date.now() + route.durationSeconds * 1000;
      const next = { ...route, arrivalTime };
      setTrip(next); tripRef.current = next; session.updateTrip(next);
      const newRemaining = remainingBudget(arrivalTime);
      if (shouldReplan(oldRemaining, newRemaining) && episodeRef.current?.id === episode.id && Date.now() - lastAdaptedAt.current > 30000) {
        lastAdaptedAt.current = Date.now(); await adaptRef.current(newRemaining);
      }
    } catch { /* Keep the last known route and arrival estimate. */ }
    finally { updatingRoute.current = false; }
  }, [session.updateTrip]);

  useEffect(() => {
    if (!session.episode || demo) return;
    const delay = session.episode.trip.origin.id === "current-location" ? 30000 : 60000;
    const interval = setInterval(() => void updateRoute(), delay);
    const visibility = () => { if (document.visibilityState === "visible") void updateRoute(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", visibility); };
  }, [session.episode?.id, demo, updateRoute]);

  const start = useCallback(async ({ source, interests, language }: StartInput) => {
    if (!trip) { setError("Choose a journey first. A good idea needs somewhere to go."); return; }
    if (!demo && !capabilities?.openai) { setError("Lesson generation needs a configured OpenAI API key. The prepared demo is ready to explore."); return; }
    if (!demo && !capabilities?.voice) { setError("Spoken audio needs an OpenAI API key with Realtime access. Your saved listens are still here."); return; }
    setError(""); setOpeningLanguage(language); setTranscriptOpen(false); setQuizOpen(false);
    await session.start({ trip, source, interests, language }, demo);
    if (!preferences.onboarded) commitPreferences({ interests, language, onboarded: true });
    requestAnimationFrame(() => document.getElementById("episode-listen")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [trip, capabilities, demo, session.start, preferences.onboarded, commitPreferences]);

  const beginDemo = useCallback(() => {
    setDemo(true); setView("studio"); setTrip(undefined); tripRef.current = undefined; setError("");
    setTimeout(() => document.getElementById("journey-studio")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }, []);
  const toggleDemo = useCallback(() => {
    if (demo) { setDemo(false); setTrip(undefined); tripRef.current = undefined; }
    else beginDemo();
  }, [demo, beginDemo]);

  const selectEpisode = useCallback((episode: SavedEpisode) => {
    setView("studio"); setDemo(Boolean(episode.plan.demo)); setTrip(episode.trip); tripRef.current = episode.trip;
    setTranscriptOpen(false); setQuizOpen(false); session.resume(episode);
    setTimeout(() => document.getElementById("episode-listen")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }, [session.resume]);

  const simulateArrival = useCallback(async (remainingSeconds: number) => {
    const currentTrip = tripRef.current;
    if (currentTrip) {
      const next = { ...currentTrip, durationSeconds: remainingSeconds, arrivalTime: Date.now() + remainingSeconds * 1000 };
      setTrip(next); tripRef.current = next; session.updateTrip(next);
    }
    await session.adapt(remainingSeconds);
  }, [session.adapt, session.updateTrip]);

  const removeEpisode = useCallback(async (id: string) => {
    try { await deleteEpisode(id); await session.refreshLibrary(); }
    catch (problem) { onError(readableError(problem)); }
  }, [session.refreshLibrary, onError]);

  const current = session.episode;
  const quizAutomaticallyVisible = Boolean(session.completed && online && current?.plan.quiz.length && session.status.startsWith("A few questions") && dismissedQuizEpisode !== current.id);
  const currentChapter = session.chunk?.title || "Your first chapter is taking shape";
  const chapterIndex = current?.plan.chunks.findIndex(item => item.id === session.chunk?.id) ?? -1;
  return <AppShell view={view} onNavigate={setView} online={online} demo={demo} onToggleDemo={toggleDemo}>
    {view === "studio" && <>
      <StudioHero />
      <section className="journey-studio" id="journey-studio">
        <div className="studio-section-heading"><div><span className="eyebrow">A LITTLE CURIOUS? YOU’RE IN THE RIGHT PLACE.</span><h2>Your next ride, reimagined.</h2></div><span className="studio-heading-note">A few details. A whole new perspective.</span></div>
        <div className="studio-card">
          <TripBuilder key={demo ? "demo-trip-builder" : "live-trip-builder"} demo={demo} capabilities={capabilities} onTrip={value => { setTrip(value); tripRef.current = value; }} onLoading={setRouteLoading} onInvalidate={() => { setTrip(undefined); tripRef.current = undefined; }} />
          <SourceComposer onStart={start} generating={session.generating} preferences={preferences} onPreferences={commitPreferences} disabled={!trip || routeLoading} />
        </div>
        {trip && <RouteCard trip={trip} />}
      </section>
      {error && <div className="notice notice-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss message">×</button></div>}
      {session.generating && !current && <div className="preparing"><span className="loading-orbit"><i /></span><div><span className="eyebrow">A LITTLE SOMETHING, TAKING SHAPE</span><h2>Your next good idea is on its way.</h2><p>Finding the thread for your journey.</p></div></div>}
      {current && <section className="episode-listen" id="episode-listen">
        <div className="studio-section-heading"><div><span className="eyebrow">YOUR JOURNEY, IN SOUND</span><h2>Arrive with something new.</h2></div><span className="studio-heading-note">{openingLanguage === "en" ? "A good idea, in your own time." : openingLanguage === "hi" ? "एक नई सोच, अपने ही समय में।" : "A new thought, your way."}</span></div>
        <EpisodePlayer title={current.plan.title} chapter={currentChapter} progress={session.progress} duration={session.duration} arrivalTime={current.trip.arrivalTime} isPlaying={session.playing} onToggle={session.toggle} onSeek={session.seek} onSkip={session.skip} buffering={session.buffering} offlineReady={current.offlineReady} downloadProgress={session.downloadProgress} onDownload={session.download} onTranscript={() => setTranscriptOpen(true)} onQuiz={() => { session.pause(); setQuizOpen(true); }} onTrafficChange={simulateArrival} status={session.adapting ? "Finding room for a little more." : session.status} />
        <div className="chapter-list"><div className="chapter-list-top"><span className="eyebrow">A FEW CHAPTERS, JUST FOR THE ROAD</span><span>{current.plan.chunks.length} CHAPTERS</span></div>{current.plan.chunks.map((item, index) => {
          const ready = current.audio.some(audio => audio.id === item.id && audio.blob?.size);
          const heard = current.playedChunkIds.includes(item.id);
          return <button key={item.id} className={`chapter-row ${index === chapterIndex ? "current" : ""} ${heard ? "heard" : ""}`} onClick={() => { const target = current.plan.chunks.slice(0, index).reduce((sum, chunk) => sum + (current.audio.find(sound => sound.id === chunk.id)?.durationSeconds || chunk.targetSeconds), 0); session.seek(target); if (!session.playing) session.toggle(); }}><span className="chapter-number">{heard ? "✓" : String(index + 1).padStart(2, "0")}</span><span className="chapter-title"><strong>{item.title}</strong><small>{item.chapter}</small></span><span className="chapter-duration">{ready ? "READY" : session.generating ? "IN THE MAKING" : "WAITING"}</span><span className="chapter-marker">{index === chapterIndex ? "NOW PLAYING" : item.priority === "optional" ? "ANOTHER ANGLE" : "ESSENTIAL"}</span></button>;
        })}</div>
        {current.plan.sources.length > 0 && <div className="sources-inline"><span>CURIOUS WHERE IT CAME FROM?</span><button onClick={() => setShowSources(true)}>A few sources & stories<ArrowRight size={14} /></button></div>}
      </section>}
      {session.status && !current && <p className="session-message" role="status">{session.status}</p>}
      <StudioNotes />
    </>}
    {view === "library" && <EpisodeLibrary episodes={session.library} onPlay={selectEpisode} onDelete={removeEpisode} />}
    {view === "interests" && <PreferencesPanel preferences={preferences} onChange={commitPreferences} />}
    {!online && <div className="offline-ribbon" role="status"><WifiOff size={15} /> Offline. Downloaded listens are ready when you are.</div>}
    {showWelcome && <Onboarding preferences={preferences} onClose={() => { setShowWelcome(false); localStorage.setItem("30hours-welcomed", "1"); }} onSave={next => { commitPreferences(next); setShowWelcome(false); localStorage.setItem("30hours-welcomed", "1"); }} />}
    {transcriptOpen && current && <Transcript episode={current} onClose={() => setTranscriptOpen(false)} onChapter={index => { const target = current.plan.chunks.slice(0, index).reduce((sum, item) => sum + (current.audio.find(sound => sound.id === item.id)?.durationSeconds || item.targetSeconds), 0); session.seek(target); session.toggle(); }} />}
    {(quizOpen || quizAutomaticallyVisible) && current && <QuizDialog episode={current} onClose={() => { setQuizOpen(false); if (session.completed) setDismissedQuizEpisode(current.id); }} onComplete={results => { session.saveResults(results); setQuizOpen(false); setDismissedQuizEpisode(current.id); }} />}
    {showSources && current && <Modal title="A little further reading" onClose={() => setShowSources(false)} className="sources-dialog"><h2>{current.plan.title}</h2><p className="dialog-lead">Stories and research that shaped this listen.</p><div className="episode-sources">{current.plan.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>{source.title}<small>{source.retrievedAt ? "As of " + new Date(source.retrievedAt).toLocaleDateString() : "Source article"}</small></span><ArrowRight size={15} /></a>)}</div></Modal>}
  </AppShell>;
}
