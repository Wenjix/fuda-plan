# V3 Spec: Talk to the Plan (Voice + Reflective Plan QA)

## Summary
`Talk to the Plan` is a guided, human-centric review workflow for the **unified plan** that lets users speak their reasoning out loud, get transcript-driven AI gap analysis, and apply suggested plan edits with explicit approval.

This v3 spec locks these product decisions:
1. Voice interaction is **push-to-talk turns**.
2. Plan changes are **suggested first, user-approved**.
3. ElevenLabs integration is **browser BYOK** for initial release.
4. Launch points are **both** Synthesis panel and Toolbar.
5. Data retention is **transcript-only persistence** (no raw audio persistence).
6. AI output is **gap cards + proposed edits** (not narrative-only).

---

## Product Scope

## In Scope
1. New modal workflow for “Talk to the Plan.”
2. Audio capture and speech-to-text transcription.
3. Structured comparison of transcript content against current unified plan.
4. AI spoken/text explanation of gaps and understanding.
5. Proposed plan edits with explicit user approval before apply.
6. Transcript persistence per session/unified-plan revision.

## Out of Scope
1. Real-time duplex voice conversation.
2. Auto-applying plan edits without user approval.
3. Storing raw audio recordings.
4. Backend proxy integration in v3.0.
5. Multi-user collaborative voice review.

---

## UX Specification

## Entry Points
1. Add `Talk to Plan` CTA in `SynthesisPanel` header area when unified plan exists.
2. Add toolbar icon/button for quick access.
3. If no unified plan exists, button opens modal in disabled/explainer state with CTA `Generate Unified Plan first`.

## Modal Structure
1. Left pane: voice controls and transcript thread.
2. Right pane: AI understanding panel, gap cards, proposed edits.
3. Header: session topic, plan revision badge, key status indicators (`Mic`, `Transcription`, `AI`, `TTS`).
4. Footer: `Close`, `Apply Selected Edits`, `Apply All`, `Discard Draft`.

## Turn Model
1. User presses and holds (or click-to-toggle, configurable) `Talk` button.
2. On stop, audio chunk is transcribed.
3. Transcript turn is appended to conversation.
4. AI analyzes transcript + unified plan and returns:
   - understanding summary
   - section-level gap cards
   - proposed edit objects
5. AI response is shown as cards and optionally read aloud via TTS.
6. User can approve/reject each proposed edit independently.

## UX States
1. `idle`: ready for next user turn.
2. `recording`: mic active, live waveform/timer.
3. `transcribing`: spinner with optimistic transcript placeholder.
4. `analyzing`: AI compares transcript against plan.
5. `responding`: response rendered + optional TTS playback.
6. `error`: recoverable issue card with retry actions.
7. `applied`: edits committed and plan revision incremented.

## Human-Centric Interaction Rules
1. AI explanations must be concrete and section-specific.
2. Every gap card must tie to a named unified-plan section.
3. Proposed edits must be understandable in plain language before schema form.
4. User remains in control: no hidden plan mutation.
5. Keep cognitive load low: max 5 high-priority gap cards per turn, with overflow in “More findings”.

---

## Data and Type Changes

## New Core Types
```ts
type PlanTalkSpeaker = 'user' | 'ai';

interface PlanTalkTurn {
  id: string;
  sessionId: string;
  unifiedPlanId: string;
  turnIndex: number;
  speaker: PlanTalkSpeaker;
  transcriptText: string;        // persisted
  source: 'voice' | 'typed';
  createdAt: string;
}

interface PlanGapCard {
  id: string;
  sectionKey: 'goals' | 'assumptions' | 'strategy' | 'milestones' | 'risks' | 'nextActions';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidenceFromTranscript: string[];
  rationale: string;
}

interface ProposedPlanEdit {
  id: string;
  sectionKey: 'goals' | 'assumptions' | 'strategy' | 'milestones' | 'risks' | 'nextActions';
  operation: 'add_section' | 'update_section' | 'remove_section' | 'update_content_bullet';
  targetHeading?: string;
  draftHeading?: string;
  draftContent?: string[];
  confidence: number; // 0..1
  reason: string;
  approved: boolean;
}

interface PlanReflectionResponse {
  understanding: string;
  gapCards: PlanGapCard[];
  proposedEdits: ProposedPlanEdit[];
  unresolvedQuestions: string[];
}
```

