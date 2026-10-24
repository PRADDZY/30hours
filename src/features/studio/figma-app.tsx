"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, Heart, Pause, Play, Route, SkipBack, SkipForward, Trash2, UserRound } from "lucide-react";
import { FigmaSourceComposer, RouteCard, TripBuilder, type StartInput } from "@/components/studio";
import { JourneyIntro } from "@/features/studio/journey-intro";
import { Modal, QuizDialog, Transcript } from "@/features/player/overlays";
import { useEpisode } from "@/hooks/use-episode";
import { requestJson, readableError } from "@/lib/client-api";
import { deleteEpisode, getPreferences, savePreferences } from "@/lib/storage";
import { remainingBudget, shouldReplan } from "@/lib/timing";
import type { AppCapabilities, Language, Preferences, SavedEpisode, Trip } from "@/lib/types";

type View = "create" | "listen" | "library" | "interests";
const defaultPreferences: Preferences = { interests: ["History", "Cities"], language: "hinglish", onboarded: false };
const topics = ["History", "Design", "Cities", "Music", "Science", "People"];

function FigmaShell({ view, onNavigate, children }: { view: View; onNavigate: (view: View) => void; children: React.ReactNode }) {
  return <div className="app-shell"><header><button className="brand" onClick={() => onNavigate("create")} aria-label="30hours home"><span>30</span><span>hours</span></button><nav aria-label="Primary"><button className={view === "create" || view === "listen" ? "active" : ""} onClick={() => onNavigate("create")}>Create</button><button className={view === "library" ? "active" : ""} onClick={() => onNavigate("library")}>Library</button><button className={view === "interests" ? "active profile" : "profile"} onClick={() => onNavigate("interests")} aria-label="Interests"><UserRound size={18} /></button></nav></header>{children}</div>;
}

