# Ignition OS — Voice Capture & Transcription Audit
**Date:** 2026-05-27
**Auditor:** Claude Code
**Scope:** Read-only. No code was modified.
**Purpose:** Establish ground truth on what is real, stubbed, broken, or missing in the Ignition OS voice/transcription stack before any build work begins.

---

## 1. Recording Component

### Files

| File | Platform | Role |
|------|----------|------|
| `packages/ignition-os/modules/IgnitionVoice.jsx` | Web/Expo (JSX) | Primary recording UI |
| `packages/ignition-os/modules/IgnitionVoice.native.js` | React Native (mobile) | Mobile-specific recording variant |
| `packages/ignition-os/hooks/useIgnitionVoice.js` | Web browser | Wake-word listener using browser Speech API |
| `packages/ignition-os/useIgnitionVoice.native.js` | Web (mislabeled) | Second wake-word hook; despite `.native.js` extension and a "Web (React DOM)" comment at the top, this is functionally identical to `hooks/useIgnitionVoice.js` and does NOT use any native audio API |

### What actually works

`IgnitionVoice.jsx` and `IgnitionVoice.native.js` use `expo-audio` (`useAudioRecorder`, `AudioModule`, `RecordingPresets.HIGH_QUALITY`). The recording flow is real and complete:

1. User taps **START DIAGNOSTIC** → app requests microphone permission via `AudioModule.requestRecordingPermissionsAsync()`
2. On grant: sets audio mode to allow recording, calls `audioRecorder.prepareToRecordAsync()` and `audioRecorder.record()`
3. UI shows "LISTENING TO TECHNICIAN..." while `isRecording === true`
4. User taps **STOP & TRANSCRIBE** → calls `audioRecorder.stop()`, reads `audioRecorder.uri`
5. UI shows "TRANSCRIBING & EXTRACTING AI MANIFEST..." spinner while fetch is in-flight

The two `.jsx`/`.native.js` files are nearly identical. The only meaningful difference is how the transcription endpoint URL is resolved (see Section 2).

**`useIgnitionVoice.js`** (the wake-word hook) is separate from `IgnitionVoice`. It implements browser `SpeechRecognition` for continuous ambient listening or tap-to-talk. When the word "ignition" is detected, it fires a callback. This hook is NOT used anywhere in `CoreApp.jsx` or `App.js` — it is wired to nothing in the current app. It is available infrastructure only.

### What does not work

The recording component is wired to a transcription backend that does not exist in this repository (see Section 2). When recording stops, the fetch will fail. The `catch` block at line 60 of both files logs the error to the console but does not update any UI state — the component silently returns to showing "Awaiting technician voice input diagnostic notes..." as if nothing happened. There is no user-facing error message.

### Entry point

`App.js` (mobile only) imports `IgnitionVoice` at line 25 and mounts it inside `ModuleRouter` at case `'voice'`. The path into voice capture is: `Queue → select a validated job → IgnitionVoice`. `CoreApp.jsx` (web) does NOT import or mount `IgnitionVoice`. The Technician role description in `CoreApp.jsx` at line 193 says "Intake · VIN · Voice · Workflow" but this is label text — there is no working voice module on the web build.

---

## 2. Transcription Pipeline

### What the components expect

Both `IgnitionVoice` files `POST` FormData to a `/transcribe` endpoint:

```
POST {API_URL}/transcribe
Content-Type: multipart/form-data
Body: { file: audio/m4a binary }
Expected response: { transcription: string, tasks: [{ parts: [{ id, name, qty }] }] }
```

The URL resolution differs between the two files:

- **`IgnitionVoice.jsx`** (line 40): resolves `VITE_API_URL` → `EXPO_PUBLIC_API_URL` → `http://localhost:8000`, then appends `/transcribe`
- **`IgnitionVoice.native.js`** (line 37): **hardcoded** `http://192.168.1.14:8000/transcribe` — a private LAN IP with no fallback

### The `/transcribe` endpoint does not exist

There is no implementation of a `/transcribe` route anywhere in the repository. There is no Python file in `packages/ignition-os/` at all. The Python files in this repo are:

- `packages/cultivar-os/api/main.py` — the Cultivar OS order/QBO API (unrelated)
- `packages/shared/src/ai/ai_router.py` — the shared FastAPI AI router (see below)

The `ai_router.py` file mounts at prefix `/ai`. It defines a `POST /ai/voice_transcribe` route (line 395) that uses OpenAI Whisper (`whisper-1`) via `audio_base64` in a JSON body. This route is architecturally sound but:

1. It is not mounted anywhere in a running server — there is no `main.py` for Ignition OS
2. Its expected input is `audio_base64` (base64-encoded JSON), not multipart `FormData` — incompatible with how `IgnitionVoice` currently calls it
3. It requires `OPENAI_API_KEY` — not confirmed present in any `.env` or Vercel project for Ignition OS