## Settings Schema Extensions
Add fields to `AppSettingsSchema`:
1. `elevenLabsApiKey: z.string().default('')`
2. `voiceTtsEnabled: z.boolean().default(true)`
3. `voiceAutoPlayAi: z.boolean().default(true)`
4. `voiceInputMode: z.enum(['hold_to_talk','toggle']).default('hold_to_talk')`
5. `voiceTtsVoiceId: z.string().default('')`

---

## Persistence and Storage

## New IndexedDB Store
Add `planTalkTurns` store to main session DB schema:
1. key: `id`
2. indexes:
   - `by-session` -> `sessionId`
   - `by-unified-plan` -> `unifiedPlanId`

## Persistence Rules
1. Persist transcript turns only.
2. Do not persist raw audio blobs.
3. Do not persist transient waveform/audio buffer state.
4. Persist pending proposed edits only in memory until user applies.
5. On session restore, load transcript history tied to active unified plan.

## Migration
1. Bump `DB_VERSION` from `1` to `2`.
2. Add `planTalkTurns` object store in upgrade block.
3. Backward compatibility:
   - existing sessions load with empty talk history.
   - no changes required to existing unified plan payload shape.

---

## Architecture and File-Level Plan

## New Files
1. `src/components/TalkToPlan/TalkToPlanModal.tsx`
2. `src/components/TalkToPlan/TalkToPlanModal.module.css`
3. `src/components/TalkToPlan/VoiceRecorder.tsx`
4. `src/components/TalkToPlan/GapCardList.tsx`
5. `src/components/TalkToPlan/ProposedEditsPanel.tsx`
6. `src/store/talk-to-plan-store.ts`
7. `src/store/talk-to-plan-actions.ts`
8. `src/services/voice/elevenlabs-client.ts`
9. `src/services/voice/media-recorder.ts`
10. `src/generation/prompts/plan-reflection.ts`
11. `src/core/types/plan-talk.ts`

## Updated Files
1. `src/components/SynthesisPanel/SynthesisPanel.tsx` (add CTA and open handler)
2. `src/components/Toolbar/Toolbar.tsx` (secondary entry point)
3. `src/persistence/schema.ts` (new store type)
4. `src/persistence/repository.ts` (CRUD/load envelope additions)
5. `src/persistence/hooks.ts` (save/restore transcripts)
6. `src/persistence/settings-store.ts` (new voice settings)
7. `src/core/types/index.ts` (export new types)

---

## Runtime Flow

## Voice Capture
1. Use browser `MediaRecorder` API for chunk capture.
2. Convert to accepted mime for ElevenLabs STT.
3. Send chunk to ElevenLabs STT with `xi-api-key` from settings.
4. Receive transcription text and append as user turn.

## AI Analysis
1. Build `plan reflection prompt` from:
   - unified plan sections
   - recent transcript turns
   - session topic
2. Run generation through existing provider pipeline (Gemini/mock fallback behavior).
3. Parse with new schema gate `plan_reflection`.
4. Render `understanding`, `gapCards`, `proposedEdits`.

## TTS
1. If `voiceTtsEnabled`, generate audio for AI summary text using ElevenLabs TTS.
2. Auto-play if `voiceAutoPlayAi=true`.
3. Provide replay button per AI response.

## Edit Application
1. User approves one or more `ProposedPlanEdit`.
2. Apply changes to `semanticStore.unifiedPlan.sections`.
3. Recompute unified plan `evidence` where required.
4. Update unified plan metadata:
   - `updatedAt` (new field to add)
   - `revision` (new field to add, starts at 1)
5. Record “applied edit” summary turn in transcript thread.

---

## Public API / Interface Additions

## JobType and Schema Gates
1. Add `jobType: 'plan_reflection'`.
2. Add `PlanReflectionResponseSchema` to validation map.
3. Keep existing synthesis jobs unchanged.

