"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, ArrowRight, Bike, CarFront, Check, ChevronDown, Footprints, LocateFixed, MapPin, Navigation, TrainFront } from "lucide-react";
import { demoTrip } from "@/lib/demo";
import type { AppCapabilities, Place, TravelMode, Trip } from "@/lib/types";

const demoOrigin = demoTrip.origin;
const demoDestination = demoTrip.destination;
const modes = [{ id: "DRIVE", label: "Car", Icon: CarFront }, { id: "TRANSIT", label: "Transit", Icon: TrainFront }, { id: "TWO_WHEELER", label: "Bike", Icon: Bike }, { id: "WALK", label: "Walk", Icon: Footprints }, { id: "BICYCLE", label: "Cycle", Icon: Bike }] as const;

function makeDemoTrip(origin: Place, destination: Place, mode: TravelMode): Trip {
  return { ...demoTrip, id: "pune-demo-route", origin, destination, mode, arrivalTime: Date.now() + demoTrip.durationSeconds * 1000 };
}

function PlaceSearch({ label, value, onChange, placeholder, location }: { label: string; value?: Place; onChange: (place: Place | undefined) => void; placeholder: string; location?: boolean }) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (query.length < 3 || value) return;
    const timer = setTimeout(async () => {
      controller.current?.abort(); controller.current = new AbortController(); setBusy(true); setError("");
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`, { signal: controller.current.signal });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "We couldn’t find places. Try again.");
        setResults(data.places ?? []); setHighlighted(0); if (!data.places?.length) setError("No places found. Try a nearby landmark.");
      } catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); }
      finally { setBusy(false); }
    }, 400);
    return () => { clearTimeout(timer); controller.current?.abort(); };
  }, [query, value]);
  function locate() {
    if (!navigator.geolocation) { setError("Location is unavailable. Enter your starting point."); return; }
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition(p => { onChange({ id: "current-location", label: "Your current location", lat: p.coords.latitude, lng: p.coords.longitude }); setBusy(false); }, () => { setBusy(false); setError("Location access was unavailable. Enter your starting point."); }, { timeout: 12000, maximumAge: 60000 });
  }
  return <div className="place-field"><label className="field-label">{label}<span className="place-input-wrap"><MapPin size={16} aria-hidden="true" /><input value={value?.label ?? query} placeholder={placeholder} autoComplete="off" onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 180)} onChange={e => { setQuery(e.target.value); setResults([]); onChange(undefined); }} onKeyDown={e => { if (e.key === "Escape") setFocused(false); if (!results.length) return; if (e.key === "ArrowDown") { e.preventDefault(); setFocused(true); setHighlighted(i => (i + 1) % results.length); } if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(i => (i - 1 + results.length) % results.length); } if (e.key === "Enter" && focused) { e.preventDefault(); onChange(results[highlighted]); setFocused(false); setResults([]); } }} aria-label={label} aria-expanded={focused && results.length > 0} aria-controls={`places-${label}`} aria-activedescendant={focused && results.length ? `place-${label}-${highlighted}` : undefined} role="combobox" />{location && <button type="button" title="Use current location" aria-label="Use current location" className="icon-button location-button" onClick={locate}><LocateFixed size={17} /></button>}</span></label>{focused && results.length > 0 && <ul className="place-results" id={`places-${label}`} role="listbox">{results.map((place, i) => <li key={place.id} role="option" id={`place-${label}-${i}`} aria-selected={highlighted === i}><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(place); setFocused(false); setResults([]); }}><MapPin size={15} /><span>{place.label}</span></button></li>)}</ul>}{busy && <span className="field-hint">Finding your way…</span>}{error && <span className="field-error" role="status">{error}</span>}</div>;
}

export function TripBuilder({ onTrip, demo, capabilities, onLoading, onInvalidate, design }: { onTrip: (trip: Trip) => void; demo: boolean; capabilities?: AppCapabilities; onLoading?: (loading: boolean) => void; onInvalidate?: () => void; design?: "figma" }) {
  const [origin, setOrigin] = useState<Place | undefined>(demo ? demoOrigin : undefined);
  const [destination, setDestination] = useState<Place | undefined>(demo ? demoDestination : undefined);
  const [mode, setMode] = useState<TravelMode>("DRIVE");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modeDurations, setModeDurations] = useState<Partial<Record<TravelMode, number>>>({});
  const onTripRef = useRef(onTrip);
  const onLoadingRef = useRef(onLoading);
  const onInvalidateRef = useRef(onInvalidate);
  onTripRef.current = onTrip;
  onLoadingRef.current = onLoading;
  onInvalidateRef.current = onInvalidate;
  async function findRoutes() {
    setError("");
    if (!origin || !destination) { setError("Choose a starting point and destination from the suggestions."); return; }
    setBusy(true); onLoading?.(true);
    try {
      let next: Trip[];
      if (demo) next = [makeDemoTrip(origin, destination, mode)];
      else { const response = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin, destination, mode }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "We couldn’t find a route. Please try again."); next = data.trips ?? []; }
      if (!next.length) throw new Error("No route found for this travel mode. Try another way to get there.");
      setTrips(next); setSelected(next[0].id); onTrip(next[0]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); onLoading?.(false); }
  }
  useEffect(() => {
    if (!design || !origin || !destination) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(async () => {
      setError(""); setBusy(true); onLoadingRef.current?.(true);
      try {
        let next: Trip[];
        if (demo) next = [makeDemoTrip(origin, destination, mode)];
        else {
          const response = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin, destination, mode }), signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "We couldn’t find a route. Please try again.");
          next = data.trips ?? [];
        }
        if (!active) return;
        if (!next.length) throw new Error("No route found for this travel mode. Try another way to get there.");
        setTrips(next); setSelected(next[0].id);
        setModeDurations(previous => ({ ...previous, [mode]: next[0].durationSeconds }));
        onTripRef.current(next[0]);
      } catch (problem) {
        if (active && (problem as Error).name !== "AbortError") { setTrips([]); setSelected(""); onInvalidateRef.current?.(); setError((problem as Error).message); }
      } finally {
        if (active) { setBusy(false); onLoadingRef.current?.(false); }
      }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [design, origin?.id, destination?.id, mode, demo]);

  if (design === "figma") {
    const activeTrip = trips.find(item => item.id === selected);
    return <div className="figma-trip-builder">
      <div className="route-grid">
        <div className="route-line" aria-hidden="true"><i /><b /><i /></div>
        <PlaceSearch key={`figma-from-${demo}`} label="FROM" value={origin} onChange={place => { setOrigin(place); setTrips([]); onInvalidate?.(); }} placeholder="Choose your starting point" location />
        <PlaceSearch key={`figma-to-${demo}`} label="TO" value={destination} onChange={place => { setDestination(place); setTrips([]); onInvalidate?.(); }} placeholder="Where are you headed?" />
      </div>
      {demo && <span className="demo-tag">PUNE DEMO · 40 MIN</span>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {!demo && capabilities && !capabilities.maps && <p className="field-hint">Live routes are unavailable right now. Try the prepared demo.</p>}
      <div className="journey-summary">
        <div><span className="big-time">{activeTrip ? Math.ceil(activeTrip.durationSeconds / 60) : "—"}</span><span>MIN<br />JOURNEY</span></div>
        <div className="mode-picker" role="group" aria-label="Travel mode">
          {modes.slice(0, 4).map(({ id, label }) => <button type="button" key={id} className={mode === id ? "selected" : ""} onClick={() => { setMode(id); setTrips([]); setSelected(""); onInvalidate?.(); }} aria-pressed={mode === id}>{label}<small>{modeDurations[id] ? `${Math.ceil(modeDurations[id]! / 60)} min` : "— min"}</small></button>)}
        </div>
      </div>
      {busy && <p className="ready-note" role="status"><i />Finding the way there…</p>}
    </div>;
  }
  return <section className="trip-builder" aria-labelledby="trip-heading"><div className="section-top"><span className="step-number">01</span><h3 id="trip-heading">Where are you headed?</h3><span className="small-note">Set your pace</span></div><div className="travel-modes" aria-label="Travel mode">{modes.map(({ id, label, Icon }) => <button type="button" key={id} className={mode === id ? "mode active" : "mode"} onClick={() => { setMode(id); setTrips([]); onInvalidate?.(); }} aria-pressed={mode === id}><Icon size={17} /><span>{label}</span></button>)}</div><div className="route-fields"><PlaceSearch key={`from-${demo}`} label="FROM" value={origin} onChange={place => { setOrigin(place); setTrips([]); onInvalidate?.(); }} placeholder="Your starting point" location /><button type="button" aria-label="Swap starting point and destination" className="swap-button" onClick={() => { setOrigin(destination); setDestination(origin); setTrips([]); onInvalidate?.(); }}><ArrowDownUp size={15} /></button><PlaceSearch key={`to-${demo}`} label="TO" value={destination} onChange={place => { setDestination(place); setTrips([]); onInvalidate?.(); }} placeholder="Where to?" /></div>{demo && <p className="field-hint">Pune commute: a 40-minute prepared route and a 4-minute sample listen.</p>}{!demo && capabilities && !capabilities.maps && <p className="field-hint">Live routes are unavailable right now. Try a demo journey.</p>}{error && <p className="inline-error" role="alert">{error}</p>}<button className="route-submit" onClick={findRoutes} disabled={busy || (!demo && capabilities !== undefined && !capabilities.maps)}>{busy ? "Finding your route…" : trips.length ? "Update my route" : "Find my route"}<ArrowRight size={17} /></button>{trips.length > 0 && <div className="route-options" aria-label="Available routes">{trips.map((trip, i) => <button key={trip.id} className={`route-option ${selected === trip.id ? "selected" : ""}`} onClick={() => { setSelected(trip.id); onTrip(trip); }}><span className="route-radio">{selected === trip.id && <Check size={11} />}</span><span><strong>{Math.ceil(trip.durationSeconds / 60)} min</strong><small>{(trip.distanceMeters / 1000).toFixed(1)} km · {trip.demo ? "Demo journey" : trip.summary || `Route ${i + 1}`}</small></span><span className="route-tag">{i === 0 ? "Recommended" : "Alternative"}</span></button>)}</div>}</section>;
}

interface GoogleMapInstance { fitBounds(bounds: unknown, padding?: number): void }
interface GoogleMapsApi { Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance; Marker: new (options: Record<string, unknown>) => unknown; Polyline: new (options: Record<string, unknown>) => unknown; LatLngBounds: new () => { extend(point: {lat: number; lng: number}): void } }

function projectRouteToSvg(trip: Trip) {
  const route = trip.polyline ? decodePolyline(trip.polyline) : [];
  const points = [trip.origin, ...route.slice(1, -1), trip.destination];
  const width = 600, height = 240, padding = 56;
  const minLat = Math.min(...points.map(point => point.lat));
  const maxLat = Math.max(...points.map(point => point.lat));
  const minLng = Math.min(...points.map(point => point.lng));
  const maxLng = Math.max(...points.map(point => point.lng));
  const latRange = Math.max(maxLat - minLat, 0.001);
  const lngRange = Math.max(maxLng - minLng, 0.001);
  const scale = Math.min((width - padding * 2) / lngRange, (height - padding * 2) / latRange);
  const offsetX = (width - lngRange * scale) / 2;
  const offsetY = (height - latRange * scale) / 2;
  const projected = points.map(point => ({
    x: offsetX + (point.lng - minLng) * scale,
    y: height - offsetY - (point.lat - minLat) * scale,
  }));
  return {
    path: projected.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" "),
    start: projected[0],
    end: projected.at(-1)!,
    hasRouteGeometry: route.length > 2,
  };
}

export function RouteCard({ trip }: { trip: Trip }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const localRoute = projectRouteToSvg(trip);
  useEffect(() => {
    if (trip.demo || !key || !mapRef.current) return;
    let active = true;
    const init = () => {
      if (!active || !mapRef.current) return;
      const google = (window as unknown as { google?: { maps: GoogleMapsApi } }).google;
      if (!google) { setMapFailed(true); return; }
      try {
        const map = new google.maps.Map(mapRef.current, { center: trip.origin, zoom: 12, disableDefaultUI: true, zoomControl: true, styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }, { featureType: "all", elementType: "geometry", stylers: [{ saturation: -75 }] }] });
        const points = trip.polyline ? decodePolyline(trip.polyline) : [trip.origin, trip.destination];
        const bounds = new google.maps.LatLngBounds(); points.forEach(point => bounds.extend(point)); map.fitBounds(bounds, 45);
        new google.maps.Marker({ position: trip.origin, map, title: "Starting point" }); new google.maps.Marker({ position: trip.destination, map, title: "Destination" });
        if (trip.polyline) new google.maps.Polyline({ path: points, map, strokeColor: "#d65c36", strokeOpacity: 1, strokeWeight: 5 });
      } catch { setMapFailed(true); }
    };
    if ((window as unknown as { google?: unknown }).google) init(); else { let script = document.getElementById("google-maps-script") as HTMLScriptElement | null; if (!script) { script = document.createElement("script"); script.id = "google-maps-script"; script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`; script.async = true; document.head.appendChild(script); } script.addEventListener("load", init); script.addEventListener("error", () => setMapFailed(true)); return () => { active = false; script?.removeEventListener("load", init); }; }
    return () => { active = false; };
  }, [trip, key]);
  return <div className="route-map-card">
    {trip.demo ? <div className="illustrated-map">
      <svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMid meet" fill="none" role="img" aria-label={`Demo route from ${trip.origin.label} to ${trip.destination.label}`}><path d="M0 30H600M0 75H600M0 120H600M0 165H600M0 210H600M60 0V240M145 0V240M230 0V240M315 0V240M400 0V240M485 0V240M570 0V240" stroke="#d8d8c6" strokeWidth="10" /><path d="M-10 190 610 22M90 -10 260 250M500 -10 350 250" stroke="#ecebdf" strokeWidth="16" /><path d={localRoute.path} stroke="#f2efe6" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" /><path d={localRoute.path} stroke="#d56841" strokeWidth="5" strokeDasharray={localRoute.hasRouteGeometry ? undefined : "9 7"} strokeLinecap="round" strokeLinejoin="round" /><circle cx={localRoute.start.x} cy={localRoute.start.y} r="9" fill="#333d35" stroke="#faf7ec" strokeWidth="4" /><circle cx={localRoute.end.x} cy={localRoute.end.y} r="10" fill="#dc7046" stroke="#faf7ec" strokeWidth="4" /></svg>
      <span className="map-label map-origin">{trip.origin.label}</span><span className="map-label map-destination">{trip.destination.label}</span><span className="map-demo">Pune demo route</span>
    </div> : key && !mapFailed ? <div className="google-map" ref={mapRef} aria-label="Your selected route map" /> : <div className="illustrated-map route-illustration">
      <svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMid meet" fill="none" role="img" aria-label={`Route from ${trip.origin.label} to ${trip.destination.label}`}>
        <path d="M0 30H600M0 75H600M0 120H600M0 165H600M0 210H600M60 0V240M145 0V240M230 0V240M315 0V240M400 0V240M485 0V240M570 0V240" stroke="#d8d8c6" strokeWidth="10" />
        <path d="M-10 190 610 22M90 -10 260 250M500 -10 350 250" stroke="#ecebdf" strokeWidth="16" />
        <path d={localRoute.path} stroke="#f2efe6" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
        <path d={localRoute.path} stroke="#d56841" strokeWidth="5" strokeDasharray={localRoute.hasRouteGeometry ? undefined : "9 7"} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={localRoute.start.x} cy={localRoute.start.y} r="9" fill="#333d35" stroke="#faf7ec" strokeWidth="4" />
        <circle cx={localRoute.end.x} cy={localRoute.end.y} r="10" fill="#dc7046" stroke="#faf7ec" strokeWidth="4" />
      </svg>
      <span className="map-label map-origin" title={trip.origin.label}>{trip.origin.label}</span><span className="map-label map-destination" title={trip.destination.label}>{trip.destination.label}</span><span className="map-demo">{localRoute.hasRouteGeometry ? "Route preview" : "Direct route estimate"}</span>
    </div>}
    <div className="map-caption"><span><Navigation size={13} /> {trip.demo ? "A sample route, a real possibility." : "A little learning, along the way."}</span>{!trip.demo && key && !mapFailed && <small className="google-attribution">Powered by Google, © {new Date().getFullYear()} Google</small>}<strong>{Math.ceil(trip.durationSeconds / 60)} min<ChevronDown size={12} /></strong></div>
  </div>;
}

function decodePolyline(encoded: string) { const points: { lat: number; lng: number }[] = []; let i = 0, lat = 0, lng = 0; while (i < encoded.length) { let shift = 0, result = 0, byte: number; do { byte = encoded.charCodeAt(i++) - 63; result |= (byte & 31) << shift; shift += 5; } while (byte >= 32 && i < encoded.length); lat += result & 1 ? ~(result >> 1) : result >> 1; shift = 0; result = 0; do { byte = encoded.charCodeAt(i++) - 63; result |= (byte & 31) << shift; shift += 5; } while (byte >= 32 && i < encoded.length); lng += result & 1 ? ~(result >> 1) : result >> 1; points.push({ lat: lat / 1e5, lng: lng / 1e5 }); } return points; }
