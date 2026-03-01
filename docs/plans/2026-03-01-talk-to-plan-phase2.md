# Talk to the Plan — Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add mic capture, ElevenLabs STT, transcript persistence, and apply-edit polish to the Talk to Plan modal.

**Architecture:** Voice capture via browser `MediaRecorder` API → ElevenLabs STT endpoint for transcription → existing `analyzeReflection` pipeline for AI analysis. Transcripts persist in a new IndexedDB `planTalkTurns` store (DB v2 migration). Settings store extended with `elevenLabsApiKey` and `voiceInputMode`.

**Tech Stack:** React, Zustand, idb, browser MediaRecorder API, ElevenLabs REST API, Zod

---

### Task 1: Extend Settings Schema

**Files:**
- Modify: `src/persistence/settings-store.ts:11-17`

**Step 1: Add voice fields to AppSettingsSchema**

In `src/persistence/settings-store.ts`, add two fields inside `AppSettingsSchema` after `theme`:

```ts
export const AppSettingsSchema = z.object({
  geminiApiKey: z.string().default(''),
  challengeDepth: z.enum(['gentle', 'balanced', 'intense']).default('balanced'),
  autoSaveEnabled: z.boolean().default(true),
  animationsEnabled: z.boolean().default(true),
  theme: ThemeSchema,
  elevenLabsApiKey: z.string().default(''),
  voiceInputMode: z.enum(['hold_to_talk', 'toggle']).default('hold_to_talk'),
});
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (new `.default()` fields are backward-compatible)

**Step 3: Commit**

```bash
git add src/persistence/settings-store.ts
git commit -m "feat(settings): add elevenLabsApiKey and voiceInputMode fields"
```

---

### Task 2: ElevenLabs API Key in Settings UI

**Files:**
- Modify: `src/components/Settings/ApiTab.tsx`

**Step 1: Add ElevenLabs key validation helper and fieldset**

Replace the full content of `ApiTab.tsx`:

```tsx
import { useState } from 'react';
import type { AppSettings } from '../../persistence/settings-store.ts';
import styles from './Settings.module.css';

function getGeminiKeyStatus(key: string): 'not-set' | 'valid' | 'invalid' {
  if (!key) return 'not-set';
  if (key.startsWith('AI') && key.length > 20) return 'valid';
  return 'invalid';
}

function getElevenLabsKeyStatus(key: string): 'not-set' | 'valid' | 'invalid' {
  if (!key) return 'not-set';
  if (/^[a-f0-9]{32}$/i.test(key)) return 'valid';
  if (key.length >= 20) return 'valid'; // Some keys differ in format
  return 'invalid';
}

const STATUS_LABELS = {
  'not-set': 'Not set',
  valid: 'Valid format',
  invalid: 'Invalid format',
} as const;

function statusClass(status: 'not-set' | 'valid' | 'invalid') {
  return status === 'not-set'
    ? styles.statusNotSet
    : status === 'valid'
      ? styles.statusValid
      : styles.statusInvalid;
}

export function ApiTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (partial: Partial<AppSettings>) => void }) {
  const [showGemini, setShowGemini] = useState(false);
  const [showElevenLabs, setShowElevenLabs] = useState(false);

  const geminiStatus = getGeminiKeyStatus(settings.geminiApiKey);
  const elevenLabsStatus = getElevenLabsKeyStatus(settings.elevenLabsApiKey);

  return (
    <div>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Gemini API Key</legend>
        <div className={styles.inputGroup}>
          <input
            className={styles.textInput}
            type={showGemini ? 'text' : 'password'}
            value={settings.geminiApiKey}
            onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
            placeholder="AIza..."
            aria-label="Gemini API key"
          />
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setShowGemini((v) => !v)}
            aria-label={showGemini ? 'Hide API key' : 'Show API key'}
          >
            {showGemini ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`${styles.statusIndicator} ${statusClass(geminiStatus)}`} data-testid="gemini-key-status">
          {STATUS_LABELS[geminiStatus]}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>ElevenLabs API Key</legend>
        <div className={styles.inputGroup}>
          <input
            className={styles.textInput}
            type={showElevenLabs ? 'text' : 'password'}
            value={settings.elevenLabsApiKey}
            onChange={(e) => onUpdate({ elevenLabsApiKey: e.target.value })}
            placeholder="Enter ElevenLabs API key"
            aria-label="ElevenLabs API key"
          />
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setShowElevenLabs((v) => !v)}
            aria-label={showElevenLabs ? 'Hide API key' : 'Show API key'}
          >
            {showElevenLabs ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`${styles.statusIndicator} ${statusClass(elevenLabsStatus)}`} data-testid="elevenlabs-key-status">
          {STATUS_LABELS[elevenLabsStatus]}
        </div>
        <p className={styles.statusIndicator} style={{ color: 'var(--text-muted, #999)' }}>
          Voice transcription audio is sent to ElevenLabs when enabled.
        </p>
      </fieldset>
    </div>
  );
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```bash
git add src/components/Settings/ApiTab.tsx
git commit -m "feat(settings): add ElevenLabs API key field with privacy warning"
```