function timeLabel(seconds: number) { const safe = Math.max(0, Math.floor(seconds)); return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`; }
function languageLabel(language: Language) { return language === "en" ? "English" : language === "hi" ? "Hindi" : "Hinglish"; }

function FigmaEpisodePlayer({ episode, currentChapter, chapterIndex, progress, duration, playing, buffering, offlineProgress, status, onToggle, onSeek, onSkip, onDownload, onTranscript, onSources, onAdjust }: {
  episode: SavedEpisode; currentChapter: string; chapterIndex: number; progress: number; duration: number; playing: boolean; buffering: boolean; offlineProgress?: number; status: string;
  onToggle: () => void; onSeek: (seconds: number) => void; onSkip: (direction: -1 | 1) => void; onDownload: () => void; onTranscript: () => void; onSources: () => void; onAdjust: (seconds: number) => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [minutes, setMinutes] = useState(Math.max(1, Math.ceil((episode.trip.arrivalTime - Date.now()) / 60000)));
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((episode.trip.arrivalTime - Date.now()) / 1000)));
  const total = duration || episode.plan.targetSeconds;
  useEffect(() => { const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((episode.trip.arrivalTime - Date.now()) / 1000))), 1000); return () => window.clearInterval(timer); }, [episode.trip.arrivalTime]);
  return <section className="player">
    <div className="player-top"><span className="eyebrow">A {Math.max(1, Math.ceil(total / 60))} MINUTE {episode.plan.demo ? "SAMPLE LISTEN" : "FIELD LESSON"}</span><button className={episode.offlineReady ? "saved" : ""} onClick={onDownload}><Heart size={17} />{episode.offlineReady ? "Saved" : offlineProgress !== undefined && offlineProgress < 100 ? `Saving ${Math.round(offlineProgress)}%` : "Save"}</button></div>
    <h1>{episode.plan.title}</h1>
    <p className="chapter-label">CHAPTER {String(Math.max(chapterIndex + 1, 1)).padStart(2, "0")} OF {String(episode.plan.chunks.length).padStart(2, "0")}</p>
    <h3>{currentChapter}</h3>
    <div className="scrubber"><div style={{ width: `${total ? Math.min(progress / total * 100, 100) : 0}%` }} /><input aria-label="Seek through the lesson" type="range" min={0} max={Math.max(total, 1)} value={Math.min(progress, total)} onChange={event => onSeek(Number(event.target.value))} /></div>
    <div className="times"><span>{timeLabel(progress)}</span><span>{timeLabel(total)}</span></div>
    <div className="controls"><button aria-label="Previous chapter" onClick={() => onSkip(-1)}><SkipBack size={22} /></button><button className="play" aria-label={playing ? "Pause" : "Play"} onClick={onToggle} disabled={buffering}>{playing ? <Pause size={32} /> : <Play size={32} fill="currentColor" />}</button><button aria-label="Next chapter" onClick={() => onSkip(1)}><SkipForward size={22} /></button></div>
    <div className="arrival"><Route size={18} /><div><small>ESTIMATED ARRIVAL</small><strong>{remaining ? `${Math.ceil(remaining / 60)} min away` : "You’ve arrived"}</strong></div><button onClick={() => setAdjusting(value => !value)} aria-expanded={adjusting}>Adjust</button></div>
    {adjusting && <form className="traffic-form figma-traffic-form" onSubmit={event => { event.preventDefault(); if (minutes > 0 && minutes <= 180) { onAdjust(minutes * 60); setAdjusting(false); } }}><label>Time left in your journey<input type="number" min={1} max={180} value={minutes} onChange={event => setMinutes(Number(event.target.value))} /> minutes</label><button className="secondary-button">Fit my listen</button></form>}
    <div className="player-actions"><button onClick={onTranscript}><BookOpen size={16} />Transcript</button><button onClick={onSources}><Route size={16} />{episode.plan.sources.length} sources</button></div>
    <div className="chapters">{episode.plan.chunks.map((item, index) => <button type="button" key={item.id} className={index === chapterIndex ? "current" : ""} onClick={() => { const target = episode.plan.chunks.slice(0, index).reduce((sum, chunk) => sum + (episode.audio.find(sound => sound.id === chunk.id)?.durationSeconds || chunk.targetSeconds), 0); onSeek(target); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><small>{timeLabel(item.targetSeconds)}</small></button>)}</div>
    {status && <p className="player-status" role="status">{status}</p>}
  </section>;
}

export function FigmaThirtyHours({ initialDemo = false }: { initialDemo?: boolean }) {
  const [view, setView] = useState<View>("create");
  const [demo, setDemo] = useState(initialDemo);
  const [online, setOnline] = useState(true);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [capabilities, setCapabilities] = useState<AppCapabilities>();
  const [trip, setTrip] = useState<Trip>();
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [dismissedQuizEpisode, setDismissedQuizEpisode] = useState<string>();
  const [showSources, setShowSources] = useState(false);
  const lastAdaptedAt = useRef(0);
  const episodeRef = useRef<SavedEpisode | undefined>(undefined);
  const tripRef = useRef<Trip | undefined>(undefined);
  const adaptRef = useRef<(seconds: number) => Promise<void>>(async () => {});
  const updatingRoute = useRef(false);
  const onError = useCallback((message: string) => setError(message), []);
  const session = useEpisode(onError);

  useEffect(() => { episodeRef.current = session.episode; tripRef.current = trip; adaptRef.current = session.adapt; }, [session.episode, trip, session.adapt]);
  useEffect(() => {
    let alive = true;
    void Promise.all([getPreferences().catch(() => undefined), requestJson<AppCapabilities>("/api/config").catch(() => undefined)]).then(([saved, config]) => {
      if (!alive) return;
      if (saved) setPreferences(saved);
      if (config) setCapabilities(config);
    });
    const connection = () => setOnline(navigator.onLine);
    connection(); window.addEventListener("online", connection); window.addEventListener("offline", connection);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    return () => { alive = false; window.removeEventListener("online", connection); window.removeEventListener("offline", connection); };
  }, []);

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
      const origin = currentTrip.origin.id === "current-location" ? await new Promise<Trip["origin"]>((resolve, reject) => navigator.geolocation.getCurrentPosition(value => resolve({ ...currentTrip.origin, lat: value.coords.latitude, lng: value.coords.longitude }), reject, { timeout: 8000, maximumAge: 60000 })) : currentTrip.origin;
      const result = await requestJson<{ trips: Trip[] }>("/api/route", { origin, destination: currentTrip.destination, mode: currentTrip.mode });
      const route = result.trips.find(item => item.id === currentTrip.id) || result.trips[0];
      if (!route) return;
      const oldRemaining = remainingBudget(currentTrip.arrivalTime);
      const arrivalTime = route.mode === "TRANSIT" && route.transitArrivalTime ? route.transitArrivalTime : Date.now() + route.durationSeconds * 1000;
      const next = { ...route, arrivalTime };
      setTrip(next); tripRef.current = next; session.updateTrip(next);
      const newRemaining = remainingBudget(arrivalTime);
      if (shouldReplan(oldRemaining, newRemaining) && episodeRef.current?.id === episode.id && Date.now() - lastAdaptedAt.current > 30000) { lastAdaptedAt.current = Date.now(); await adaptRef.current(newRemaining); }
    } catch { /* Keep the last known route and arrival estimate. */ }
    finally { updatingRoute.current = false; }
  }, [session.updateTrip]);

  useEffect(() => {
    if (!session.episode || demo) return;
    const delay = session.episode.trip.origin.id === "current-location" ? 30000 : 60000;
    const interval = window.setInterval(() => void updateRoute(), delay);
    const visibility = () => { if (document.visibilityState === "visible") void updateRoute(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", visibility); };
  }, [session.episode?.id, demo, updateRoute]);

  const start = useCallback(async ({ source, interests, language }: StartInput) => {
    if (!trip) { setError("Choose a journey first. A good idea needs somewhere to go."); return; }
    if (!demo && !capabilities?.openai) { setError("Lesson generation needs a configured OpenAI API key. The prepared demo is ready to explore."); return; }
    if (!demo && !capabilities?.voice) { setError("Spoken audio needs an OpenAI API key with Realtime access. Your saved listens are still here."); return; }
    setError(""); setTranscriptOpen(false);
    await session.start({ trip, source, interests, language }, demo);
    if (!preferences.onboarded) commitPreferences({ interests, language, onboarded: true });
    setView("listen");
  }, [trip, capabilities, demo, session.start, preferences.onboarded, commitPreferences]);

  const selectEpisode = useCallback((episode: SavedEpisode) => {
    setView("listen"); setDemo(Boolean(episode.plan.demo)); setTrip(episode.trip); tripRef.current = episode.trip;
    setTranscriptOpen(false); session.resume(episode);
  }, [session.resume]);

  const simulateArrival = useCallback(async (remainingSeconds: number) => {
    const currentTrip = tripRef.current;
    if (currentTrip) {
      const next = { ...currentTrip, durationSeconds: remainingSeconds, arrivalTime: Date.now() + remainingSeconds * 1000 };
      setTrip(next); tripRef.current = next; session.updateTrip(next);
    }
    await session.adapt(remainingSeconds);
  }, [session.adapt, session.updateTrip]);

  const removeEpisode = useCallback(async (id: string) => { try { await deleteEpisode(id); await session.refreshLibrary(); } catch (problem) { onError(readableError(problem)); } }, [session.refreshLibrary, onError]);
  const current = session.episode;
  const quizAutomaticallyVisible = Boolean(session.completed && online && current?.plan.quiz.length && session.status.startsWith("A few questions") && dismissedQuizEpisode !== current.id);
  const currentChapter = session.chunk?.title || "Your first chapter is taking shape";
  const chapterIndex = current?.plan.chunks.findIndex(item => item.id === session.chunk?.id) ?? -1;

  return <FigmaShell view={view} onNavigate={setView}>
    {view === "create" && <main className="create-page">
      <JourneyIntro />
      <section className="planner" id="journey-planner"><div className="section-label"><span>01</span> Plan your journey</div><TripBuilder key={demo ? "demo-trip-builder" : "live-trip-builder"} design="figma" demo={demo} capabilities={capabilities} onTrip={value => { setTrip(value); tripRef.current = value; }} onLoading={setRouteLoading} onInvalidate={() => { setTrip(undefined); tripRef.current = undefined; }} /></section>
      <FigmaSourceComposer onStart={start} generating={session.generating} preferences={preferences} onPreferences={commitPreferences} disabled={!trip || routeLoading} />
      {error && <div className="notice notice-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss message">×</button></div>}
    </main>}

    {view === "listen" && current && <main className="listen-page">
      <section className="listen-art"><button className="back-link" onClick={() => setView("create")}>← Journey</button><RouteCard trip={current.trip} /><p>{current.trip.origin.label} → {current.trip.destination.label}</p></section>
      <FigmaEpisodePlayer episode={current} currentChapter={currentChapter} chapterIndex={chapterIndex} progress={session.progress} duration={session.duration} playing={session.playing} buffering={session.buffering} offlineProgress={session.downloadProgress} status={session.adapting ? "Finding room for a little more." : session.status} onToggle={session.toggle} onSeek={session.seek} onSkip={session.skip} onDownload={session.download} onTranscript={() => setTranscriptOpen(true)} onSources={() => setShowSources(true)} onAdjust={simulateArrival} />
    </main>}
    {view === "listen" && !current && <main className="simple-page"><p className="eyebrow">YOUR LISTEN</p><h1>Your next idea<br /><em>is taking shape.</em></h1><p className="lede" role="status">{session.status || "Finding the thread for your journey…"}</p></main>}

    {view === "library" && <main className="simple-page"><p className="eyebrow">YOUR LIBRARY</p><h1>Listens worth<br /><em>returning to.</em></h1>{session.library.length === 0 ? <p className="lede">Your saved listens will find a home here.</p> : session.library.map(episode => <article className="library-item" key={episode.id}><div className="mini-art">30</div><div><small>{episode.trip.destination.label} · {Math.ceil(episode.plan.targetSeconds / 60)} MIN</small><h2>{episode.plan.title}</h2><p>{episode.plan.chunks.length} chapters · {languageLabel(episode.plan.language)}</p></div><button aria-label={`Play ${episode.plan.title}`} onClick={() => selectEpisode(episode)}><Play size={19} fill="currentColor" /></button><button className="library-delete" aria-label={`Delete ${episode.plan.title}`} onClick={() => removeEpisode(episode.id)}><Trash2 size={16} /></button></article>)}</main>}

    {view === "interests" && <main className="simple-page interests-page"><p className="eyebrow">YOUR CURIOSITY</p><h1>What should the road<br /><em>teach you?</em></h1><p className="lede">Choose a few interests. We’ll use them to shape future listens.</p><div className="large-topics">{[...new Set([...topics, ...preferences.interests])].map(topic => <button type="button" key={topic} className={preferences.interests.includes(topic) ? "selected" : ""} onClick={() => commitPreferences({ ...preferences, interests: preferences.interests.includes(topic) ? preferences.interests.filter(item => item !== topic) : [...preferences.interests, topic] })}>{topic}<span>{preferences.interests.includes(topic) ? <Check size={16} /> : "+"}</span></button>)}</div><label className="pref-label">PREFERRED LANGUAGE</label><div className="language-row">{([{ id: "en", label: "English" }, { id: "hi", label: "Hindi" }, { id: "hinglish", label: "Hinglish" }] as const).map(language => <button type="button" className={preferences.language === language.id ? "selected" : ""} onClick={() => commitPreferences({ ...preferences, language: language.id })} key={language.id}>{language.label}</button>)}</div></main>}

    {session.generating && !current && <p className="ready-note" role="status">Preparing your listen…</p>}
    {!online && <div className="offline-ribbon" role="status">Offline. Downloaded listens are ready when you are.</div>}
    {transcriptOpen && current && <Transcript episode={current} onClose={() => setTranscriptOpen(false)} onChapter={index => { const target = current.plan.chunks.slice(0, index).reduce((sum, item) => sum + (current.audio.find(sound => sound.id === item.id)?.durationSeconds || item.targetSeconds), 0); session.seek(target); session.toggle(); }} />}
    {quizAutomaticallyVisible && current && <QuizDialog episode={current} onClose={() => { if (session.completed) setDismissedQuizEpisode(current.id); }} onComplete={results => { session.saveResults(results); setDismissedQuizEpisode(current.id); }} />}
    {showSources && current && <Modal title="A little further reading" onClose={() => setShowSources(false)} className="sources-dialog"><h2>{current.plan.title}</h2><p className="dialog-lead">Stories and research that shaped this listen.</p><div className="episode-sources">{current.plan.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>{source.title}<small>{source.retrievedAt ? "As of " + new Date(source.retrievedAt).toLocaleDateString() : "Source article"}</small></span><ArrowRight size={15} /></a>)}</div></Modal>}
  </FigmaShell>;
}
