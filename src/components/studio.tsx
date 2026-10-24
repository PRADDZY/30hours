"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, AudioLines, Bookmark, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, FileText, Globe2, Headphones, Heart, Home, Leaf, Link2, LoaderCircle, MoreHorizontal, Pause, Play, Plus, RefreshCw, Route, Settings2, SkipBack, SkipForward, Sparkles, Trash2, Upload, WifiOff, X } from "lucide-react";
import type { Language, Preferences, SavedEpisode, SourceMaterial } from "@/lib/types";
export { RouteCard } from "./trip-builder";
export { TripBuilder } from "./trip-builder";
export type View = "studio" | "library" | "interests";
export type StartInput = { source?: SourceMaterial; interests: string[]; language: Language };
export const interestOptions = ["Design & creativity", "Science & space", "Business & money", "History & culture", "Technology & AI", "Mind & wellbeing", "Books & ideas", "The world around us"];
const languages: { id: Language; label: string }[] = [{ id: "en", label: "English" }, { id: "hi", label: "हिन्दी" }, { id: "hinglish", label: "Hinglish" }];

export function AppShell({ children, view, onNavigate, online, demo, onToggleDemo }: { children: ReactNode; view: View; onNavigate: (view: View) => void; online: boolean; demo: boolean; onToggleDemo: () => void }) {
  const nav = [{ id: "studio" as const, label: "Your studio", Icon: Home }, { id: "library" as const, label: "Your library", Icon: Bookmark }, { id: "interests" as const, label: "Your interests", Icon: Heart }];
  return <div className="app-layout"><aside className="sidebar"><button className="brand-symbol" aria-label="30hours home" onClick={() => onNavigate("studio")}><span>30</span><i /></button><div className="sidebar-nav">{nav.map(({ id, label, Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} aria-label={label} title={label} aria-current={view === id ? "page" : undefined} onClick={() => onNavigate(id)}><Icon size={21} strokeWidth={1.65} /><span>{label}</span></button>)}</div><div className="sidebar-bottom"><span className="sidebar-line" /><button className="nav-item" title="Listening preferences" aria-label="Listening preferences" onClick={() => onNavigate("interests")}><Settings2 size={21} strokeWidth={1.65} /><span>Preferences</span></button><div className="avatar" title="Your little corner">P<span /></div></div></aside><div className="app-main"><header className="topbar"><button className="wordmark" onClick={() => onNavigate("studio")}>30hours<span className="wordmark-dot">.</span></button><div className="topbar-center"><span className="tiny-spark">✳</span> TIME WELL SPENT.</div><div className="topbar-right">{!online && <span className="offline-badge"><WifiOff size={12} />Offline</span>}<button className={`demo-toggle ${demo ? "is-demo" : ""}`} onClick={onToggleDemo} aria-pressed={demo}><span className="status-dot" />{demo ? "Demo mode" : "Live mode"}<span className="toggle-track"><i /></span></button><span className="header-divider" /><span className="hello-note">A little more you.</span><div className="header-avatar">P</div></div></header><main className="main-content">{children}</main><footer className="footer"><span>Made for the time in between.</span><span>30hours <span>© {new Date().getFullYear()}</span></span><span>Less scrolling. More becoming.<Leaf size={13} /></span></footer></div></div>;
}

export function StudioHero() {
  return <><div className="page-intro"><div><div className="eyebrow"><span className="mini-sun">✳</span> THE EVERYDAY, REIMAGINED</div><h1>Your time. A little more yours.</h1></div><div className="today-note"><span className="round-icon"><Headphones size={17} /></span><span>A good day to<br /><strong>learn something new.</strong></span></div></div><section className="hero"><div className="hero-copy"><div className="hero-kicker"><span />MAKE THE IN-BETWEEN COUNT</div><h2>Same journey.<br /><em>New perspective.</em></h2><p>Turn the way there into a way forward.<br />Personal audio, made for your journey.</p><a href="#journey-studio" className="hero-link">Let’s make your next listen <ArrowRight size={16} /></a></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="art-star star-one">✳</span><span className="art-star star-two">✦</span><span className="art-star star-three">+</span><div className="record-sleeve"><div className="sleeve-type">A LITTLE<br /><em>further.</em></div><span className="sleeve-label">THE SOUND OF A NEW PERSPECTIVE</span><div className="sleeve-bottom"><span>SIDE A / EVERYDAY</span><AudioLines size={22} /></div></div><div className="vinyl"><div className="vinyl-rings" /><div className="vinyl-label"><span>30</span><small>HOURS</small><i /></div></div><div className="art-sticker"><span>Made for<br /><em>your way.</em></span></div><span className="art-caption">GOOD IDEAS TRAVEL WITH YOU.</span></div><span className="hero-issue">VOL. 001 — THE EVERYDAY EDITION</span></section><div className="benefit-strip"><span><Route size={16} /><strong>Your route.</strong> Your runtime.</span><i /><span><AudioLines size={16} />Curiosity, made listenable.</span><i /><span><Bookmark size={16} />A little knowledge to keep.</span></div></>;
}

export function SourceComposer({ onStart, generating, preferences, onPreferences, disabled }: { onStart: (input: StartInput) => void; generating: boolean; preferences: Preferences; onPreferences: (preferences: Preferences) => void; disabled?: boolean }) {
  const [tab, setTab] = useState<"discovery" | "url" | "pdf" | "notes">("discovery");
  const [source, setSource] = useState<SourceMaterial>();
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const tabs = [{ id: "discovery" as const, name: "For you", Icon: Sparkles }, { id: "url" as const, name: "A link", Icon: Link2 }, { id: "pdf" as const, name: "A PDF", Icon: FileText }, { id: "notes" as const, name: "Your notes", Icon: Plus }];
  function switchTab(next: typeof tab) { setTab(next); setError(""); setSource(undefined); }
  function toggleInterest(interest: string) { onPreferences({ ...preferences, interests: preferences.interests.includes(interest) ? preferences.interests.filter(i => i !== interest) : [...preferences.interests, interest] }); }
  async function loadUrl() {
    setBusy(true); setError(""); setSource(undefined);
    try { const response = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "We couldn’t read that link. Paste its text in Your notes instead."); setSource(data.source); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function loadPdf(file?: File) {
    if (!file) return; setError(""); setSource(undefined);
    if (file.size > 10 * 1024 * 1024) { setError("Choose a PDF smaller than 10 MB."); return; }
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Please choose a PDF file."); return; }
    setBusy(true);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const doc = await loadingTask.promise;
      if (doc.numPages > 100) { await loadingTask.destroy(); throw new Error("Choose a PDF with 100 pages or fewer."); }
      let text = "";
      try { for (let i = 1; i <= doc.numPages; i++) { const page = await doc.getPage(i); const content = await page.getTextContent(); text += content.items.map(item => "str" in item ? item.str : "").join(" ") + "\n"; if (text.length > 200000) throw new Error("This PDF has too much text. Choose a shorter document."); } } finally { await loadingTask.destroy(); }
      if (text.trim().length < 40) throw new Error("This PDF has no readable text. Try a text-based PDF or paste your notes.");
      setSource({ id: crypto.randomUUID(), title: file.name.replace(/\.pdf$/i, ""), text, kind: "pdf" });
    } catch (e) { setError((e as Error).message || "We couldn’t read that PDF. Try another file."); } finally { setBusy(false); }
  }
  function start() {
    setError("");
    let material = source;
    if (tab === "notes") { if (notes.trim().length < 40) { setError("Add at least 40 characters so there’s something to explore."); return; } material = { id: crypto.randomUUID(), title: "Your notes", text: notes.trim(), kind: "notes" }; }
    if ((tab === "url" || tab === "pdf") && !material) { setError(tab === "url" ? "Read your link before making a listen." : "Choose a PDF before making a listen."); return; }
    if (tab === "discovery" && preferences.interests.length === 0) { setError("Pick at least one curiosity to get started."); return; }
    onStart({ source: tab === "discovery" ? undefined : material, interests: preferences.interests, language: preferences.language });
  }
  return <section className="source-composer" aria-labelledby="source-heading"><div className="section-top"><span className="step-number">02</span><h3 id="source-heading">What’s on your mind?</h3><span className="small-note">Feed your curiosity</span></div><div className="source-tabs" role="tablist" aria-label="Choose learning material">{tabs.map(({ id, name, Icon }) => <button type="button" key={id} className={tab === id ? "source-tab active" : "source-tab"} role="tab" aria-selected={tab === id} aria-controls="source-panel" onClick={() => switchTab(id)}><Icon size={15} />{name}</button>)}</div><div className="source-panel" id="source-panel" role="tabpanel">{tab === "discovery" && <><p className="panel-prompt">Follow a familiar interest. Or find a new one.</p><div className="interest-pills">{interestOptions.slice(0, 6).map(interest => <button key={interest} onClick={() => toggleInterest(interest)} aria-pressed={preferences.interests.includes(interest)} className={preferences.interests.includes(interest) ? "interest-pill selected" : "interest-pill"}>{preferences.interests.includes(interest) ? <Check size={12} /> : <Plus size={12} />}{interest}</button>)}</div><p className="source-help"><Sparkles size={12} />A fresh idea, shaped around what moves you.</p></>}{tab === "url" && <><label className="field-label">SOMETHING WORTH A LISTEN<div className="url-field"><Link2 size={16} /><input type="url" value={url} onChange={e => { setUrl(e.target.value); setSource(undefined); }} placeholder="Paste an article or webpage link" /><button onClick={loadUrl} disabled={busy || !url.trim()}>{busy ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={17} />}<span className="sr-only">Read link</span></button></div></label><p className="source-help">We’ll turn the page into a little perspective.</p></>}{tab === "pdf" && <><input className="sr-only" ref={fileRef} type="file" accept="application/pdf,.pdf" aria-label="Upload PDF" onChange={e => loadPdf(e.target.files?.[0])} /><button className="upload-zone" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={21} /><strong>{busy ? "Reading your document…" : "Bring a document along"}</strong><span>Choose a PDF · up to 10 MB & 100 pages</span></button></>}{tab === "notes" && <><label className="sr-only" htmlFor="learning-notes">Notes to learn from</label><textarea id="learning-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="An idea, a chapter, those notes you keep meaning to revisit…" maxLength={200000} /><p className="source-help">A little context goes a long way. At least 40 characters.</p></>}{source && <div className="source-loaded"><CheckCheck size={15} /><span>{source.title}<small>{source.text.length.toLocaleString()} characters ready to explore</small></span><button className="icon-button" aria-label="Remove source" onClick={() => setSource(undefined)}><X size={14} /></button></div>}{error && <p className="inline-error" role="alert">{error}</p>}</div><div className="composer-bottom"><label className="language-control"><Globe2 size={14} /><select aria-label="Episode language" value={preferences.language} onChange={e => onPreferences({ ...preferences, language: e.target.value as Language })}>{languages.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label><span>Made to fit your journey.</span></div><button className="primary-button make-button" onClick={start} disabled={generating || busy || disabled}>{generating ? <><LoaderCircle size={17} className="spin" />Making room for new ideas…</> : <><Headphones size={17} />Make my listen<ArrowRight size={17} /></>}</button></section>;
}

const figmaTopics = ["History", "Design", "Cities", "Music", "Science", "People"];
const figmaSourceTypes = [
  ["discovery", "Explore a topic", "We’ll find a story from your interests"],
  ["url", "Share a webpage", "Turn an article into a listen"],
  ["pdf", "Bring a PDF", "Listen to a document on the move"],
  ["notes", "Add your notes", "Build from thoughts you already have"],
] as const;

export function FigmaSourceComposer({ onStart, generating, preferences, onPreferences, disabled }: { onStart: (input: StartInput) => void; generating: boolean; preferences: Preferences; onPreferences: (preferences: Preferences) => void; disabled?: boolean }) {
  const [kind, setKind] = useState<"discovery" | "url" | "pdf" | "notes">("discovery");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<SourceMaterial>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const allTopics = [...new Set([...figmaTopics, ...preferences.interests])];
  const toggleTopic = (topic: string) => onPreferences({ ...preferences, interests: preferences.interests.includes(topic) ? preferences.interests.filter(item => item !== topic) : [...preferences.interests, topic] });
  const selectKind = (next: typeof kind) => { setKind(next); setSource(undefined); setError(""); };

  async function readUrl() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn’t read that link. Paste its text into your notes instead.");
      setSource(data.source);
    } catch (problem) { setError((problem as Error).message); }
    finally { setBusy(false); }
  }

  async function readPdf(file?: File) {
    if (!file) return;
    setError(""); setSource(undefined);
    if (file.size > 10 * 1024 * 1024) { setError("Choose a PDF smaller than 10 MB."); return; }
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Please choose a PDF file."); return; }
    setBusy(true);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const doc = await loadingTask.promise;
      if (doc.numPages > 100) { await loadingTask.destroy(); throw new Error("Choose a PDF with 100 pages or fewer."); }
      let text = "";
      try { for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) { const page = await doc.getPage(pageNumber); const content = await page.getTextContent(); text += content.items.map(item => "str" in item ? item.str : "").join(" ") + "\n"; if (text.length > 200000) throw new Error("This PDF has too much text. Choose a shorter document."); } }
      finally { await loadingTask.destroy(); }
      if (text.trim().length < 40) throw new Error("This PDF has no readable text. Try a text-based PDF or paste your notes.");
      setSource({ id: crypto.randomUUID(), title: file.name.replace(/\.pdf$/i, ""), text, kind: "pdf" });
    } catch (problem) { setError((problem as Error).message || "We couldn’t read that PDF. Try another file."); }
    finally { setBusy(false); }
  }

  function start() {
    setError("");
    if (kind === "discovery") {
      if (!preferences.interests.length) { setError("Choose at least one interest to get started."); return; }
      onStart({ interests: preferences.interests, language: preferences.language });
      return;
    }
    let material = source;
    if (kind === "notes") {
      if (notes.trim().length < 40) { setError("Add at least 40 characters so there’s something to explore."); return; }
      material = { id: crypto.randomUUID(), title: "Your notes", text: notes.trim(), kind: "notes" };
    }
    if ((kind === "url" || kind === "pdf") && !material) { setError(kind === "url" ? "Read your link before making a listen." : "Choose a PDF before making a listen."); return; }
    onStart({ source: material, interests: preferences.interests, language: preferences.language });
  }

  return <section className="setup">
    <div className="section-label"><span>02</span> Shape your listen</div>
    <div className="setup-grid">
      <div>
        <h2>What do you want<br />to learn from?</h2>
        <div className="lesson-options" role="group" aria-label="Choose learning material">
          {figmaSourceTypes.map(([id, title, subtitle], index) => <button type="button" key={id} onClick={() => selectKind(id)} className={kind === id ? "chosen" : ""} aria-pressed={kind === id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><small>{subtitle}</small></div><ChevronRight size={19} /></button>)}
        </div>
        <div className="figma-source-entry">
          {kind === "url" && <div className="field"><label htmlFor="figma-source-url">WEBPAGE</label><div className="source-entry-row"><input id="figma-source-url" type="url" value={url} onChange={event => { setUrl(event.target.value); setSource(undefined); }} placeholder="Paste an article or webpage link" /><button type="button" onClick={readUrl} disabled={busy || !url.trim()} aria-label="Read webpage">{busy ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={17} />}</button></div></div>}
          {kind === "pdf" && <><input className="sr-only" ref={fileRef} type="file" accept="application/pdf,.pdf" aria-label="Upload PDF" onChange={event => readPdf(event.target.files?.[0])} /><button className="upload-zone" type="button" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={20} /><strong>{busy ? "Reading your document…" : source?.title || "Choose a PDF to bring along"}</strong><span>Up to 10 MB and 100 pages</span></button></>}
          {kind === "notes" && <div className="field"><label htmlFor="figma-learning-notes">YOUR NOTES</label><textarea id="figma-learning-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="An idea, a chapter, those notes you mean to revisit…" maxLength={200000} /></div>}
          {source && <p className="source-loaded"><CheckCheck size={14} />{source.title} · {source.text.length.toLocaleString()} characters ready</p>}
          {error && <p className="inline-error" role="alert">{error}</p>}
        </div>
      </div>
      <div className="preferences">
        <label>LISTEN IN</label>
        <div className="language-row">{([{ id: "en", label: "English" }, { id: "hi", label: "Hindi" }, { id: "hinglish", label: "Hinglish" }] as const).map(language => <button type="button" className={preferences.language === language.id ? "selected" : ""} onClick={() => onPreferences({ ...preferences, language: language.id })} key={language.id}>{language.label}</button>)}</div>
        <label>DRAW FROM YOUR INTERESTS</label>
        <div className="topic-row">{allTopics.map(topic => <button type="button" key={topic} className={preferences.interests.includes(topic) ? "selected" : ""} aria-pressed={preferences.interests.includes(topic)} onClick={() => toggleTopic(topic)}>{topic}</button>)}</div>
        <button className="create-button" type="button" onClick={start} disabled={generating || busy || disabled}><span>{generating ? "Preparing your listen…" : "Create my listen"}</span>{generating ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={19} />}</button>
        <p className="ready-note"><i />{busy ? "Reading your material…" : disabled ? "Choose a journey to continue" : "Your listen will fit the time ahead"}</p>
      </div>
    </div>
  </section>;
}

export function EpisodePlayer({ title, chapter, progress, duration, arrivalTime, isPlaying, onToggle, onSeek, onSkip, buffering, offlineReady, onDownload, downloadProgress, onTranscript, onQuiz, onTrafficChange, status }: { title: string; chapter: string; progress: number; duration: number; arrivalTime: number; isPlaying: boolean; onToggle: () => void; onSeek: (seconds: number) => void; onSkip: (direction: -1 | 1) => void; buffering: boolean; offlineReady: boolean; onDownload: () => void; downloadProgress?: number; onTranscript: () => void; onQuiz: () => void; onTrafficChange: (seconds: number) => void; status?: string }) {
  const [trafficOpen, setTrafficOpen] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [menuOpen, setMenuOpen] = useState(false);
  return <section className="episode-player" aria-label="Episode player"><div className="player-topline"><span><i className={isPlaying ? "playing-dot" : ""} />{buffering ? "PREPARING YOUR LISTEN" : "YOUR JOURNEY, IN SOUND"}</span><button className="icon-button" aria-label="More episode options" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={20} /></button>{menuOpen && <div className="player-menu"><button onClick={() => { setTrafficOpen(!trafficOpen); setMenuOpen(false); }}><Route size={15} />Update remaining journey</button><button onClick={() => { onQuiz(); setMenuOpen(false); }}><CircleHelp size={15} />Test what stayed with you</button></div>}</div><div className="player-body"><div className={`mini-record ${isPlaying ? "rotating" : ""}`} aria-hidden="true"><span>30<i /></span></div><div className="player-info"><span className="eyebrow">A LITTLE FURTHER, ONE IDEA AT A TIME</span><h2>{title}</h2><p>{chapter || "Your next good idea is on its way."}</p><small className="ai-disclosure">AI narrated · generated for your journey</small></div><div className="player-arrival"><span>ARRIVING AROUND</span><strong>{new Date(arrivalTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong><small>Just enough time for a new idea.</small></div></div><div className="player-progress"><label className="sr-only" htmlFor="episode-progress">Playback position</label><input id="episode-progress" type="range" min={0} max={Math.max(duration, 1)} value={Math.min(progress, duration)} onChange={e => onSeek(Number(e.target.value))} style={{ "--progress": `${duration ? progress / duration * 100 : 0}%` } as CSSProperties} /><div><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div></div><div className="player-controls"><div className="player-side"><button className="text-button" onClick={onTranscript}><FileText size={15} /><span>Transcript</span></button><button className="text-button" onClick={onQuiz}><Sparkles size={15} /><span>Reflect</span></button></div><div className="playback-buttons"><button aria-label="Previous chapter" className="icon-button" onClick={() => onSkip(-1)}><SkipBack size={20} fill="currentColor" /></button><button className="play-main" aria-label={isPlaying ? "Pause episode" : "Play episode"} onClick={onToggle} disabled={buffering}>{buffering ? <LoaderCircle size={23} className="spin" /> : isPlaying ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}</button><button aria-label="Next chapter" className="icon-button" onClick={() => onSkip(1)}><SkipForward size={20} fill="currentColor" /></button></div><div className="player-download"><button className="text-button" onClick={onDownload} disabled={downloadProgress !== undefined && downloadProgress < 100}>{offlineReady ? <CheckCheck size={16} /> : <ArrowDownToLine size={16} />}<span>{offlineReady ? "Saved offline" : downloadProgress !== undefined && downloadProgress < 100 ? `Saving ${Math.round(downloadProgress)}%` : "Save offline"}</span></button></div></div>{status && <p className="player-status" role="status">{status}</p>}<div className="traffic-note"><Route size={14} /><span>Plans change. Your listen can, too.</span><button onClick={() => setTrafficOpen(!trafficOpen)}>Adjust journey<ChevronRight size={13} /></button></div>{trafficOpen && <div className="traffic-form"><label>Time left in your journey<input type="number" min={1} max={180} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /> minutes</label><button className="secondary-button" onClick={() => { if (minutes >= 1 && minutes <= 180) { onTrafficChange(minutes * 60); setTrafficOpen(false); } }}>Fit my listen<RefreshCw size={13} /></button></div>}</section>;
}

export function EpisodeLibrary({ episodes, onPlay, onDelete }: { episodes: SavedEpisode[]; onPlay: (episode: SavedEpisode) => void; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState<string>();
  return <section className="library-page"><div className="eyebrow"><Bookmark size={14} /> IDEAS THAT CAME ALONG</div><h1>Your little library.</h1><p className="page-description">Good listens. New perspectives. A few things worth coming back to.</p>{episodes.length === 0 ? <div className="empty-state"><div className="empty-record" aria-hidden="true"><Bookmark size={26} /></div><h2>Something good will live here.</h2><p>Make your first listen in the studio.<br />Your episodes will find a home right here.</p><span className="empty-caption">LESS TO CARRY. MORE TO KEEP.</span></div> : <div className="library-grid">{episodes.map((episode, i) => <article className="library-card" key={episode.id}><div className={`library-art art-${i % 4}`}><span className="library-vol">VOL. {String(i + 1).padStart(3, "0")}</span><span className="library-art-word">{["Another\nangle.", "A little\nfurther.", "Stay\ncurious.", "Good\ncompany."][i % 4]}</span><span className="library-art-mark">✳</span><button className="library-play" aria-label={`Play ${episode.plan.title}`} onClick={() => onPlay(episode)}><Play size={19} fill="currentColor" /></button></div><div className="library-card-info"><div className="library-meta"><span><Clock3 size={12} />{Math.ceil(episode.plan.targetSeconds / 60)} MIN</span>{episode.offlineReady && <span><CheckCheck size={12} />OFFLINE READY</span>}</div><h2>{episode.plan.title}</h2><p>{episode.plan.description}</p><div className="library-card-bottom"><span>{new Date(episode.savedAt).toLocaleDateString([], { day: "numeric", month: "short" })} · {episode.plan.language === "en" ? "English" : episode.plan.language === "hi" ? "Hindi" : "Hinglish"}</span>{deleting === episode.id ? <span className="delete-confirm"><button onClick={() => { onDelete(episode.id); setDeleting(undefined); }}>Delete</button><button aria-label="Cancel deletion" onClick={() => setDeleting(undefined)}><X size={13} /></button></span> : <button aria-label={`Delete ${episode.plan.title}`} className="icon-button" onClick={() => setDeleting(episode.id)}><Trash2 size={14} /></button>}</div></div></article>)}</div>}</section>;
}

export function PreferencesPanel({ preferences, onChange }: { preferences: Preferences; onChange: (preferences: Preferences) => void }) {
  const [custom, setCustom] = useState("");
  const [saved, setSaved] = useState(false);
  function update(next: Preferences) { onChange(next); setSaved(true); setTimeout(() => setSaved(false), 1800); }
  const allInterests = [...new Set([...interestOptions, ...preferences.interests])];
  return <section className="preferences-page"><div className="eyebrow"><Heart size={14} /> A LITTLE MORE YOU</div><h1>Follow your curiosity.</h1><p className="page-description">A few things you love. A few things you’d love to know.<br />We’ll take it from there.</p><div className="preferences-card"><span className="step-number">01</span><h2>What moves you?</h2><p>Pick a few interests. There’s always room for another.</p><div className="interest-pills large">{allInterests.map(interest => <button key={interest} className={`interest-pill ${preferences.interests.includes(interest) ? "selected" : ""}`} aria-pressed={preferences.interests.includes(interest)} onClick={() => update({ ...preferences, interests: preferences.interests.includes(interest) ? preferences.interests.filter(i => i !== interest) : [...preferences.interests, interest] })}>{preferences.interests.includes(interest) ? <Check size={14} /> : <Plus size={14} />}{interest}</button>)}</div><form className="custom-interest" onSubmit={e => { e.preventDefault(); const next = custom.trim().slice(0, 60); if (next && !preferences.interests.includes(next)) update({ ...preferences, interests: [...preferences.interests, next] }); setCustom(""); }}><input placeholder="Something else on your mind?" aria-label="Add your own interest" value={custom} maxLength={60} onChange={e => setCustom(e.target.value)} /><button aria-label="Add interest" disabled={!custom.trim()}><Plus size={19} /></button></form><div className="preferences-divider" /><span className="step-number">02</span><h2>In your own words.</h2><p>Choose the language that feels like you.</p><div className="language-options">{languages.map(l => <button key={l.id} onClick={() => update({ ...preferences, language: l.id })} className={preferences.language === l.id ? "selected" : ""} aria-pressed={preferences.language === l.id}><Globe2 size={16} />{l.label}{preferences.language === l.id && <Check size={14} />}</button>)}</div><p className="saved-note" role="status">{saved ? <><CheckCheck size={14} />A little more you. Preferences saved.</> : <>Your preferences stay with you on this device.</>}</p></div><div className="preferences-quote">“You don’t have to go far<br /><em>to find a new perspective.</em>”<span>THE 30HOURS WAY</span></div></section>;
}

export function Onboarding({ preferences, onSave, onClose }: { preferences: Preferences; onSave: (preferences: Preferences) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(preferences);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,textarea,[tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
    };
    dialog?.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = oldOverflow; dialog?.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop"><section ref={dialogRef} className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-heading"><button className="modal-close icon-button" aria-label="Close welcome" onClick={onClose}><X size={20} /></button><div className="onboarding-art" aria-hidden="true"><span>30</span><i>hours of possibility.</i><span className="onboard-sun">✳</span></div><div className="onboarding-copy"><div className="eyebrow">HELLO, CURIOUS MIND.</div><h2 id="onboarding-heading">A little more<br /><em>out of every day.</em></h2><p>Let’s make your time on the way feel a little more like you. What are you curious about?</p><div className="interest-pills">{interestOptions.slice(0, 6).map(interest => <button key={interest} className={`interest-pill ${draft.interests.includes(interest) ? "selected" : ""}`} aria-pressed={draft.interests.includes(interest)} onClick={() => setDraft({ ...draft, interests: draft.interests.includes(interest) ? draft.interests.filter(i => i !== interest) : [...draft.interests, interest] })}>{draft.interests.includes(interest) ? <Check size={12} /> : <Plus size={12} />}{interest}</button>)}</div><label className="onboard-language">Your listening language<select value={draft.language} onChange={e => setDraft({ ...draft, language: e.target.value as Language })}>{languages.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label><button className="primary-button" disabled={!draft.interests.length} onClick={() => onSave({ ...draft, onboarded: true })}>Find my next perspective<ArrowRight size={17} /></button><small>No account. Just a little curiosity.</small></div></section></div>;
}

export function StudioNotes() {
  return <div className="studio-notes"><div className="note-head"><span className="eyebrow">THE 30HOURS WAY</span><span>01 — 03</span></div><div className="note-grid"><article><span className="note-illustration"><svg viewBox="0 0 80 64" fill="none"><path d="M12 44C20 46 20 16 30 20S33 58 47 41 55 16 68 20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/><circle cx="12" cy="44" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="m63 15 8 5-9 4" stroke="currentColor" strokeWidth="1.5"/><path d="M37 6v11m-5-5h10M62 43v10m-5-5h10" stroke="currentColor"/></svg></span><h3>Made for your in-between.</h3><p>A 12-minute walk or a 40-minute ride.<br />A listen that fits the way you’re going.</p></article><article><span className="note-illustration"><svg viewBox="0 0 80 64" fill="none"><path d="M18 46V19c10-4 14-1 22 3 8-4 12-7 22-3v27c-10-4-14-1-22 3-8-4-12-7-22-3Z" stroke="currentColor" strokeWidth="1.5"/><path d="M40 23v26m-15-23 9 3m-9 5 9 3m12-7 9-3m-9 11 9-3" stroke="currentColor"/><path d="M34 10V5m13 7 3-5" stroke="currentColor"/></svg></span><h3>Your curiosity. Good company.</h3><p>The things you love, or the things<br />you’ve been meaning to understand.</p></article><article><span className="note-illustration"><svg viewBox="0 0 80 64" fill="none"><circle cx="40" cy="29" r="16" stroke="currentColor" strokeWidth="1.5"/><path d="M35 46v7h10v-7M35 56h10M36 44V30l4 4 4-4v14M40 5V0M64 29h7M9 29h7M59 10l5-5M16 5l5 5" stroke="currentColor" strokeWidth="1.5"/></svg></span><h3>Arrive with something new.</h3><p>A new thought. A different angle.<br />Something that stays after the ride.</p></article></div></div>;
}

export function formatTime(seconds: number) { const safe = Math.max(0, Math.floor(seconds)); return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`; }