---

### Task 3: Create ElevenLabs STT Client

**Files:**
- Create: `src/services/voice/elevenlabs-client.ts`

**Step 1: Create the service file**

Create `src/services/voice/elevenlabs-client.ts`:

```ts
export class ElevenLabsSTTError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ElevenLabsSTTError';
  }
}

/**
 * Transcribe audio using ElevenLabs Speech-to-Text API.
 * Returns the transcript text.
 */
export async function transcribeAudio(audioBlob: Blob, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.webm');
    form.append('model_id', 'scribe_v1');

    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 401) throw new ElevenLabsSTTError('Invalid ElevenLabs API key', 401);
      if (res.status === 429) throw new ElevenLabsSTTError('Rate limit exceeded, try again shortly', 429);
      throw new ElevenLabsSTTError(`ElevenLabs service error (${res.status})`, res.status);
    }

    const data: { text: string } = await res.json();
    if (!data.text?.trim()) throw new ElevenLabsSTTError('Empty transcription returned');
    return data.text.trim();
  } catch (err) {
    if (err instanceof ElevenLabsSTTError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new ElevenLabsSTTError('Transcription request timed out');
    }
    throw new ElevenLabsSTTError('Network error, check your connection');
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```bash
git add src/services/voice/elevenlabs-client.ts
git commit -m "feat(voice): add ElevenLabs STT client with timeout and error mapping"
```

---

### Task 4: Create MediaRecorder Service

**Files:**
- Create: `src/services/voice/media-recorder.ts`

**Step 1: Create the service file**

Create `src/services/voice/media-recorder.ts`:

```ts
export class MicPermissionError extends Error {
  constructor() {
    super('Microphone permission denied');
    this.name = 'MicPermissionError';
  }
}

