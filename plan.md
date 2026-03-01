# Talk to the Plan — Implementation Plan (Phases 2 and 3)

## Phase 2: `v3.0-beta` — Mic Capture, ElevenLabs STT, Transcript Persistence, Apply-Edit Flow

### Phase 2 Summary

Phase 2 adds the voice input path: microphone capture via the browser `MediaRecorder` API, speech-to-text via the ElevenLabs STT endpoint, IndexedDB persistence for transcript turns, and the full apply-edit lifecycle that commits proposed edits to the unified plan and increments its revision.

### Phase 1 Inventory (What Already Exists)

**Types** — All core types defined in `src/core/types/plan-talk.ts`: `PlanTalkTurn`, `PlanGapCard`, `ProposedPlanEdit`, `PlanReflectionResponse`, enums for turn state, speaker, gap severity, edit operations, and source (`voice` | `typed`). `PlanTalkTurnState` already includes `recording` and `transcribing` states. `UnifiedPlanSchema` already has `revision` and `updatedAt` fields.

**Store** — Zustand store at `src/store/plan-talk-store.ts` with `isOpen`, `turnState`, `turns`, `pendingEdits`, `gapCards`, `currentUnderstanding`, `unresolvedQuestions`, `error`, and setters. Actions at `src/store/plan-talk-actions.ts` with `analyzeReflection()` (typed only), `applyEdit()`, `applyAllAccepted()`, `applyMutation()`.

**Components** — `PlanTalkModal.tsx` (modal shell, two-column layout, header with revision badge, footer), `VoicePane.tsx` (text-only: textarea + Send), `AnalysisPane.tsx`, `GapCard.tsx`, `EditReview.tsx`.

**Entry Points** — Toolbar button + SynthesisPanel CTA (conditional on unified plan).

**NOT persisted** — `planTalkTurns` are in-memory only (Zustand). No IDB store.

---

### Phase 2 Steps

#### P2-1. Extend Settings Schema with Voice Fields

**File:** `src/persistence/settings-store.ts`

Add to `AppSettingsSchema`:
- `elevenLabsApiKey: z.string().default('')`
- `voiceInputMode: z.enum(['hold_to_talk', 'toggle']).default('hold_to_talk')`

Backward-compatible — no settings DB migration needed.

#### P2-2. Add ElevenLabs Key Field to Settings UI

**File:** `src/components/Settings/ApiTab.tsx`

Follow the existing Gemini key pattern:
- Second `<fieldset>` for "ElevenLabs API Key"
- Password/text toggle input
- Status indicator: "Not set" / "Valid format" / "Invalid format"
- Privacy warning: "Voice transcription data is sent to ElevenLabs when enabled."

#### P2-3. Create MediaRecorder Service

**New file:** `src/services/voice/media-recorder.ts`

```ts
export class VoiceRecorder {
  async start(options: VoiceRecorderOptions): Promise<void>
  stop(): Promise<Blob>
  isRecording(): boolean
  getElapsedMs(): number
  destroy(): void  // Release mic stream tracks
}

export function getSupportedMimeType(): string
export function isMicrophoneAvailable(): Promise<boolean>
```

- Preferred MIME: `audio/webm;codecs=opus` → fallback `audio/webm` → `audio/ogg;codecs=opus`
- Collect chunks on `dataavailable`, assemble final blob on `stop`
- Never persist the blob

#### P2-4. Create ElevenLabs STT Client

**New file:** `src/services/voice/elevenlabs-client.ts`

```ts
export class ElevenLabsClient {
  async transcribe(audioBlob: Blob, apiKey: string): Promise<string>
}
```

- Endpoint: `POST https://api.elevenlabs.io/v1/speech-to-text`
- Headers: `xi-api-key: <key>`
- Body: `FormData` with `audio` field + `model_id: "scribe_v1"`
- Timeout: 30s via `AbortController`
- Error mapping: 401→"Invalid key", 429→"Rate limit", 5xx→"Service unavailable"