### The two-stage design (also not wired)

`AIEngine.ts` defines a full two-stage pipeline:

1. `voice_transcribe` — calls `/ai/voice_transcribe` (OpenAI Whisper) → returns raw transcript text
2. `parts_nlp` — calls `/ai/parts_nlp` (GPT-4o-mini) → takes transcript, returns structured `{ parts: [{ name, qty }], labor_notes }`

`IgnitionVoice` bypasses `AIEngine` entirely. It calls `/transcribe` directly, expecting the backend to do both stages in one response (`transcription` + structured `tasks`). This one-shot design is functionally reasonable but is not what the shared infrastructure was built to support.

### Has it ever been tested end-to-end with real audio?

There is no evidence of end-to-end testing with real audio. The hardcoded IP `192.168.1.14` in `IgnitionVoice.native.js` is consistent with development-only local testing on a specific machine — not a demo or production environment. No test fixtures, no recorded sample files, and no CI/CD configuration for voice testing were found in the repo.

---

## 3. Storage

### Audio files

Audio is captured to native device storage via `audioRecorder.uri` (a temporary file path managed by `expo-audio`). This URI is used once — passed to FormData for the fetch — and then abandoned. There is no upload to Supabase Storage, Vercel Blob, or any other persistent store. If the fetch fails, the audio file sits in the device's tmp directory until the OS clears it. There is no retry mechanism and no archival.

### Transcripts

If a transcription succeeds, the result lives in component state (`transcription` and `suggestedParts`). When the tech taps "APPROVE & SEND ESTIMATE", `onApprove(notes, parts, tasks)` fires, which calls `App.js`'s `updateJob()`:

```js
updateJob(selectedJob.jobId, {
  transcription: notes,
  suggestedParts: parts,
  tasks: tasks,
  status: 'NEEDS_ESTIMATE'
});
```

`updateJob` saves to `DataBridge`, which persists to:

- **Web:** `localStorage['IGNITION_OS_DATA']` as JSON
- **Mobile:** `AsyncStorage['IGNITION_OS_DATA']` as JSON (fire-and-forget)
- **Supabase:** `DataBridge.pushCloudSync()` upserts the jobs array to the `jobs` table on the `ignition-os` Supabase project (separate from cultivar-os)

The transcript is stored as plain text, no encryption. No dedicated `transcripts` or `voice_logs` table exists — the text is embedded inside the job record.

### No audio retention

Once the transcription backend call resolves (successfully or not), the audio file is not archived. The system retains only the transcript text, not the original voice recording.

---

## 4. Question/Answer Rhythm vs. Monologue

The existing voice flow is **single-shot monologue**, not conversational.

The technician records a free-form verbal description of the vehicle's problem and any parts they believe are needed. There is no prompt, no system question, no turn-taking. The flow is:

1. System shows the customer's stated complaint (from intake) as context
2. Tech presses START, speaks freely, presses STOP
3. Backend is expected to return a transcript + structured parts manifest in one response

`useIgnitionVoice.js` has wake-word detection ("ignition") that could theoretically support a conversational wake-and-respond loop, but this hook is not currently connected to anything in the app. It is unused infrastructure.

There is no back-and-forth rhythm in any current file. The Discovery Module BRIEF describes a conversational intake flow for TRACE, but that is a separate, not-yet-built surface — it has no overlap with the Ignition OS voice module as currently written.

---

## 5. Reusability — What Could Move to `packages/shared/src/voice/`

### Already shareable (no changes needed)

| Component | What to move | Notes |
|-----------|-------------|-------|
| `ai_router.py: /voice_transcribe` | Already in `packages/shared/src/ai/` | Real Whisper integration. Needs a running FastAPI host to become useful. |
| `ai_router.py: /parts_nlp` | Already in `packages/shared/src/ai/` | Structured extraction from transcript. Language-agnostic. |
| `AIEngine.ts: transcribeVoice()` | Already in `packages/shared/src/ai/` | Client-side wrapper. Works for any vertical. |
| `AIEngine.ts: extractParts()` | Already in `packages/shared/src/ai/` | Same. |

### Shareable with minor refactoring

**`IgnitionVoice.jsx`** — The recording + fetch pattern could become a generic `VoiceCapture` component in `packages/shared/src/components/voice/`. The Ignition-specific parts are:

1. The header layout (vehicle info, VIN, complaint) — these are props, easily swapped
2. The label text ("START DIAGNOSTIC", "LISTENING TO TECHNICIAN") — easily configurable via props
3. The hardcoded `/transcribe` endpoint URL in the `.native.js` variant — must be removed; should use `AIEngine.transcribeVoice()` instead

Estimated refactor scope: medium. The core `toggleRecording` + `isParsing` state machine is fully reusable. The UI chrome around it is vertical-specific.