/** Pick a mime type the browser supports for MediaRecorder. */
export function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return ''; // browser default
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  /** Start mic capture. Throws MicPermissionError on denial. */
  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new MicPermissionError();
    }

    this.chunks = [];
    const mimeType = getSupportedMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.startedAt = Date.now();
  }

  /** Stop recording and return the captured audio blob. */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder || this.recorder.state !== 'recording') {
        reject(new Error('Not recording'));
        return;
      }
      this.recorder.onstop = () => {
        const mime = this.recorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mime });
        this.chunks = [];
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  getElapsedMs(): number {
    if (!this.startedAt || !this.isRecording()) return 0;
    return Date.now() - this.startedAt;
  }

  /** Release the mic stream. Call this when done. */
  destroy(): void {
    if (this.recorder?.state === 'recording') {
      this.recorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.startedAt = 0;
  }
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```bash
git add src/services/voice/media-recorder.ts
git commit -m "feat(voice): add MediaRecorder wrapper with mic permission handling"
```

---

### Task 5: Add `loadTurns` to Plan Talk Store

**Files:**
- Modify: `src/store/plan-talk-store.ts`

**Step 1: Add loadTurns action**

Add `loadTurns` to the `PlanTalkState` interface and implementation. In the interface (after `clear`):

```ts
  loadTurns: (turns: PlanTalkTurn[]) => void;
```

In the store implementation (after `clear`):

```ts
  loadTurns: (turns) => set({ turns }),
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```bash
git add src/store/plan-talk-store.ts
git commit -m "feat(store): add loadTurns action for transcript hydration"
```

---

### Task 6: IndexedDB Schema Migration v1→v2

**Files:**
- Modify: `src/persistence/schema.ts`
- Modify: `src/persistence/repository.ts`
- Modify: `src/persistence/migration.ts`

**Step 1: Add planTalkTurns store to schema type**

In `src/persistence/schema.ts`, add import for `PlanTalkTurn` and the new store definition:

```ts
import type {
  PlanningSession,
  ModelLane,
  SemanticNode,
  SemanticEdge,
  Promotion,
  LanePlan,
  UnifiedPlan,
  DialogueTurn,
  GenerationJob,
  PlanTalkTurn,
} from '../core/types';
```

Add inside `FudaDB` interface (after `jobs`):

```ts
  planTalkTurns: {
    key: string;
    value: PlanTalkTurn;
    indexes: { 'by-session': string; 'by-unified-plan': string };
  };
```

Change `DB_VERSION`:

```ts
export const DB_VERSION = 2;
```

**Step 2: Version-gate the upgrade callback in repository.ts**

Replace the `upgrade(db)` callback in `src/persistence/repository.ts` with version-aware logic:

```ts
    dbPromise = openDB<FudaDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          // v1 stores
          db.createObjectStore('sessions', { keyPath: 'id' });

          const lanes = db.createObjectStore('lanes', { keyPath: 'id' });
          lanes.createIndex('by-session', 'sessionId');

          const nodes = db.createObjectStore('nodes', { keyPath: 'id' });
          nodes.createIndex('by-session', 'sessionId');
          nodes.createIndex('by-lane', 'laneId');

          const edges = db.createObjectStore('edges', { keyPath: 'id' });
          edges.createIndex('by-session', 'sessionId');

          const promotions = db.createObjectStore('promotions', { keyPath: 'id' });
          promotions.createIndex('by-session', 'sessionId');
          promotions.createIndex('by-lane', 'laneId');

          const lanePlans = db.createObjectStore('lanePlans', { keyPath: 'id' });
          lanePlans.createIndex('by-session', 'sessionId');
          lanePlans.createIndex('by-lane', 'laneId');

          const unifiedPlans = db.createObjectStore('unifiedPlans', { keyPath: 'id' });
          unifiedPlans.createIndex('by-session', 'sessionId');

          const dialogueTurns = db.createObjectStore('dialogueTurns', { keyPath: 'id' });
          dialogueTurns.createIndex('by-session', 'sessionId');
          dialogueTurns.createIndex('by-node', 'nodeId');

          const jobs = db.createObjectStore('jobs', { keyPath: 'id' });
          jobs.createIndex('by-session', 'sessionId');
        }

        if (oldVersion < 2) {
          const planTalkTurns = db.createObjectStore('planTalkTurns', { keyPath: 'id' });
          planTalkTurns.createIndex('by-session', 'sessionId');
          planTalkTurns.createIndex('by-unified-plan', 'unifiedPlanId');
        }
      },
    });
```

**Step 3: Add planTalkTurns to SessionEnvelope and loadSessionEnvelope**

In `SessionEnvelope` interface, add:

```ts
  planTalkTurns: StoreValue<FudaDB, 'planTalkTurns'>[];
```

In `loadSessionEnvelope`, add to the destructured array and `Promise.all`:

```ts
  const [session, lanes, nodes, edges, promotions, lanePlans, unifiedPlans, dialogueTurns, planTalkTurns] =
    await Promise.all([
      db.get('sessions', sessionId),
      db.getAllFromIndex('lanes', 'by-session', sessionId),
      db.getAllFromIndex('nodes', 'by-session', sessionId),
      db.getAllFromIndex('edges', 'by-session', sessionId),
      db.getAllFromIndex('promotions', 'by-session', sessionId),
      db.getAllFromIndex('lanePlans', 'by-session', sessionId),
      db.getAllFromIndex('unifiedPlans', 'by-session', sessionId),
      db.getAllFromIndex('dialogueTurns', 'by-session', sessionId),
      db.getAllFromIndex('planTalkTurns', 'by-session', sessionId),
    ]);
```

Add `planTalkTurns` to the return object:

```ts
  return { session, lanes, nodes, edges, promotions, lanePlans, unifiedPlans, dialogueTurns, planTalkTurns };
```

**Step 4: Update migration.ts**

In `src/persistence/migration.ts`, change:

```ts
export const CURRENT_VERSION = 2;
```

**Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 6: Commit**

```bash
git add src/persistence/schema.ts src/persistence/repository.ts src/persistence/migration.ts
git commit -m "feat(persistence): add planTalkTurns store with v1→v2 migration"
```

---

### Task 7: Transcript Persistence in Hooks

**Files:**
- Modify: `src/persistence/hooks.ts`

**Step 1: Add plan talk store save and restore**

Add imports at the top of `src/persistence/hooks.ts`:

```ts
import { usePlanTalkStore } from '../store/plan-talk-store';
import { PlanTalkTurnSchema } from '../core/types';
```

**In `saveSession()`**, add plan talk turns to the parallel save. After the `dialogueTurns` line in the `Promise.all`:

```ts
    ...usePlanTalkStore.getState().turns.map(t => putEntity('planTalkTurns', t)),