## Semantic Store Additions
1. `planTalkTurns: PlanTalkTurn[]`
2. `addPlanTalkTurn(turn)`
3. `getPlanTalkTurnsByUnifiedPlan(unifiedPlanId)`
4. `clearPlanTalkTurnsForUnifiedPlan(unifiedPlanId)`

## UnifiedPlan Type Evolution
Add non-breaking fields:
1. `revision: z.number().int().positive().default(1)`
2. `updatedAt: ISODateTimeSchema.optional()`

---

## Error Handling and Fallbacks

1. Missing ElevenLabs key:
   - show inline setup card
   - allow typed text turns in same modal
2. Mic permission denied:
   - fallback to typed input only
3. STT failure:
   - keep raw “turn failed” card with retry upload action
4. TTS failure:
   - keep text response, show “audio unavailable” toast
5. AI parse failure:
   - show safe fallback summary: “Could not generate structured edits this turn”
6. Offline mode:
   - disable voice actions, allow read-only transcript and plan view

---

## Security and Privacy Defaults

1. Browser BYOK accepted for v3.0.
2. Store ElevenLabs key in existing settings store (same pattern as Gemini key).
3. Never log API keys.
4. Never persist raw microphone audio.
5. Persist transcript text only, scoped by session and unified-plan ID.
6. Add explicit Settings warning: “Voice transcription is sent to ElevenLabs when enabled.”

---

## Testing Specification

## Unit Tests
1. `plan-reflection.schema.test.ts`: validates all required response fields.
2. `talk-to-plan-store.test.ts`: turn append, retrieval, apply-edit state transitions.
3. `proposed-edits-apply.test.ts`: each edit operation mutates correct section.
4. `elevenlabs-client.test.ts`: request shaping, error mapping, timeout behavior.

## Component Tests
1. `TalkToPlanModal.test.tsx`:
   - opens from synthesis CTA and toolbar
   - state transitions (`recording` -> `transcribing` -> `analyzing` -> `responding`)
2. `GapCardList.test.tsx`:
   - renders severity and section labels correctly
3. `ProposedEditsPanel.test.tsx`:
   - approve/reject/apply behavior
4. `Settings API tab`:
   - ElevenLabs key field render, mask/unmask, status indicator

## Integration Tests
1. Full happy path:
   - start voice turn -> transcript -> AI gaps -> approve edits -> unified plan updated
2. No-key path:
   - typed-only fallback works
3. Session restore:
   - transcript history loads for same unified plan
4. Multi-turn:
   - turn index ordering and context carry-over stable over 10+ turns

## Regression Tests
1. Existing lane-plan and synthesis flows unchanged.
2. Existing export still works with unified plan and now includes transcript history only if explicitly added to export schema.
3. Dialogue panel functionality unaffected.

---

## Acceptance Criteria

1. Users can open Talk to Plan from both SynthesisPanel and Toolbar.
2. Users can complete push-to-talk turn and receive transcript.
3. AI returns structured gap cards and proposed edits.
4. No plan content changes until user explicitly applies edits.
5. Applied edits update unified plan and increment revision.
6. Transcript persists across reload; audio does not.
7. Feature works without ElevenLabs key in typed fallback mode.
8. No regressions in existing synthesis and export workflows.

---

## Rollout Plan

1. `v3.0-alpha`
   - Modal shell, typed-turn fallback, AI gap cards, proposed edits (no mic/TTS)
2. `v3.0-beta`
   - Mic capture + ElevenLabs STT + transcript persistence + apply-edit flow
3. `v3.0`
   - ElevenLabs TTS playback, settings polish, accessibility pass, telemetry
4. `v3.1`
   - Hardening and optional backend-proxy migration path for voice services

---

## Assumptions and Defaults

1. Unified plan exists before meaningful Talk-to-Plan use.
2. Browser supports `MediaRecorder` for voice mode.
3. ElevenLabs browser calls are permitted in initial release.
4. Voice is optional; typed mode always available as fallback.
5. Transcript persistence is session-local and tied to unified-plan revision lineage.
6. Initial release remains single-user, single-session context.