#### P2-5. Upgrade VoicePane for Mic Recording

**File:** `src/components/PlanTalkModal/VoicePane.tsx`

Major UI changes:
1. **Mic button** alongside text input. Disabled if no ElevenLabs key (tooltip: "Set API key in Settings").
2. **Recording states**: `idle`→mic icon, `recording`→pulsing + timer, `transcribing`→spinner
3. **Input mode**: `hold_to_talk` (pointerDown/pointerUp) or `toggle` (click toggle)
4. **Recording flow**: start → stop → blob → STT → analyzeReflection(text, 'voice')
5. **Error handling**: mic denied → text fallback, STT failure → retry card

**CSS additions** to `PlanTalkModal.module.css`: `.micButton`, `.micButtonRecording`, `.recordingIndicator`, `.transcribingIndicator`

#### P2-6. Update plan-talk-actions for Voice Source

**File:** `src/store/plan-talk-actions.ts`

1. Add `transcribeAndAnalyze(audioBlob: Blob)` action:
   - Set turnState `transcribing` → call STT → create user turn (source: `voice`) → set turnState `analyzing` → run AI analysis
2. Modify `analyzeReflection()` to accept `source` parameter
3. After `applyAllAccepted()` / `applyEdit()`, record "applied edit" summary turn in transcript

#### P2-7. IndexedDB Schema Migration (v1 → v2)

**File:** `src/persistence/schema.ts`
- Add `planTalkTurns` store to `FudaDB` interface
- Bump `DB_VERSION` from `1` to `2`

**File:** `src/persistence/repository.ts`
- Version-gated upgrade: `if (oldVersion < 2)` create `planTalkTurns` with indexes `by-session`, `by-unified-plan`
- Update `SessionEnvelope` to include `planTalkTurns`
- Update `loadSessionEnvelope` to load turns in parallel

**File:** `src/persistence/migration.ts`
- Update `CURRENT_VERSION` to `2`

#### P2-8. Transcript Persistence in Hooks

**File:** `src/persistence/hooks.ts`

1. **Save**: Persist `usePlanTalkStore.getState().turns` to `planTalkTurns` store
2. **Auto-save**: Subscribe to `usePlanTalkStore` for debounced save
3. **Restore**: Load turns from envelope, validate with `PlanTalkTurnSchema`, hydrate store

**File:** `src/store/plan-talk-store.ts`
- Add `loadTurns(turns: PlanTalkTurn[])` action for hydration

#### P2-9. Header Status Indicators

**File:** `src/components/PlanTalkModal/PlanTalkModal.tsx`

Add status dots in header:
- **Mic**: green (available) / red (denied) / gray (unchecked)
- **STT**: green (ElevenLabs key set) / gray (not set)
- **AI**: green (Gemini key set) / gray (not set)
- **TTS**: gray always (Phase 3)

#### P2-10. Footer Enhancement

**File:** `src/components/PlanTalkModal/PlanTalkModal.tsx`

- Add "Discard Draft" button (clears pending edits)
- Add post-apply toast via `useToastStore`
- Revision badge updates automatically from `useSemanticStore`

---

### Phase 2 File Summary

| Action | File | Type |
|--------|------|------|
| P2-3 | `src/services/voice/media-recorder.ts` | **New** |
| P2-4 | `src/services/voice/elevenlabs-client.ts` | **New** |
| P2-1 | `src/persistence/settings-store.ts` | Modify |
| P2-7 | `src/persistence/schema.ts` | Modify |
| P2-7 | `src/persistence/repository.ts` | Modify |
| P2-7 | `src/persistence/migration.ts` | Modify |
| P2-8 | `src/persistence/hooks.ts` | Modify |
| P2-2 | `src/components/Settings/ApiTab.tsx` | Modify |
| P2-5 | `src/components/PlanTalkModal/VoicePane.tsx` | Modify |
| P2-9,10 | `src/components/PlanTalkModal/PlanTalkModal.tsx` | Modify |
| P2-5 | `src/components/PlanTalkModal/PlanTalkModal.module.css` | Modify |
| P2-6,8 | `src/store/plan-talk-store.ts` | Modify |
| P2-6 | `src/store/plan-talk-actions.ts` | Modify |