```

**In `startAutoSave()`**, add subscription for the plan talk store:

```ts
export function startAutoSave(): () => void {
  const unsub1 = useSemanticStore.subscribe(debouncedSave);
  const unsub2 = useSessionStore.subscribe(debouncedSave);
  const unsub3 = usePlanTalkStore.subscribe(debouncedSave);
  return () => {
    unsub1();
    unsub2();
    unsub3();
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
```

**In `restoreSession()`**, after `const dialogueTurns = ...` line, add:

```ts
    const planTalkTurns = validateEntities(envelope.planTalkTurns, PlanTalkTurnSchema, 'planTalkTurn');
```

After `useSemanticStore.getState().loadSession({...})`, add:

```ts
    // Hydrate plan talk store with persisted transcript turns
    usePlanTalkStore.getState().loadTurns(planTalkTurns);
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```bash
git add src/persistence/hooks.ts
git commit -m "feat(persistence): save and restore plan talk transcript turns"
```

---

### Task 8: Update Actions — Voice Source + Summary Turn

**Files:**
- Modify: `src/store/plan-talk-actions.ts`

**Step 1: Add `transcribeAndAnalyze` action and update `analyzeReflection` with source param**

Add import at top:

```ts
import { transcribeAudio, ElevenLabsSTTError } from '../services/voice/elevenlabs-client';
```

Add the `source` parameter to `analyzeReflection`:

```ts
export async function analyzeReflection(transcriptText: string, source: 'voice' | 'typed' = 'typed'): Promise<void> {
```

Change the user turn creation to use the `source` parameter (line ~34):

```ts
    source,
```

Change the AI turn creation to also use the `source` parameter (line ~71):

```ts
    source,
```

Add the new `transcribeAndAnalyze` function after `analyzeReflection`:

```ts
/**
 * Record audio, transcribe via ElevenLabs STT, then analyze.
 */
export async function transcribeAndAnalyze(audioBlob: Blob, apiKey: string): Promise<void> {
  usePlanTalkStore.getState().setTurnState('transcribing');
  usePlanTalkStore.getState().setError(null);

  try {
    const text = await transcribeAudio(audioBlob, apiKey);
    await analyzeReflection(text, 'voice');
  } catch (err) {
    const message = err instanceof ElevenLabsSTTError
      ? err.message
      : 'Transcription failed. Please try again.';
    usePlanTalkStore.getState().setError(message);
    usePlanTalkStore.getState().setTurnState('error');
  }
}
```

**Step 2: Add summary turn after edits applied**

In `applyAllAccepted()`, after the `setPendingEdits` call at the end, add:

```ts
  // Record summary turn in transcript
  const session = useSessionStore.getState().session;
  const updatedPlan = useSemanticStore.getState().unifiedPlan;
  if (session && updatedPlan) {
    const summaryTurn: PlanTalkTurn = {
      id: generateId(),
      sessionId: session.id,
      unifiedPlanId: updatedPlan.id,
      turnIndex: usePlanTalkStore.getState().turns.length,
      speaker: 'ai',
      transcriptText: `Applied ${accepted.length} edit(s). Plan updated to revision ${updatedPlan.revision ?? 1}.`,
      source: 'typed',
      createdAt: new Date().toISOString(),
    };
    usePlanTalkStore.getState().addTurn(summaryTurn);
  }
```

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 4: Commit**

```bash
git add src/store/plan-talk-actions.ts
git commit -m "feat(actions): add transcribeAndAnalyze, voice source param, and edit summary turns"
```

---

### Task 9: Upgrade VoicePane with Mic Recording UI

**Files:**
- Modify: `src/components/PlanTalkModal/VoicePane.tsx`
- Modify: `src/components/PlanTalkModal/PlanTalkModal.module.css`

**Step 1: Add mic recording CSS**

Append to `PlanTalkModal.module.css`:

```css
/* Mic button */
.micBtn {
  align-self: flex-end;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--card-border);
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  transition: all 0.15s;
  flex-shrink: 0;
}

.micBtn:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.micBtn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.micBtnRecording {
  border-color: var(--severity-high, #ef4444);
  background: rgba(239, 68, 68, 0.1);
  color: var(--severity-high, #ef4444);
  animation: micPulse 1.2s ease-in-out infinite;
}

@keyframes micPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}

.recordingTimer {
  font-size: 0.75rem;
  color: var(--severity-high, #ef4444);
  font-variant-numeric: tabular-nums;
  align-self: flex-end;
  min-width: 36px;
  text-align: center;
}

.micHint {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 4px 16px 0;
}

.transcribingBar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 0.8rem;
  color: var(--text-muted);
  border-top: 1px solid var(--card-border);
}
```

**Step 2: Rewrite VoicePane with mic support**

Replace `src/components/PlanTalkModal/VoicePane.tsx`:

```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlanTalkStore } from '../../store/plan-talk-store';
import { analyzeReflection, transcribeAndAnalyze } from '../../store/plan-talk-actions';
import { loadSettings } from '../../persistence/settings-store';
import { VoiceRecorder, MicPermissionError } from '../../services/voice/media-recorder';
import styles from './PlanTalkModal.module.css';

export function VoicePane() {
  const turns = usePlanTalkStore((s) => s.turns);
  const turnState = usePlanTalkStore((s) => s.turnState);
  const error = usePlanTalkStore((s) => s.error);
  const [input, setInput] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [voiceInputMode, setVoiceInputMode] = useState<'hold_to_talk' | 'toggle'>('hold_to_talk');
  const [micDenied, setMicDenied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy = turnState === 'analyzing' || turnState === 'transcribing' || turnState === 'recording';
  const isRecording = turnState === 'recording';
  const micAvailable = !!elevenLabsKey && !micDenied;

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setElevenLabsKey(s.elevenLabsApiKey);
      setVoiceInputMode(s.voiceInputMode);
    });
  }, []);

  // Auto-scroll on new turns
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length, turnState]);

  // Cleanup recorder on unmount
  useEffect(() => {
    return () => {
      recorderRef.current?.destroy();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isBusy) return;
    const recorder = new VoiceRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start();
      usePlanTalkStore.getState().setTurnState('recording');
      usePlanTalkStore.getState().setError(null);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(recorder.getElapsedMs());
      }, 200);
    } catch (err) {
      if (err instanceof MicPermissionError) {
        setMicDenied(true);
      }
      recorder.destroy();
      recorderRef.current = null;
    }
  }, [isBusy]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording()) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const blob = await recorder.stop();
      recorder.destroy();
      recorderRef.current = null;
      await transcribeAndAnalyze(blob, elevenLabsKey);
    } catch {
      usePlanTalkStore.getState().setError('Recording failed. Please try again.');
      usePlanTalkStore.getState().setTurnState('error');
    }
  }, [elevenLabsKey]);

  // Mic button handlers depending on input mode
  const handleMicPointerDown = useCallback(() => {
    if (voiceInputMode === 'hold_to_talk' && !isRecording) {
      startRecording();
    }
  }, [voiceInputMode, isRecording, startRecording]);

  const handleMicPointerUp = useCallback(() => {
    if (voiceInputMode === 'hold_to_talk' && isRecording) {
      stopRecording();
    }
  }, [voiceInputMode, isRecording, stopRecording]);

  const handleMicClick = useCallback(() => {
    if (voiceInputMode === 'toggle') {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  }, [voiceInputMode, isRecording, startRecording, stopRecording]);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput('');
    analyzeReflection(text).catch(() => {});
  }, [input, isBusy]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className={styles.voicePane}>
      <div className={styles.transcriptArea} ref={scrollRef}>
        {turns.length === 0 && (
          <div className={styles.emptyState}>
            Share your thoughts about the plan. The AI will analyze gaps and suggest improvements.
          </div>
        )}
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`${styles.turnBubble} ${turn.speaker === 'user' ? styles.turnUser : styles.turnAi}`}
          >
            <div className={styles.turnLabel}>
              {turn.speaker}
              {turn.source === 'voice' && ' (voice)'}
            </div>
            {turn.transcriptText}
          </div>
        ))}
        {turnState === 'analyzing' && (
          <div className={styles.analyzing}>
            <div className={styles.spinner} />
            <span className={styles.analyzingText}>Analyzing your reflection...</span>
          </div>
        )}
      </div>

      {turnState === 'transcribing' && (
        <div className={styles.transcribingBar}>
          <div className={styles.spinner} style={{ width: 16, height: 16, borderWidth: 2 }} />
          <span>Transcribing...</span>
        </div>
      )}

      <div className={styles.inputArea}>
        <textarea
          className={styles.textInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={micAvailable ? 'Type or use mic...' : 'Type your reflection on the plan...'}
          disabled={isBusy}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {isRecording && (
            <span className={styles.recordingTimer}>{formatElapsed(elapsed)}</span>
          )}
          <button
            className={`${styles.micBtn} ${isRecording ? styles.micBtnRecording : ''}`}
            onPointerDown={handleMicPointerDown}
            onPointerUp={handleMicPointerUp}
            onClick={handleMicClick}
            disabled={!micAvailable || (isBusy && !isRecording)}
            type="button"
            title={!elevenLabsKey ? 'Set ElevenLabs API key in Settings' : micDenied ? 'Microphone permission denied' : isRecording ? 'Stop recording' : 'Record'}
          >
            {isRecording ? '⏹' : '🎙'}
          </button>
          <button
            className={styles.sendBtn}
            onClick={handleSubmit}
            disabled={!input.trim() || isBusy}
            type="button"
          >
            Send
          </button>
        </div>
      </div>
      {micDenied && (
        <div className={styles.micHint}>Microphone access was denied. You can still type your reflections.</div>
      )}
    </div>
  );
}
```

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 4: Commit**

```bash
git add src/components/PlanTalkModal/VoicePane.tsx src/components/PlanTalkModal/PlanTalkModal.module.css
git commit -m "feat(voice): add mic recording UI with hold-to-talk and toggle modes"
```

---

### Task 10: Add Discard Draft + Apply Toast to Modal Footer

**Files:**
- Modify: `src/components/PlanTalkModal/PlanTalkModal.tsx`
- Modify: `src/components/PlanTalkModal/PlanTalkModal.module.css`

**Step 1: Add discard button CSS**

Append to `PlanTalkModal.module.css`:

```css
.discardBtn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
}

.discardBtn:hover {
  color: var(--text-primary);
  border-color: var(--card-border-hover);
}

.discardBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

**Step 2: Update PlanTalkModal.tsx**

Replace `src/components/PlanTalkModal/PlanTalkModal.tsx`:

```tsx
import { useEffect, useCallback } from 'react';
import { usePlanTalkStore } from '../../store/plan-talk-store';
import { useSemanticStore } from '../../store/semantic-store';
import { applyAllAccepted } from '../../store/plan-talk-actions';
import { VoicePane } from './VoicePane';
import { AnalysisPane } from './AnalysisPane';
import styles from './PlanTalkModal.module.css';

export function PlanTalkModal() {
  const isOpen = usePlanTalkStore((s) => s.isOpen);
  const close = usePlanTalkStore((s) => s.close);
  const clear = usePlanTalkStore((s) => s.clear);
  const pendingEdits = usePlanTalkStore((s) => s.pendingEdits);
  const setPendingEdits = usePlanTalkStore((s) => s.setPendingEdits);
  const unifiedPlan = useSemanticStore((s) => s.unifiedPlan);

  const acceptedCount = pendingEdits.filter((e) => e.approved).length;

  const handleClose = useCallback(() => {
    close();
    clear();
  }, [close, clear]);

  const handleApply = useCallback(() => {
    applyAllAccepted();
  }, []);

  const handleDiscard = useCallback(() => {
    setPendingEdits([]);
  }, [setPendingEdits]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.modalTitle}>Talk to Plan</h2>
            {unifiedPlan && (
              <span className={styles.revisionBadge}>
                rev {unifiedPlan.revision ?? 1}
              </span>
            )}
          </div>
          <button className={styles.closeBtn} onClick={handleClose} type="button">
            Close
          </button>
        </div>

        <VoicePane />
        <AnalysisPane />

        <div className={styles.footer}>
          <button
            className={styles.discardBtn}
            onClick={handleDiscard}
            disabled={pendingEdits.length === 0}
            type="button"
          >
            Discard Draft
          </button>
          <button
            className={styles.applyBtn}
            onClick={handleApply}
            disabled={acceptedCount === 0}
            type="button"
          >
            Apply {acceptedCount > 0 ? `${acceptedCount} edit${acceptedCount > 1 ? 's' : ''}` : 'selected edits'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 4: Commit**

```bash
git add src/components/PlanTalkModal/PlanTalkModal.tsx src/components/PlanTalkModal/PlanTalkModal.module.css
git commit -m "feat(modal): add Discard Draft button and footer polish"
```

---

### Task 11: Final Type-Check and Dev Server Verification

**Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 2: Dev server smoke test**

Run: `npm run dev`
Expected: compiles without errors

**Step 3: Commit any remaining changes and tag**

```bash
git add -A
git status
# If there are unstaged changes, commit them
git commit -m "chore: phase 2 cleanup"
```