### Tangled into Ignition-specific code

**`IgnitionVoice.native.js: hardcoded IP`** — `http://192.168.1.14:8000/transcribe` is not extractable. This line must be replaced before anything becomes shared.

**The response shape** — The current code expects `{ transcription, tasks: [{ parts: [{ id, name, qty }] }] }`. The shared `ai_router.py` returns `{ transcript }` (Whisper only) and `{ parts: [{ name, qty, notes }] }` (parts NLP separately). Any shared component would need to call both endpoints or a new combined endpoint, and reconcile the field names (`transcription` vs `transcript`, `id` vs the absence of `id`).

**The `onApprove(notes, parts, tasks)` callback signature** — This is defined by `App.js`'s `updateJob`. A shared component would need a generic callback shape, not Ignition's specific job-record fields.

---

## 6. Honest Gaps

### Broken

| Issue | Location | Impact |
|-------|----------|--------|
| `/transcribe` endpoint called but does not exist anywhere in repo | `IgnitionVoice.jsx:41`, `IgnitionVoice.native.js:37` | Voice transcription is 100% non-functional. Audio is captured but never processed. |
| No FastAPI server for Ignition OS | Repo root, `packages/ignition-os/` | Even if `/transcribe` were implemented in `ai_router.py`, there is no running server to mount it. |
| Hardcoded LAN IP in `.native.js` | `IgnitionVoice.native.js:37` | Will only work on the specific development machine at 192.168.1.14. Fails everywhere else. |
| Silent failure on transcription error | `IgnitionVoice.jsx:60-65`, `.native.js:54-59` | `catch` block logs to console but does not set any error UI state. User sees a spinner, then the "Awaiting..." placeholder. No indication something went wrong. |
| Success haptic fires even on failure | `IgnitionVoice.jsx:64`, `.native.js:58` | `Haptics.notificationAsync(Success)` is in the `finally` block, so it fires even when transcription failed. The tech gets positive haptic feedback from a broken flow. |

### Stubbed / Not Wired

| Item | Location | Status |
|------|----------|--------|
| `useIgnitionVoice.js` (wake-word hook) | `packages/ignition-os/hooks/` and root | Implemented, not imported anywhere in the running app |
| `AIEngine.transcribeVoice()` | `packages/shared/src/ai/AIEngine.ts:171` | Real method, never called from `IgnitionVoice` |
| `/ai/voice_transcribe` route | `packages/shared/src/ai/ai_router.py:395` | Real Whisper implementation, no server to mount it |
| Voice module on web (`CoreApp.jsx`) | `CoreApp.jsx` | "Voice" appears in role description label text but `IgnitionVoice` is never imported or rendered |
| Audio archival | Anywhere | No implementation. Audio captured to device tmp, discarded after fetch attempt. |

### Works but is fragile

| Item | Location | Risk |
|------|----------|------|
| `DataBridge.pushCloudSync()` | `DataBridge.js:231` | Transcript data (when it eventually flows) upserts to Supabase `jobs` table. The upsert uses `onConflict: 'id'` but the `id` field in job objects is set by the client (`JOB-999` style), not a Supabase-generated UUID. Cross-device conflicts are possible. |
| `DataBridge.pullCloudSync()` | `DataBridge.js:200` | Falls back to a FastAPI endpoint (`${API_URL}/api/jobs`) that doesn't exist for Ignition OS in production. The fallback chain has two levels that both silently fail before returning local cache. |
| `App.js: authenticate()` | `App.js:190` | Calls `DataBridge.authenticate(pin)` but `DataBridge.authenticate` is async (returns a Promise). The `authenticate` function in `App.js` does not `await` it — `if (user)` will always be truthy (a Promise is truthy). Login is broken in any environment where the Supabase call actually runs. The app only works because seed profile data from `DataBridge.getProfiles()` is still being used by the old PIN-compare path, which was likely the original implementation. |

---

## Summary Table

| Area | Verdict |
|------|---------|
| Audio recording UI | Real and functional |
| Stop-and-submit flow | Real UI, broken backend call |
| Transcription backend | Does not exist as a running service |
| OpenAI Whisper integration | Implemented in `ai_router.py`, never invoked |
| Parts extraction (NLP) | Implemented in `ai_router.py`, never invoked |
| Transcript storage | Works if transcription ever succeeds |
| Audio archival | Not implemented |
| Conversational Q&A | Not implemented; monologue only |
| Web voice module | Not mounted in `CoreApp.jsx` |
| Wake-word hook | Implemented, wired to nothing |
| Error handling | Silent — no user-visible error state |
| End-to-end test evidence | None found |

---

*Audit produced by Claude Code — 2026-05-27. No code modified.*
*TRACE Enterprises · Built with CAI*
