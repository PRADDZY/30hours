# 30hours

**A little further, one idea at a time.** 30hours turns the time in a trip into a spoken lesson that fits the journey, then invites you to reflect on what stayed with you.

## What is here

- A phone-first Next.js app with destination search, route estimates, and an illustrated route view.
- AI lesson plans from interests, notes, PDFs, or web articles, with sourced discovery when no material is supplied.
- Chapter audio generated with OpenAI Realtime. The player measures actual audio duration and can adapt the remaining lesson when the ETA changes.
- A short spoken quiz with microphone answers, transcription, AI feedback, typed answers, and an arrival deadline.
- Local episode and preference storage in IndexedDB, offline playback, and a prepared English, Hindi, and Hinglish demo at `/demo`.

## Run locally

Use Node.js 22 or newer.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
```

Add your API keys to `.env.local`:

```dotenv
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_AUDIO_API_KEY=your_openai_api_key
OPENAI_AUDIO_BASE_URL=https://api.openai.com/v1
OPENAI_TEXT_MODEL=gpt-6.1-sol
OPENAI_VOICE_MODEL=gpt-realtime-2.1-mini
OPENAI_TRANSCRIBE_MODEL=gpt-transcribe
OPENAI_VOICE=marin
GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_restricted_maps_key
```

The OpenAI key needs access to the configured Responses, Realtime audio, and transcription models. The separate audio key and base URL let you use a voice provider credential independently. Enable Google Places, Maps JavaScript, and Routes APIs for the Google Cloud project. Restrict the browser Maps key to the app's HTTP referrers and Maps JavaScript API; keep the server Maps key restricted to the Routes and Places APIs. Never commit `.env.local`, `maps.txt`, or any key.

Start the app:

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`. The `/demo` page uses prepared route and audio fixtures and does not require API keys. To regenerate those assets, set the OpenAI audio values above and run `npm.cmd run demo:audio`.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## Architecture

- `src/app/api/` contains server-only handlers for configuration, routes, source extraction, planning, audio, replanning, and quiz operations.
- `src/lib/timing.ts` schedules essential, optional, and recap chapters against measured available time.
- `src/lib/storage.ts` stores episode metadata and audio blobs in IndexedDB.
- `src/hooks/use-episode.ts` coordinates playback, background chapter generation, offline saves, and replanning.
- `public/demo/manifest.json` describes the prepared demo episodes; demo audio is checked in so the walkthrough works without model calls.
- `public/sw.js` caches the app shell and static demo assets for repeat visits and offline use.

## Deploy to Cloudflare Workers

This app uses the OpenNext Cloudflare adapter. Install dependencies, then preview the Worker locally with `npm.cmd run cf:preview`. Run `npm.cmd run cf:secrets` to upload the server keys from `.env.local` as Cloudflare Worker secrets. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is included at build time for the live map preview. Run `npm.cmd run cf:deploy` to publish. Do not upload `maps.txt` or `.env.local`. The demo works without provider keys; live route, lesson, and voice features need the matching provider keys and API access.

The live narrator accepts scripts up to 75 seconds per generated chapter. Longer lessons are split into chapters. Realtime generation and route updates require a network connection; fully downloaded episodes play offline. The quiz requires network access for transcription and grading.