### Phase 2 Implementation Order

```
Parallel group 1 (no deps):
  P2-1  Settings schema
  P2-3  MediaRecorder service
  P2-4  ElevenLabs STT client
  P2-7  IndexedDB migration

Sequential:
  P2-2  Settings UI (after P2-1)
  P2-8  Transcript persistence (after P2-7)
  P2-6  plan-talk-actions updates (standalone)
  P2-5  VoicePane mic + recording (after P2-1, P2-3, P2-4)
  P2-9  Header indicators (after P2-1)
  P2-10 Footer + post-apply (after P2-6)
```

---

## Phase 3: `v3.0` — ElevenLabs TTS Playback, Settings Polish, Accessibility, Telemetry

### Phase 3 Summary

Phase 3 completes Talk to the Plan by adding text-to-speech playback of AI responses via ElevenLabs TTS, polishing voice settings with TTS controls, performing a full accessibility pass, and adding telemetry hooks for voice interaction tracking.

### Phase 3 Prerequisites

- Phase 2 complete (mic capture, STT, transcript persistence, apply-edit flow)
- `ElevenLabsClient` exists at `src/services/voice/elevenlabs-client.ts`
- `planTalkTurns` IndexedDB store exists at DB version 2
- VoiceRecorder component functional

---

### Phase 3 Steps

#### P3-1. ElevenLabs TTS Method on Client

**File:** `src/services/voice/elevenlabs-client.ts`

Add `textToSpeech` method:
```ts
async textToSpeech(text: string, apiKey: string, voiceId: string): Promise<Blob>
```

- Endpoint: `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
- Headers: `xi-api-key`
- Body: `{ text, model_id: "eleven_monolingual_v1", voice_settings: { stability: 0.5, similarity_boost: 0.5 } }`
- Response: audio blob (`audio/mpeg`)
- Timeout: 15s, 2 retries with exponential backoff
- Default voice ID if empty: `"21m00Tcm4TlvDq8ikWAM"` (Rachel)
- Error types: `TtsNetworkError`, `TtsAuthError`, `TtsRateLimitError`, `TtsApiError`

#### P3-2. Audio Playback Utility

**New file:** `src/services/voice/audio-playback.ts`

```ts
class AudioPlayback {
  play(audioBlob: Blob): Promise<void>
  stop(): void
  isPlaying(): boolean
  onEnd(callback: () => void): void
}
```

- Uses `URL.createObjectURL(blob)` → `HTMLAudioElement`
- Revokes URL after playback/stop
- Only one audio active at a time
- Handles browser autoplay restrictions gracefully

#### P3-3. TTS Settings Fields

**File:** `src/persistence/settings-store.ts`

```ts
voiceTtsEnabled: z.boolean().default(true),
voiceAutoPlayAi: z.boolean().default(true),
voiceTtsVoiceId: z.string().default(''),
```

Empty `voiceTtsVoiceId` = use ElevenLabs default voice. Backward-compatible.

#### P3-4. Voice Settings UI

**File:** `src/components/Settings/ApiTab.tsx`

Add "Voice / TTS" fieldset below ElevenLabs key:
1. **Enable TTS** checkbox → `voiceTtsEnabled`
2. **Auto-play AI responses** checkbox → `voiceAutoPlayAi` (disabled when TTS off)
3. **TTS Voice ID** text input → `voiceTtsVoiceId` (placeholder: default voice ID)
4. **Privacy warning**: "Voice transcription is sent to ElevenLabs when enabled. AI response audio is generated via ElevenLabs TTS. No audio data is persisted locally."

#### P3-5. TTS Integration in Actions + Store

**File:** `src/store/plan-talk-store.ts`

New fields:
```ts
ttsAudioBlobs: Map<string, Blob>       // turnId → audio blob (in-memory only)
ttsTurnStatus: Map<string, 'loading' | 'ready' | 'failed'>
setTtsBlob(turnId: string, blob: Blob): void
setTtsTurnStatus(turnId: string, status): void
```

Cleared on `clear()`. Never persisted.

**File:** `src/store/plan-talk-actions.ts`

After AI analysis returns:
1. Check `voiceTtsEnabled && elevenLabsApiKey`
2. Set `ttsTurnStatus[turnId]` to `'loading'`
3. Call `ElevenLabsClient.textToSpeech(understanding, apiKey, voiceTtsVoiceId)`
4. On success: store blob, set status `'ready'`, auto-play if `voiceAutoPlayAi`
5. On failure: set status `'failed'`, show toast "Audio unavailable", text response stays visible

#### P3-6. Replay Button per AI Response

**File:** `src/components/PlanTalkModal/VoicePane.tsx`

For each AI turn bubble:
- `ttsTurnStatus === 'ready'` → show "Replay" icon button
- `ttsTurnStatus === 'loading'` → show small spinner
- `ttsTurnStatus === 'failed'` or TTS disabled → hide button
- Click → `AudioPlayback.play(blob)`, icon changes to "Stop" while playing

**CSS:** `.replayBtn`, `.replayBtn.playing`, `.ttsSpinner`

#### P3-7. TTS Status Chip in Modal Header

**File:** `src/components/PlanTalkModal/PlanTalkModal.tsx`

- Green: TTS enabled + last playback succeeded
- Yellow: TTS loading/playing
- Grey: TTS disabled
- Red: Last TTS call failed

#### P3-8. Accessibility — Modal Dialog

**File:** `src/components/PlanTalkModal/PlanTalkModal.tsx`

1. `role="dialog"`, `aria-modal="true"`, `aria-labelledby="plan-talk-title"`
2. Close button: `aria-label="Close Talk to Plan modal"`
3. Apply button: dynamic `aria-label` with count
4. **Focus management**: focus text input on open, return focus to trigger on close
5. **Focus trap**: Tab cycles within modal (lightweight keydown listener)

#### P3-9. Accessibility — VoicePane

**File:** `src/components/PlanTalkModal/VoicePane.tsx`

1. Text input: `aria-label="Type your reflection on the plan"`
2. Send button: `aria-label="Send reflection"`
3. Transcript area: `role="log"`, `aria-live="polite"`
4. Turn bubbles: `role="article"`, descriptive `aria-label`
5. Analyzing spinner: `role="status"`, `aria-label="Analyzing your reflection"`
6. Replay button: `aria-label="Replay AI response"` / `"Stop playback"`

#### P3-10. Accessibility — AnalysisPane, GapCard, EditReview

**AnalysisPane.tsx**: `role="complementary"`, `aria-label="AI Analysis"`
**GapCard.tsx**: `role="article"`, `aria-label` combining severity + title. Severity badge: `aria-hidden="true"`
**EditReview.tsx**: `role="article"`, accept button `aria-pressed={edit.approved}`, dismiss button `aria-label`

#### P3-11. Keyboard Navigation

**File:** `src/components/PlanTalkModal/PlanTalkModal.tsx`

- Escape: close modal (already works)
- Tab/Shift+Tab: focus trap (P3-8)
- Ctrl+Enter in textarea: alternative send shortcut
- `tabIndex={0}` on transcript area for keyboard scrolling

#### P3-12. Telemetry Types

**New file:** `src/services/telemetry/types.ts`

Events: `voice_turn_started`, `voice_turn_completed`, `voice_turn_failed`, `typed_turn_submitted`, `tts_playback_started`, `tts_playback_completed`, `tts_playback_failed`, `tts_replay_clicked`, `edit_approved`, `edit_dismissed`, `edits_applied`, `modal_opened`, `modal_closed`, `session_turn_count`

#### P3-13. Telemetry Collector

**New file:** `src/services/telemetry/collector.ts`

```ts
class TelemetryCollector {
  enable(): void
  disable(): void
  track(eventName: string, properties?: Record<string, string | number | boolean>): void
  flush(): TelemetryEvent[]
}
```

- **Local-only for v3.0**: buffer in memory, no remote endpoint
- **Privacy-safe**: never include API keys, transcript content, or audio data
- **Export-ready**: `flush()` returns events for potential session export

#### P3-14. Instrument Telemetry

**Files:** `plan-talk-actions.ts`, `PlanTalkModal.tsx`, `VoicePane.tsx`, `EditReview.tsx`

Add `track()` calls at: turn submission, STT success/failure, TTS playback start/end/failure, edit approve/dismiss/apply, modal open/close, replay click.

---

### Phase 3 File Summary

| Action | File | Type |
|--------|------|------|
| P3-2 | `src/services/voice/audio-playback.ts` | **New** |
| P3-12 | `src/services/telemetry/types.ts` | **New** |
| P3-13 | `src/services/telemetry/collector.ts` | **New** |
| P3-1 | `src/services/voice/elevenlabs-client.ts` | Modify |
| P3-3 | `src/persistence/settings-store.ts` | Modify |
| P3-4 | `src/components/Settings/ApiTab.tsx` | Modify |
| P3-5 | `src/store/plan-talk-store.ts` | Modify |
| P3-5,14 | `src/store/plan-talk-actions.ts` | Modify |
| P3-6,9,14 | `src/components/PlanTalkModal/VoicePane.tsx` | Modify |
| P3-6 | `src/components/PlanTalkModal/PlanTalkModal.module.css` | Modify |
| P3-7,8,11,14 | `src/components/PlanTalkModal/PlanTalkModal.tsx` | Modify |
| P3-10 | `src/components/PlanTalkModal/AnalysisPane.tsx` | Modify |
| P3-10 | `src/components/PlanTalkModal/GapCard.tsx` | Modify |
| P3-10,14 | `src/components/PlanTalkModal/EditReview.tsx` | Modify |

### Phase 3 Implementation Order

```
Parallel group 1 (no deps):
  P3-1   TTS client method
  P3-2   Audio playback utility
  P3-3   TTS settings schema
  P3-12  Telemetry types
  P3-8   Accessibility — modal dialog
  P3-10  Accessibility — cards

Sequential:
  P3-4   Settings UI (after P3-3)
  P3-13  Telemetry collector (after P3-12)
  P3-5   TTS in actions + store (after P3-1, P3-2, P3-3)
  P3-6   Replay button (after P3-5)
  P3-7   TTS header chip (after P3-5)
  P3-9   Accessibility — VoicePane (after P3-6)
  P3-11  Keyboard navigation (after P3-8)
  P3-14  Telemetry instrumentation (after P3-13, P3-5)
```

### Phase 3 Risks

| Risk | Mitigation |
|------|------------|
| Browser autoplay restrictions | `AudioPlayback.play()` catches `NotAllowedError`, shows toast. First play may need user gesture. |
| ElevenLabs TTS latency (1-3s) | Show loading spinner, auto-play after text renders so user sees response first. |
| Large audio blobs in memory | Clear on modal close via `clear()`. Never persist. |
| Voice ID typo → 404 | Validate format client-side, show toast on TTS failure. |
| Focus trap vs screen readers | Test with VoiceOver/NVDA. `aria-modal="true"` handles virtual focus. |
| Telemetry privacy | Local-only buffer. No remote transmission. Never include content/keys. |
