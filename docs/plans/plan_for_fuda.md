---

# FUDA Plan: Comprehensive Implementation Specification

## 1. Project Overview

### What FUDA Plan Is

FUDA Plan is a client-side planning workspace where a single user explores a topic through multiple AI "lenses" (lanes), conducts Socratic dialogue to stress-test ideas, promotes strong insights as evidence, generates per-lane plans, and synthesizes those plans into one unified strategy. Every section of the final plan traces back to the exploration nodes that informed it.

The name FUDA stands for the core loop: **F**rame, **U**npack, **D**ebate, **A**ct.

### Product Vision

A solo user opens FUDA Plan, types a topic (e.g., "Should we migrate from monolith to microservices?"), and the system creates four exploration lanes -- each driven by a distinct AI persona (Expansive, Analytical, Pragmatic, Socratic). The user navigates an exploration tree within each lane using a 6-direction Conversation Compass, engages in Socratic dialogue to challenge their assumptions, promotes the strongest nodes as evidence, generates per-lane structured plans, and finally runs a map-reduce synthesis pipeline that produces a unified plan with conflict resolution and full provenance back to source exploration.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.x |
| Language | TypeScript | 5.6+ |
| Build Tool | Vite | 6.x |
| Canvas | @xyflow/react | 12.x |
| State Management | Zustand | 5.x |
| Schema Validation | Zod | 3.x |
| Persistence | idb (IndexedDB wrapper) | 8.x |
| LLM Provider | Gemini API (+ mock fallback) | 2.0-flash |
| Testing | Vitest + @testing-library/react | latest |
| Linting | ESLint + Prettier | latest |

### What This Is Not (v1 Non-Goals)

- No backend services, API gateway, or job queue
- No CRDTs or real-time collaboration
- No event-sourcing infrastructure
- No multi-provider API (single Gemini provider + mock)
- No CLI tooling in v1

---

## 2. Architecture

### 5-Layer System

```
Layer 5: Persistence          IndexedDB via idb, Zod-validated envelopes
Layer 4: UI Components        React 19, React Flow, CSS Modules
Layer 3: State Management     Zustand split stores (semantic, view, session)
Layer 2: Generation Pipeline  Context Compiler -> Prompt Builder -> Provider -> Parser -> Quality Gates
Layer 1: Domain Core          Zod schemas, FSMs, graph traversal, pure functions (no React)
```

The critical property: **Layer 1 has zero React imports.** It is testable in pure Node.js/Vitest without any browser or DOM dependencies. Layers 2 and 3 depend on Layer 1 but not on Layer 4.

### Directory Structure

```
fuda-plan/
  package.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  index.html
  .env.example                    # VITE_GEMINI_API_KEY=
  src/
    main.tsx                      # React root mount
    App.tsx                       # Router/layout shell

    core/                         # Layer 1: Domain Core (NO React imports)
      types/
        primitives.ts             # UUID, ISODateTime, shared branded types
        session.ts                # Session, SessionStatus, ChallengeDepth
        lane.ts                   # ModelLane, LaneProvider
        node.ts                   # SemanticNode, NodeType, NodeFSMState
        edge.ts                   # SemanticEdge
        dialogue.ts               # DialogueTurn, DialecticMode, TurnType, SuggestedResponse
        promotion.ts              # Promotion, PromotionReason
        plan.ts                   # LanePlan, PlanSection, EvidenceRef
        unified-plan.ts           # UnifiedPlan, ConflictResolution
        job.ts                    # GenerationJob, JobFSMState
        context.ts                # CompiledContext, ContextRole
        index.ts                  # Re-exports all types
      fsm/
        session-fsm.ts            # Session state machine with guards
        node-fsm.ts               # Node state machine with guards
        job-fsm.ts                # Job state machine with guards
      graph/
        traversal.ts              # BFS ancestor/sibling/cousin walk
        context-compiler.ts       # Token-budgeted prompt context builder
        staleness.ts              # Downstream stale propagation
      validation/
        quality-gates.ts          # Specificity, uniqueness, branchability
        schema-gates.ts           # Zod parse + retry logic

    generation/                   # Layer 2: Generation Pipeline
      providers/
        types.ts                  # GenerationProvider interface
        gemini.ts                 # Gemini API provider (streaming + non-streaming)
        mock.ts                   # Deterministic mock provider
        index.ts                  # Provider selection logic
      prompts/
        system-preambles.ts       # Persona system prompts
        path-questions.ts         # Compass path question prompts
        answer.ts                 # Answer/illumination prompts
        branch.ts                 # Branch generation prompts
        dialogue.ts               # Socratic dialogue prompts (4 modes)
        lane-plan.ts              # Lane plan synthesis prompts
        unified-plan.ts           # Map-reduce synthesis prompts
        index.ts                  # Prompt builder entry point
      personas.ts                 # 4 exploration personas + planner
      pipeline.ts                 # Unified generate() with middleware hooks

    store/                        # Layer 3: State Management
      semantic-store.ts           # Nodes, edges, lanes, promotions, plans
      view-store.ts               # React Flow positions, UI state, collapse/expand
      session-store.ts            # Active session, challenge depth, active lane
      job-store.ts                # Generation job queue and status
      actions/
        exploration.ts            # Explore, answer, branch actions
        dialogue.ts               # Socratic dialogue actions
        promotion.ts              # Promote/unpromote with evidence binding
        planning.ts               # Lane plan + unified plan actions
        session.ts                # Session lifecycle actions

    persistence/                  # Layer 5: Persistence
      schema.ts                   # IndexedDB schema definition
      repository.ts               # CRUD operations with Zod validation
      migration.ts                # Schema version migration
      hooks.ts                    # useAutoSave, useSessionRestore

    components/                   # Layer 4: UI Components
      TopicInput/
        TopicInput.tsx
        TopicInput.module.css
      Canvas/
        FudaCanvas.tsx            # React Flow wrapper
        FudaCanvas.module.css
      ExplorationCard/
        ExplorationCard.tsx       # Single-purpose: exploration nodes only
        ExplorationCard.module.css
      PlanCard/
        PlanCard.tsx              # Single-purpose: plan nodes only
        PlanCard.module.css
      DialoguePanel/
        DialoguePanel.tsx         # Socratic dialogue sidebar
        DialoguePanel.module.css
      ConversationCompass/
        ConversationCompass.tsx
        ConversationCompass.module.css
      LaneSelector/
        LaneSelector.tsx          # Lane tabs/switcher
        LaneSelector.module.css
      PromotionBadge/
        PromotionBadge.tsx        # Inline promote/unpromote control
        PromotionBadge.module.css
      Toolbar/
        Toolbar.tsx
        Toolbar.module.css
      PlanPanel/
        PlanPanel.tsx             # Lane plan + unified plan viewer
        PlanPanel.module.css
      EvidenceTrail/
        EvidenceTrail.tsx         # Shows provenance links in plan sections
        EvidenceTrail.module.css
      shared/
        Connector.tsx             # Custom edge component
        Connector.css
        StreamingText.tsx         # Shared streaming text display
        StatusBadge.tsx           # FSM state badges
        SuggestedResponses.tsx    # Clickable suggested user responses

    utils/
      motion.ts                   # Animation choreography constants
      ids.ts                      # UUID generation
      tokens.ts                   # Token estimation utility

    __tests__/                    # Test files mirror src structure
      core/
        fsm/
          session-fsm.test.ts
          node-fsm.test.ts
          job-fsm.test.ts
        graph/
          context-compiler.test.ts
          traversal.test.ts
          staleness.test.ts
        validation/
          quality-gates.test.ts
      generation/
        pipeline.test.ts
        prompts.test.ts
      store/
        semantic-store.test.ts
        actions/
          promotion.test.ts
          planning.test.ts
      integration/
        full-flow.test.ts
```

### Data Flow Diagram

```
[Topic Input] --> [Session Store: create session + 4 lanes]
                        |
                        v
[Conversation Compass] --> [Semantic Store: add root + branch nodes]
                        |
                        v
[Context Compiler] --> traverse graph, budget tokens
                        |
                        v
[Generation Pipeline] --> [Provider (Gemini/Mock)] --> stream response
                        |
                        v
[Quality Gates] --> validate output shape + content quality
                        |
                        v
[Semantic Store: update node] --> [View Store: projection] --> [React Flow: render]
                        |
                        v
[Persistence: debounced save to IndexedDB]
```

---

## 3. Domain Types

All types live in `src/core/types/`. Every type has both a Zod schema (for runtime validation at persistence and generation boundaries) and an inferred TypeScript type.

### `src/core/types/primitives.ts`

```typescript
import { z } from 'zod';

export const UUIDSchema = z.string().uuid();
export type UUID = z.infer<typeof UUIDSchema>;

export const ISODateTimeSchema = z.string().datetime({ offset: true });
export type ISODateTime = z.infer<typeof ISODateTimeSchema>;

export const PathTypeSchema = z.enum([
  'clarify',
  'go-deeper',
  'challenge',
  'apply',
  'connect',
  'surprise',
]);
export type PathType = z.infer<typeof PathTypeSchema>;

export const ChallengeDepthSchema = z.enum(['gentle', 'balanced', 'intense']);
export type ChallengeDepth = z.infer<typeof ChallengeDepthSchema>;
```

### `src/core/types/session.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema, ChallengeDepthSchema } from './primitives';

// Session FSM states
export const SessionStatusSchema = z.enum([
  'exploring',           // User is exploring in lanes
  'lane_planning',       // At least one lane plan exists
  'synthesis_ready',     // >= 3 lane plans, synthesis enabled
  'synthesized',         // Unified plan generated
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const PlanningSessionSchema = z.object({
  id: UUIDSchema,
  topic: z.string().min(10, 'Topic must be at least 10 characters'),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  challengeDepth: ChallengeDepthSchema.default('balanced'),
  activeLaneId: UUIDSchema,
  status: SessionStatusSchema.default('exploring'),
  version: z.literal('fuda_v1'),
});
export type PlanningSession = z.infer<typeof PlanningSessionSchema>;
```

### `src/core/types/lane.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema } from './primitives';

export const PersonaIdSchema = z.enum([
  'expansive',    // Was "gemini" - philosophical, big-picture
  'analytical',   // Was "claude" - structured, logical
  'pragmatic',    // Was "gpt" - practical, real-world
  'socratic',     // Questioning, challenging
]);
export type PersonaId = z.infer<typeof PersonaIdSchema>;

export const ModelLaneSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  label: z.string().min(1),
  personaId: PersonaIdSchema,
  colorToken: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  isEnabled: z.boolean().default(true),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
});
export type ModelLane = z.infer<typeof ModelLaneSchema>;

// Default lane definitions
export const DEFAULT_LANES: Array<{
  personaId: PersonaId;
  label: string;
  colorToken: string;
}> = [
  { personaId: 'expansive',  label: 'Expansive',  colorToken: '#7B4FBF' },
  { personaId: 'analytical', label: 'Analytical', colorToken: '#4A90D9' },
  { personaId: 'pragmatic',  label: 'Pragmatic',  colorToken: '#3DAA6D' },
  { personaId: 'socratic',   label: 'Socratic',   colorToken: '#D94F4F' },
];
```

### `src/core/types/node.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema, PathTypeSchema } from './primitives';
import { PersonaIdSchema } from './lane';

// Node FSM states
export const NodeFSMStateSchema = z.enum([
  'idle',         // Created, no generation attempted
  'generating',   // LLM call in progress
  'resolved',     // Content generated successfully
  'failed',       // Generation failed (retryable)
  'stale',        // Upstream content changed, re-generation suggested
]);
export type NodeFSMState = z.infer<typeof NodeFSMStateSchema>;

export const NodeTypeSchema = z.enum([
  'root',          // Lane root question
  'exploration',   // Branch/follow-up question
  'lane_plan',     // Per-lane structured plan
  'unified_plan',  // Synthesis output
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const AnswerSchema = z.object({
  summary: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1).max(8),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const BranchQualitySchema = z.object({
  novelty: z.number().min(0).max(1),
  specificity: z.number().min(0).max(1),
  challenge: z.number().min(0).max(1),
});
export type BranchQuality = z.infer<typeof BranchQualitySchema>;

export const SemanticNodeSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  laneId: UUIDSchema,
  parentId: UUIDSchema.nullable(),
  nodeType: NodeTypeSchema,
  pathType: PathTypeSchema,
  question: z.string().min(1),
  context: z.string().optional(),
  answer: AnswerSchema.optional(),
  fsmState: NodeFSMStateSchema.default('idle'),
  promoted: z.boolean().default(false),
  quality: BranchQualitySchema.optional(),
  depth: z.number().int().nonnegative().default(0),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
});
export type SemanticNode = z.infer<typeof SemanticNodeSchema>;
```

### `src/core/types/edge.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema } from './primitives';

export const SemanticEdgeSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  laneId: UUIDSchema,
  sourceNodeId: UUIDSchema,
  targetNodeId: UUIDSchema,
  label: z.string().optional(),
  createdAt: ISODateTimeSchema,
});
export type SemanticEdge = z.infer<typeof SemanticEdgeSchema>;
```

### `src/core/types/dialogue.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema } from './primitives';

export const DialecticModeSchema = z.enum([
  'socratic',          // Question-only, surfaces contradictions
  'devil_advocate',    // Argues the opposite position
  'steelman',          // Strengthens the user's weakest argument
  'collaborative',     // Builds together, fills gaps
]);
export type DialecticMode = z.infer<typeof DialecticModeSchema>;

export const TurnTypeSchema = z.enum([
  'challenge',     // Directly challenges an assumption
  'pushback',      // Resists a conclusion
  'reframe',       // Offers alternative framing
  'probe',         // Asks for deeper justification
  'concede',       // Acknowledges a strong point
  'synthesize',    // Combines multiple threads
]);
export type TurnType = z.infer<typeof TurnTypeSchema>;

export const SuggestedResponseSchema = z.object({
  text: z.string().min(1),
  intent: z.enum(['defend', 'concede', 'redirect', 'deepen', 'conclude']),
});
export type SuggestedResponse = z.infer<typeof SuggestedResponseSchema>;

export const DialogueTurnSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  nodeId: UUIDSchema,                   // The exploration node this dialogue is attached to
  turnIndex: z.number().int().nonnegative(),
  speaker: z.enum(['user', 'ai']),
  dialecticMode: DialecticModeSchema,
  turnType: TurnTypeSchema.optional(),   // Only for AI turns
  content: z.string().min(1),
  suggestedResponses: z.array(SuggestedResponseSchema).max(3).optional(),  // Only for AI turns
  createdAt: ISODateTimeSchema,
});
export type DialogueTurn = z.infer<typeof DialogueTurnSchema>;
```

### `src/core/types/promotion.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema } from './primitives';

export const PromotionReasonSchema = z.enum([
  'insightful_reframe',
  'actionable_detail',
  'risk_identification',
  'assumption_challenge',
  'cross_domain_link',
]);
export type PromotionReason = z.infer<typeof PromotionReasonSchema>;

export const PromotionSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  laneId: UUIDSchema,
  nodeId: UUIDSchema,
  reason: PromotionReasonSchema,
  note: z.string().max(500).optional(),
  createdAt: ISODateTimeSchema,
});
export type Promotion = z.infer<typeof PromotionSchema>;
```

### `src/core/types/plan.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema } from './primitives';

// EvidenceRef binds a plan section to the source node that informed it
export const EvidenceRefSchema = z.object({
  nodeId: UUIDSchema,
  laneId: UUIDSchema,
  quote: z.string().min(1),                  // Verbatim excerpt from the source node
  relevance: z.enum(['primary', 'supporting']),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const PlanSectionSchema = z.object({
  heading: z.string().min(1),
  content: z.array(z.string().min(1)).min(1),
  evidence: z.array(EvidenceRefSchema).min(1),
});
export type PlanSection = z.infer<typeof PlanSectionSchema>;

export const StructuredPlanSchema = z.object({
  goals: z.array(PlanSectionSchema).min(1),
  assumptions: z.array(PlanSectionSchema).min(1),
  strategy: z.array(PlanSectionSchema).min(1),
  milestones: z.array(PlanSectionSchema).min(1),
  risks: z.array(PlanSectionSchema).min(1),
  nextActions: z.array(PlanSectionSchema).min(1),
});
export type StructuredPlan = z.infer<typeof StructuredPlanSchema>;

export const LanePlanSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  laneId: UUIDSchema,
  title: z.string().min(1),
  sections: StructuredPlanSchema,
  sourcePromotionIds: z.array(UUIDSchema).min(1),
  confidence: z.number().min(0).max(1),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
});
export type LanePlan = z.infer<typeof LanePlanSchema>;
```

### `src/core/types/unified-plan.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema } from './primitives';
import { StructuredPlanSchema, EvidenceRefSchema } from './plan';

export const ConflictResolutionSchema = z.object({
  description: z.string().min(1),
  laneAId: UUIDSchema,
  laneBId: UUIDSchema,
  resolution: z.string().min(1),
  tradeoff: z.string().min(1),
});
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

export const UnifiedPlanSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  sourcePlanIds: z.array(UUIDSchema).min(3),
  title: z.string().min(1),
  sections: StructuredPlanSchema,
  conflictsResolved: z.array(ConflictResolutionSchema).default([]),
  unresolvedQuestions: z.array(z.string().min(1)).default([]),
  evidence: z.array(EvidenceRefSchema).min(1),
  createdAt: ISODateTimeSchema,
});
export type UnifiedPlan = z.infer<typeof UnifiedPlanSchema>;
```

### `src/core/types/job.ts`

```typescript
import { z } from 'zod';
import { UUIDSchema, ISODateTimeSchema } from './primitives';

export const JobFSMStateSchema = z.enum([
  'queued',     // Waiting to execute
  'running',    // LLM call in progress
  'succeeded',  // Completed successfully
  'retrying',   // Failed, retrying
  'failed',     // Exhausted retries
]);
export type JobFSMState = z.infer<typeof JobFSMStateSchema>;

export const JobTypeSchema = z.enum([
  'answer',         // Generate answer for a node
  'branch',         // Generate branch questions
  'dialogue_turn',  // Generate Socratic dialogue turn
  'lane_plan',      // Generate lane plan
  'unified_plan',   // Generate unified plan
  'path_questions',  // Generate compass path questions
]);
export type JobType = z.infer<typeof JobTypeSchema>;

export const GenerationJobSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  targetNodeId: UUIDSchema,
  jobType: JobTypeSchema,
  fsmState: JobFSMStateSchema.default('queued'),
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
  idempotencyKey: z.string().min(1),           // Prevents duplicate jobs
  error: z.string().optional(),
  createdAt: ISODateTimeSchema,
  resolvedAt: ISODateTimeSchema.optional(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
```

### `src/core/types/context.ts`

```typescript
import { z } from 'zod';

export const ContextRoleSchema = z.enum([
  'ancestor',   // Direct parent chain up to root
  'sibling',    // Other children of the same parent
  'cousin',     // Children of parent's siblings (for breadth)
]);
export type ContextRole = z.infer<typeof ContextRoleSchema>;

export const ContextEntrySchema = z.object({
  nodeId: z.string(),
  role: ContextRoleSchema,
  distanceFromTarget: z.number().int().nonnegative(),
  content: z.string(),
  tokenEstimate: z.number().int().nonnegative(),
});
export type ContextEntry = z.infer<typeof ContextEntrySchema>;

export const CompiledContextSchema = z.object({
  entries: z.array(ContextEntrySchema),
  totalTokenEstimate: z.number().int().nonnegative(),
  targetNodeId: z.string(),
  formatted: z.string(),          // Ready-to-inject prompt string
});
export type CompiledContext = z.infer<typeof CompiledContextSchema>;
```

---

## 4. State Machines

All FSMs live in `src/core/fsm/` and are pure functions with no store dependency. They take current state and return either the new state or null (invalid transition). The stores call these functions and enforce the result.

### Session FSM (`src/core/fsm/session-fsm.ts`)

```typescript
import type { SessionStatus } from '../types/session';

type SessionEvent =
  | { type: 'LANE_PLAN_CREATED'; lanePlanCount: number }
  | { type: 'LANE_PLAN_DELETED'; lanePlanCount: number }
  | { type: 'SYNTHESIS_TRIGGERED' }
  | { type: 'SYNTHESIS_COMPLETED' }
  | { type: 'RESET_TO_EXPLORING' };

const SYNTHESIS_THRESHOLD = 3;

export function sessionTransition(
  current: SessionStatus,
  event: SessionEvent
): SessionStatus | null {
  switch (current) {
    case 'exploring':
      if (event.type === 'LANE_PLAN_CREATED' && event.lanePlanCount >= 1) {
        return event.lanePlanCount >= SYNTHESIS_THRESHOLD
          ? 'synthesis_ready'
          : 'lane_planning';
      }
      return null;

    case 'lane_planning':
      if (event.type === 'LANE_PLAN_CREATED' && event.lanePlanCount >= SYNTHESIS_THRESHOLD) {
        return 'synthesis_ready';
      }
      if (event.type === 'LANE_PLAN_DELETED' && event.lanePlanCount === 0) {
        return 'exploring';
      }
      if (event.type === 'RESET_TO_EXPLORING') return 'exploring';
      return null;

    case 'synthesis_ready':
      if (event.type === 'SYNTHESIS_TRIGGERED') return 'synthesized';
      if (event.type === 'LANE_PLAN_DELETED' && event.lanePlanCount < SYNTHESIS_THRESHOLD) {
        return event.lanePlanCount === 0 ? 'exploring' : 'lane_planning';
      }
      if (event.type === 'RESET_TO_EXPLORING') return 'exploring';
      return null;

    case 'synthesized':
      if (event.type === 'RESET_TO_EXPLORING') return 'exploring';
      // Allow re-synthesis if lane plans change
      if (event.type === 'LANE_PLAN_CREATED') return 'synthesis_ready';
      if (event.type === 'LANE_PLAN_DELETED' && event.lanePlanCount < SYNTHESIS_THRESHOLD) {
        return event.lanePlanCount === 0 ? 'exploring' : 'lane_planning';
      }
      return null;
  }
}
```

**State diagram:**

```
exploring --[plan_created, count>=1]--> lane_planning
exploring --[plan_created, count>=3]--> synthesis_ready
lane_planning --[plan_created, count>=3]--> synthesis_ready
lane_planning --[plan_deleted, count==0]--> exploring
synthesis_ready --[synthesis_triggered]--> synthesized
synthesis_ready --[plan_deleted, count<3]--> lane_planning
synthesized --[plan_created]--> synthesis_ready (allows re-synthesis)
synthesized --[plan_deleted, count<3]--> lane_planning
ANY --[reset]--> exploring
```

### Node FSM (`src/core/fsm/node-fsm.ts`)

```typescript
import type { NodeFSMState } from '../types/node';

type NodeEvent =
  | { type: 'GENERATE_REQUESTED' }
  | { type: 'GENERATION_SUCCEEDED' }
  | { type: 'GENERATION_FAILED' }
  | { type: 'RETRY_REQUESTED' }
  | { type: 'UPSTREAM_CHANGED' }      // Parent content was edited
  | { type: 'REGENERATE_REQUESTED' }; // User wants fresh answer

export function nodeTransition(
  current: NodeFSMState,
  event: NodeEvent
): NodeFSMState | null {
  switch (current) {
    case 'idle':
      if (event.type === 'GENERATE_REQUESTED') return 'generating';
      return null;

    case 'generating':
      if (event.type === 'GENERATION_SUCCEEDED') return 'resolved';
      if (event.type === 'GENERATION_FAILED') return 'failed';
      return null; // No other transitions while generating

    case 'resolved':
      if (event.type === 'UPSTREAM_CHANGED') return 'stale';
      if (event.type === 'REGENERATE_REQUESTED') return 'generating';
      return null;

    case 'failed':
      if (event.type === 'RETRY_REQUESTED') return 'generating';
      return null;

    case 'stale':
      if (event.type === 'REGENERATE_REQUESTED') return 'generating';
      if (event.type === 'GENERATE_REQUESTED') return 'generating';
      return null;
  }
}

// Guard: promotion is only allowed on resolved nodes
export function canPromote(state: NodeFSMState): boolean {
  return state === 'resolved';
}

// Guard: branching is only allowed on resolved or idle nodes
export function canBranch(state: NodeFSMState): boolean {
  return state === 'resolved' || state === 'idle';
}
```

### Job FSM (`src/core/fsm/job-fsm.ts`)

```typescript
import type { JobFSMState } from '../types/job';

type JobEvent =
  | { type: 'START' }
  | { type: 'SUCCEED' }
  | { type: 'FAIL'; canRetry: boolean }
  | { type: 'RETRY' };

export function jobTransition(
  current: JobFSMState,
  event: JobEvent
): JobFSMState | null {
  switch (current) {
    case 'queued':
      if (event.type === 'START') return 'running';
      return null;

    case 'running':
      if (event.type === 'SUCCEED') return 'succeeded';
      if (event.type === 'FAIL') return event.canRetry ? 'retrying' : 'failed';
      return null;

    case 'retrying':
      if (event.type === 'RETRY') return 'running';
      return null;

    case 'succeeded':
      return null; // Terminal

    case 'failed':
      return null; // Terminal (dead letter)
  }
}
```

---

## 5. Phase 0: Foundation

**Goal:** Establish the type system, persistence layer, context compiler, FSMs, and test harness. Everything in this phase is headless -- zero React components.

**Deliverables:**

### 5a. Type System

- Create all Zod schemas in `src/core/types/` as specified in section 3
- Create `src/core/types/index.ts` that re-exports everything
- Ensure all types are usable without any React or browser imports

### 5b. FSM Implementation

- Implement `src/core/fsm/session-fsm.ts` with `sessionTransition()` + guard functions
- Implement `src/core/fsm/node-fsm.ts` with `nodeTransition()` + `canPromote()` + `canBranch()`
- Implement `src/core/fsm/job-fsm.ts` with `jobTransition()`
- Each FSM function is a pure function: `(currentState, event) => newState | null`

### 5c. Graph Traversal + Context Compiler

`src/core/graph/traversal.ts`:

```typescript
import type { SemanticNode, SemanticEdge } from '../types';

export interface AdjacencyIndex {
  childrenOf: Map<string, string[]>;  // parentId -> childIds
  parentOf: Map<string, string>;      // childId -> parentId
}

export function buildAdjacencyIndex(
  nodes: SemanticNode[],
  edges: SemanticEdge[]
): AdjacencyIndex {
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();

  for (const edge of edges) {
    const children = childrenOf.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    childrenOf.set(edge.sourceNodeId, children);
    parentOf.set(edge.targetNodeId, edge.sourceNodeId);
  }

  return { childrenOf, parentOf };
}

// Walk up to root, returning nodes from target to root
export function getAncestorChain(
  targetId: string,
  nodes: Map<string, SemanticNode>,
  index: AdjacencyIndex
): SemanticNode[] {
  const chain: SemanticNode[] = [];
  let current = targetId;
  while (true) {
    const parentId = index.parentOf.get(current);
    if (!parentId) break;
    const parent = nodes.get(parentId);
    if (!parent) break;
    chain.push(parent);
    current = parentId;
  }
  return chain; // Nearest ancestor first
}

// Get siblings (other children of the same parent)
export function getSiblings(
  targetId: string,
  nodes: Map<string, SemanticNode>,
  index: AdjacencyIndex
): SemanticNode[] {
  const parentId = index.parentOf.get(targetId);
  if (!parentId) return [];
  const children = index.childrenOf.get(parentId) ?? [];
  return children
    .filter(id => id !== targetId)
    .map(id => nodes.get(id))
    .filter((n): n is SemanticNode => n !== undefined);
}
```

`src/core/graph/context-compiler.ts`:

```typescript
import type { SemanticNode, SemanticEdge, CompiledContext, ContextEntry } from '../types';
import { buildAdjacencyIndex, getAncestorChain, getSiblings } from './traversal';

const DEFAULT_TOKEN_BUDGET = 4000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

function formatNodeContent(node: SemanticNode): string {
  const parts = [node.question];
  if (node.answer) {
    parts.push(node.answer.summary);
    parts.push(...node.answer.bullets);
  }
  return parts.join('\n');
}

export function compileContext(
  targetNodeId: string,
  allNodes: SemanticNode[],
  allEdges: SemanticEdge[],
  tokenBudget: number = DEFAULT_TOKEN_BUDGET
): CompiledContext {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  const index = buildAdjacencyIndex(allNodes, allEdges);
  const entries: ContextEntry[] = [];
  let usedTokens = 0;

  // 1. Ancestors (highest priority) -- pack nearest first
  const ancestors = getAncestorChain(targetNodeId, nodeMap, index);
  for (let i = 0; i < ancestors.length; i++) {
    const node = ancestors[i];
    const content = formatNodeContent(node);
    const tokens = estimateTokens(content);
    if (usedTokens + tokens > tokenBudget) break;
    entries.push({
      nodeId: node.id,
      role: 'ancestor',
      distanceFromTarget: i + 1,
      content,
      tokenEstimate: tokens,
    });
    usedTokens += tokens;
  }

  // 2. Siblings (medium priority) -- if budget allows
  const siblings = getSiblings(targetNodeId, nodeMap, index);
  for (const sibling of siblings) {
    const content = formatNodeContent(sibling);
    const tokens = estimateTokens(content);
    if (usedTokens + tokens > tokenBudget) break;
    entries.push({
      nodeId: sibling.id,
      role: 'sibling',
      distanceFromTarget: 1,
      content,
      tokenEstimate: tokens,
    });
    usedTokens += tokens;
  }

  // 3. Format into prompt string
  const formatted = formatContextForPrompt(entries, targetNodeId, nodeMap);

  return {
    entries,
    totalTokenEstimate: usedTokens,
    targetNodeId,
    formatted,
  };
}

function formatContextForPrompt(
  entries: ContextEntry[],
  targetNodeId: string,
  nodeMap: Map<string, SemanticNode>
): string {
  const lines = ['[GRAPH CONTEXT]'];

  const ancestors = entries
    .filter(e => e.role === 'ancestor')
    .sort((a, b) => b.distanceFromTarget - a.distanceFromTarget); // Root first

  for (const entry of ancestors) {
    const label = entry.distanceFromTarget === ancestors.length ? 'Root' : 'Ancestor';
    lines.push(`- ${label} (depth ${entry.distanceFromTarget}): "${entry.content.substring(0, 200)}"`);
  }

  const siblings = entries.filter(e => e.role === 'sibling');
  for (const entry of siblings) {
    const node = nodeMap.get(entry.nodeId);
    const stateLabel = node?.fsmState === 'resolved' ? 'Explored' : 'Unexplored';
    lines.push(`- Sibling (${stateLabel}): "${entry.content.substring(0, 150)}"`);
  }

  const target = nodeMap.get(targetNodeId);
  if (target) {
    lines.push(`- Current Node: "${target.question}"`);
  }

  return lines.join('\n');
}
```

### 5d. Persistence (IndexedDB)

`src/persistence/schema.ts`:

```typescript
import type { DBSchema } from 'idb';
import type { PlanningSession, ModelLane, SemanticNode, SemanticEdge,
              Promotion, LanePlan, UnifiedPlan, DialogueTurn, GenerationJob } from '../core/types';

export interface FudaDB extends DBSchema {
  sessions: {
    key: string; // session.id
    value: PlanningSession;
  };
  lanes: {
    key: string;
    value: ModelLane;
    indexes: { 'by-session': string };
  };
  nodes: {
    key: string;
    value: SemanticNode;
    indexes: { 'by-session': string; 'by-lane': string };
  };
  edges: {
    key: string;
    value: SemanticEdge;
    indexes: { 'by-session': string };
  };
  promotions: {
    key: string;
    value: Promotion;
    indexes: { 'by-session': string; 'by-lane': string };
  };
  lanePlans: {
    key: string;
    value: LanePlan;
    indexes: { 'by-session': string; 'by-lane': string };
  };
  unifiedPlans: {
    key: string;
    value: UnifiedPlan;
    indexes: { 'by-session': string };
  };
  dialogueTurns: {
    key: string;
    value: DialogueTurn;
    indexes: { 'by-session': string; 'by-node': string };
  };
  jobs: {
    key: string;
    value: GenerationJob;
    indexes: { 'by-session': string };
  };
}

export const DB_NAME = 'fuda-plan';
export const DB_VERSION = 1;
```

`src/persistence/repository.ts` will use `idb`'s `openDB` to create/open the database and provide typed CRUD operations. Every read from IndexedDB passes through the corresponding Zod schema before entering the store; every write validates with Zod before persisting.

### 5e. Testing Harness

- Configure Vitest in `vitest.config.ts` with `environment: 'node'` for `src/core/**` tests
- Write comprehensive tests for all three FSMs (every valid transition, every invalid transition rejected)
- Write tests for `context-compiler.ts` with a mock graph of 10-15 nodes
- Write tests for `traversal.ts` (ancestor chains, siblings)
- Write quality gate tests

**Phase 0 acceptance criteria:**
- [ ] All Zod schemas parse valid data and reject invalid data (test each)
- [ ] Session FSM handles all 4 states and all transitions correctly
- [ ] Node FSM enforces `canPromote` guard (only resolved)
- [ ] Job FSM handles retry with attempts counter
- [ ] Context compiler produces correct ancestor chain for 5-deep tree
- [ ] Context compiler respects token budget (stops packing when exceeded)
- [ ] IndexedDB repository round-trips a full session envelope
- [ ] All Phase 0 tests pass in `vitest` with zero browser dependencies

---

## 6. Phase 1: Single-Lane Exploration

**Goal:** Render the canvas, accept a topic, show the Conversation Compass, generate path questions, display answers with streaming, and support branching. Single lane only.

### 6a. Store Setup

Split Zustand into three stores:

`src/store/semantic-store.ts` -- Holds `SemanticNode[]`, `SemanticEdge[]`, `Promotion[]`, `LanePlan[]`, `UnifiedPlan | null`. No view/position data.

`src/store/view-store.ts` -- Holds a `Map<string, ViewNodeState>` where:
```typescript
interface ViewNodeState {
  semanticId: string;
  position: { x: number; y: number };
  isCollapsed: boolean;
  isAnswerVisible: boolean;
  isNew: boolean;
  spawnIndex: number;
}
```
Also holds `activeNodeId`, React Flow `onNodesChange`/`onEdgesChange` handlers.

`src/store/session-store.ts` -- Holds `PlanningSession | null`, `activeLaneId`, `challengeDepth`, `uiMode` ('topic_input' | 'compass' | 'exploring').

### 6b. View Projection

The view store subscribes to the semantic store and projects `SemanticNode[]` into React Flow `Node[]`:

```typescript
function projectToReactFlow(
  semanticNodes: SemanticNode[],
  semanticEdges: SemanticEdge[],
  viewStates: Map<string, ViewNodeState>,
  activeLaneId: string
): { nodes: RFNode[]; edges: RFEdge[] } {
  const laneNodes = semanticNodes.filter(n => n.laneId === activeLaneId);
  const laneEdges = semanticEdges.filter(e => e.laneId === activeLaneId);

  const nodes = laneNodes.map(sn => {
    const view = viewStates.get(sn.id);
    return {
      id: sn.id,
      type: getComponentType(sn.nodeType),  // 'explorationCard' | 'planCard'
      position: view?.position ?? { x: 0, y: 0 },
      data: sn,
    };
  });

  const edges = laneEdges.map(se => ({
    id: se.id,
    source: se.sourceNodeId,
    target: se.targetNodeId,
    type: 'fudaConnector',
  }));

  return { nodes, edges };
}

function getComponentType(nodeType: NodeType): string {
  switch (nodeType) {
    case 'root':
    case 'exploration':
      return 'explorationCard';
    case 'lane_plan':
    case 'unified_plan':
      return 'planCard';
  }
}
```

### 6c. Component Design (No God Component)

Instead of a single AtlasCard handling all node types, create specialized components:

- `ExplorationCard` -- Renders question, answer, branch buttons, promote button. Only handles `root` and `exploration` node types.
- `PlanCard` -- Renders structured plan sections with evidence links. Only handles `lane_plan` and `unified_plan` node types.
- `StreamingText` -- Shared component for real-time text display during generation.
- `SuggestedResponses` -- Renders clickable suggested responses (used by Socratic dialogue in Phase 2).

### 6d. Generation Pipeline

`src/generation/pipeline.ts`:

```typescript
import { compileContext } from '../core/graph/context-compiler';
import { buildPrompt } from './prompts';
import { getProvider } from './providers';
import { validateOutput } from '../core/validation/schema-gates';

export interface GenerateOptions {
  targetNodeId: string;
  jobType: JobType;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  session: PlanningSession;
  onChunk?: (delta: string) => void;
}

export async function generate(options: GenerateOptions): Promise<unknown> {
  // 1. Compile context from graph
  const context = compileContext(
    options.targetNodeId,
    options.nodes,
    options.edges
  );

  // 2. Build prompt with context + persona
  const prompt = buildPrompt(options.jobType, context, options.session);

  // 3. Call provider
  const provider = getProvider(options.session);
  const raw = options.onChunk
    ? await provider.generateStream(prompt, options.onChunk)
    : await provider.generate(prompt);

  // 4. Parse + validate
  const parsed = parseResponse(options.jobType, raw);
  const validated = validateOutput(options.jobType, parsed);

  return validated;
}
```

### 6e. Streaming

Streaming works the same way as v1 (SSE from Gemini), but the streaming text state lives in `view-store.ts`, not mixed into the semantic store. The semantic store only receives the final parsed result after streaming completes.

### 6f. Auto-save

`src/persistence/hooks.ts` provides `useAutoSave()` which subscribes to the semantic store and debounce-saves to IndexedDB every 500ms. On app load, `useSessionRestore()` reads from IndexedDB and hydrates all three stores.

**Phase 1 acceptance criteria:**
- [ ] User can type a topic (>=10 chars) and start a session
- [ ] Conversation Compass renders with 6 paths
- [ ] Clicking a path generates a root node + 2-3 branches
- [ ] Clicking "Show Answer" on a node streams the response in real-time
- [ ] Branching from question or answer creates new child nodes
- [ ] Quality gates reject generic/duplicate questions and retry
- [ ] Canvas persists to IndexedDB; refreshing the page restores full state
- [ ] FSM prevents double-clicking "Show Answer" while loading
- [ ] No God component -- ExplorationCard and PlanCard are separate

---

## 7. Phase 2: Socratic Dialogue

**Goal:** Add a dialogue panel where the user can engage in structured argumentative dialogue with the AI on any resolved exploration node. Four dialectic modes, turn-type classification, and suggested responses.

### 7a. Dialogue Data Model

The `DialogueTurn` schema (defined in Phase 0) represents each exchange. Dialogue turns are stored in the semantic store as a flat array, indexed by `nodeId`.

### 7b. Dialectic Mode Prompts

`src/generation/prompts/dialogue.ts`:

Each mode has a distinct system prompt that controls how the AI engages:

- **Socratic**: Only asks questions. Never states opinions. Surfaces contradictions.
- **Devil's Advocate**: Argues the opposite of whatever the user said. Always finds counterpoints.
- **Steelman**: Takes the user's weakest argument and strengthens it. Fills in evidence the user missed.
- **Collaborative**: Builds on the user's ideas. Adds structure, finds gaps, suggests next steps.

The prompt includes:
1. The persona system preamble
2. The dialectic mode instruction
3. The compiled graph context (from the context compiler)
4. The full dialogue history for this node
5. A request for `turnType` classification and 2-3 `suggestedResponses`

```typescript
export function buildDialoguePrompt(
  mode: DialecticMode,
  history: DialogueTurn[],
  compiledContext: CompiledContext,
  challengeDepth: ChallengeDepth
): string {
  // ... builds the prompt with JSON output format for structured response
}
```

The AI response format:
```json
{
  "content": "Your dialectic response text...",
  "turnType": "challenge",
  "suggestedResponses": [
    { "text": "But what about...", "intent": "defend" },
    { "text": "Fair point. However...", "intent": "concede" },
    { "text": "Let's take a different angle.", "intent": "redirect" }
  ]
}
```

### 7c. DialoguePanel Component

`src/components/DialoguePanel/DialoguePanel.tsx`:

- Slides in from the right side when a user clicks "Discuss" on a resolved exploration node
- Shows the dialectic mode selector (4 toggle buttons)
- Shows the dialogue history as a chat-like thread
- After each AI turn, shows 2-3 suggested responses as clickable chips
- User can also type a free-form response
- A "Conclude & Synthesize" button summarizes key insights from the dialogue back into the node

### 7d. Challenge Depth

The session-level `challengeDepth` setting (gentle | balanced | intense) modulates the prompts:

- **Gentle**: "Gently probe assumptions. Be supportive."
- **Balanced**: "Challenge directly but respectfully. Expect the user to defend."
- **Intense**: "Rigorously interrogate every claim. Accept nothing at face value."

### 7e. Conclude & Synthesize

When the user clicks "Conclude," the system sends the full dialogue history to the LLM with a synthesis prompt. The result updates the node's `answer` field with an enriched version that incorporates dialogue insights. This triggers staleness propagation to any downstream nodes.

**Phase 2 acceptance criteria:**
- [ ] Clicking "Discuss" on a resolved node opens the DialoguePanel
- [ ] User can select from 4 dialectic modes
- [ ] AI responses include turnType classification and suggested responses
- [ ] Suggested responses are clickable and create user turns
- [ ] Challenge depth visibly affects tone (compare gentle vs. intense)
- [ ] "Conclude & Synthesize" updates the node's answer
- [ ] Dialogue turns persist to IndexedDB
- [ ] At least 5 full dialogue exchanges work without context overflow

---

## 8. Phase 3: Multi-Lane + Promotion + Lane Plans

**Goal:** Add the 4-lane system, lane switching, the promotion mechanism with evidence binding, and lane plan generation.

### 8a. Lane System

Session creation initializes exactly 4 lanes (as defined in `DEFAULT_LANES`). The `LaneSelector` component renders as a tab bar below the toolbar. Switching lanes filters the canvas to show only that lane's nodes/edges.

Each lane has its own exploration tree. All trees share the same session topic but use different persona prompts.

### 8b. Promotion Mechanism

Any **resolved** exploration node can be promoted. The promotion flow:

1. User clicks the promote button on a resolved ExplorationCard
2. A small modal asks for `PromotionReason` (5 options as radio buttons) and an optional note
3. The `Promotion` entity is created and stored in the semantic store
4. The node displays a gold star/badge indicating promoted status
5. Unpromoting removes the Promotion entity

**Guard rule:** `canPromote(node.fsmState)` must return true. Only `resolved` state passes.

### 8c. Lane Plan Generation

When a lane has at least 1 promoted node, the user can click "Generate Lane Plan" in the PlanPanel. The generation flow:

1. Collect all promoted nodes in the active lane
2. For each promoted node, extract the full content (question + answer + dialogue summary if any) along with the `PromotionReason`
3. Build a structured prompt that asks the LLM to produce a `StructuredPlan` (goals, assumptions, strategy, milestones, risks, nextActions)
4. Each section must include `EvidenceRef` citations back to the source promoted nodes
5. Parse and validate the response against `LanePlanSchema`
6. Store the `LanePlan` in the semantic store
7. Update the Session FSM (trigger `LANE_PLAN_CREATED` event)

The evidence binding is critical: every `PlanSection` in the output must contain at least one `EvidenceRef` that points back to a specific promoted node and includes a verbatim quote.

### 8d. Lane Plan Prompt

```typescript
export function buildLanePlanPrompt(
  promotedNodes: Array<{ node: SemanticNode; promotion: Promotion }>,
  persona: Persona,
  sessionTopic: string
): string {
  // Includes each promoted node with its reason and full content
  // Asks for structured JSON matching StructuredPlanSchema
  // Requires evidence citations in each section
}
```

**Phase 3 acceptance criteria:**
- [ ] Session creation initializes exactly 4 lanes
- [ ] Lane selector shows 4 tabs with correct colors and labels
- [ ] Switching lanes filters the canvas correctly
- [ ] Each lane generates content with its persona's distinct style
- [ ] Promote button appears only on resolved nodes
- [ ] Promoting requires selecting a reason
- [ ] Lane plan generation consumes promoted nodes
- [ ] Lane plan sections contain EvidenceRef citations
- [ ] Session FSM transitions: exploring -> lane_planning -> synthesis_ready
- [ ] Unified synthesis button is disabled until >= 3 lane plans exist

---

## 9. Phase 4: Unified Synthesis

**Goal:** Implement the map-reduce synthesis pipeline, conflict resolution between lane plans, evidence binding for the unified plan, and staleness propagation.

### 9a. Map-Reduce Pipeline

The synthesis happens in three stages:

**Stage 1: Map (Conflict Extraction)**

For each pair of lane plans (A,B), (A,C), (A,D), (B,C), (B,D), (C,D), send a sub-prompt:

```
Given these two plans from different perspectives:
Plan A ({laneLabel}): {planContent}
Plan B ({laneLabel}): {planContent}

Extract:
1. Direct contradictions (where they recommend opposite actions)
2. Synergies (where they reinforce each other)
3. Gaps (where one covers something the other ignores)

Return JSON: { contradictions: [...], synergies: [...], gaps: [...] }
```

With 4 lanes, this produces C(4,2) = 6 pairwise comparisons.

**Stage 2: Reduce (Resolution)**

Take all pairwise conflict/synergy reports and ask the planner persona to make executive decisions:

```
Given these conflicts, synergies, and gaps across 4 planning perspectives:
{aggregated pairwise reports}

For each contradiction, decide:
- Which position is stronger and why
- What trade-off is being made
- What the resolution is

Return JSON matching ConflictResolution[] schema
```

**Stage 3: Format (Unified Plan)**

Take the conflict resolutions and ask for the final `StructuredPlan`:

```
Create the unified plan incorporating these resolutions:
{conflict resolutions}
{synergies}
{original plan summaries}

Every section must include EvidenceRef citations to source lane plans and exploration nodes.
Return JSON matching UnifiedPlanSchema.
```

### 9b. Evidence Chain

The unified plan's `evidence` array contains `EvidenceRef` entries that trace through the full chain:
- Unified plan section -> Lane plan section -> Promoted exploration node

The `EvidenceTrail` component renders this chain visually: clicking an evidence citation scrolls the canvas to the source node and highlights it.

### 9c. Staleness Propagation

`src/core/graph/staleness.ts`:

When a node's content changes (e.g., after re-generation or dialogue synthesis), all downstream nodes in the tree are marked `stale`:

```typescript
export function propagateStaleness(
  changedNodeId: string,
  nodes: SemanticNode[],
  edges: SemanticEdge[]
): string[] {
  const index = buildAdjacencyIndex(nodes, edges);
  const staleIds: string[] = [];
  const queue = index.childrenOf.get(changedNodeId) ?? [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    staleIds.push(current);
    const children = index.childrenOf.get(current) ?? [];
    queue.push(...children);
  }

  return staleIds; // These nodes should transition to 'stale' state
}
```

If a promoted node becomes stale, any lane plan that references it shows a "stale" badge and suggests regeneration.

If a lane plan becomes stale, the unified plan (if it exists) also becomes stale.

The UI renders stale nodes with a yellow "Recalculate" badge.

**Phase 4 acceptance criteria:**
- [ ] Synthesis button enabled only when >= 3 lane plans exist
- [ ] Map phase produces 6 pairwise conflict reports (for 4 lanes)
- [ ] Reduce phase resolves each conflict with explicit trade-off
- [ ] Unified plan contains `conflictsResolved` and `unresolvedQuestions`
- [ ] Every unified plan section has at least one EvidenceRef
- [ ] EvidenceTrail component navigates to source nodes when clicked
- [ ] Editing a node's answer propagates staleness to descendants
- [ ] Stale lane plans show "Recalculate" badge
- [ ] Stale unified plan shows "Re-synthesize" badge
- [ ] Session FSM transitions to `synthesized` after successful synthesis

---

## 10. Phase 5: Polish + Future

**Goal:** Workspace management, export, settings, and prepare the architecture for future backend integration.

### 10a. Workspace Management

- Session list view (create new, switch between, delete sessions)
- Session summary card showing lane plan completion status

### 10b. Export

- Export unified plan as Markdown
- Export full session as JSON (for backup/import)
- Export individual lane plans as Markdown

### 10c. Settings Panel

- Gemini API key management (stored in IndexedDB, never committed)
- Default challenge depth
- Theme (light/dark -- FUDA Plan uses a warm paper-like theme by default)
- Animation toggle (respects prefers-reduced-motion)

### 10d. Backend Preparation

The architecture is already backend-ready because:
- All domain logic lives in `src/core/` with no React dependencies
- The persistence layer is abstracted behind `repository.ts` -- swapping IndexedDB for a REST API requires only changing that file
- The generation pipeline calls a `Provider` interface -- adding a backend-proxied provider requires only a new implementation
- The FSMs are pure functions that could run identically on a server

Future phases (not v1):
- Phase 6: Event-sourced backend (commands + events, replay)
- Phase 7: Multi-user collaboration (CRDTs via Yjs)
- Phase 8: Additional LLM providers (Claude, GPT)

---

## 11. Testing Strategy

### Unit Tests (Layer 1: Domain Core)

These run in Node.js via Vitest with no browser environment.

| Test File | Tests |
|-----------|-------|
| `session-fsm.test.ts` | All valid transitions, all invalid transitions rejected, guard functions |
| `node-fsm.test.ts` | All state transitions, `canPromote` only on resolved, `canBranch` |
| `job-fsm.test.ts` | Full lifecycle: queued -> running -> succeeded, retry path, failure path |
| `context-compiler.test.ts` | Ancestor chain extraction, sibling extraction, token budget enforcement, formatted output shape |
| `traversal.test.ts` | `getAncestorChain` with 5-deep tree, `getSiblings` with 3 siblings, empty graph edge case |
| `staleness.test.ts` | Propagation depth, diamond graph handling, leaf node no-op |
| `quality-gates.test.ts` | Specificity gate, uniqueness gate (Jaccard), branchability gate |

### Integration Tests (Layer 2: Generation Pipeline)

These use the mock provider and test the full pipeline end-to-end.

| Test File | Tests |
|-----------|-------|
| `pipeline.test.ts` | Context compilation -> prompt building -> mock generation -> output validation |
| `prompts.test.ts` | Each prompt builder produces non-empty strings with required sections |

### Store Tests (Layer 3: State Management)

| Test File | Tests |
|-----------|-------|
| `semantic-store.test.ts` | Add nodes, add edges, update node state via FSM |
| `promotion.test.ts` | Promote resolved node succeeds, promote idle node rejected, unpromote |
| `planning.test.ts` | Lane plan creation triggers session FSM, evidence binding |

### Component Tests (Layer 4: UI)

Use `@testing-library/react` with `vitest`:

| Test File | Tests |
|-----------|-------|
| `ExplorationCard.test.tsx` | Renders question, show answer button, branch buttons appear after resolve |
| `ConversationCompass.test.tsx` | 6 paths render, click triggers generation |
| `DialoguePanel.test.tsx` | Mode selector, suggested responses render and are clickable |
| `LaneSelector.test.tsx` | 4 tabs render, switching changes active lane |

### Full-Flow Integration Test

`src/__tests__/integration/full-flow.test.ts`:

Tests the complete happy path without UI:
1. Create session with topic
2. Generate path questions for one lane
3. Generate answers for 2 nodes
4. Promote both nodes
5. Generate lane plan
6. Repeat for 3 lanes
7. Run unified synthesis
8. Verify evidence chain from unified plan back to source nodes

---

## 12. Verification Criteria

### Phase 0 Verification

```
[ ] All Zod schemas in src/core/types/ compile and export correctly
[ ] TypeScript strict mode passes with zero errors
[ ] Session FSM: 8 tests (4 valid transitions + 4 invalid rejections)
[ ] Node FSM: 10 tests (5 valid transitions + 3 invalid + 2 guard tests)
[ ] Job FSM: 6 tests (full lifecycle + retry + terminal)
[ ] Context compiler: 5 tests (ancestor chain, siblings, budget, format, empty graph)
[ ] Quality gates: 6 tests (specificity pass/fail, uniqueness pass/fail, branchability pass/fail)
[ ] IndexedDB repository: round-trip test for each entity type
[ ] Zero browser/React imports in src/core/**
[ ] vitest runs all Phase 0 tests in < 5 seconds
```

### Phase 1 Verification

```
[ ] Topic input accepts >= 10 chars, rejects shorter
[ ] Compass renders 6 equidistant paths in radial layout
[ ] Path click generates root + 2-3 branches (mock or Gemini)
[ ] "Show Answer" streams text in real-time (Gemini) or renders immediately (mock)
[ ] Branching from question creates child nodes below parent
[ ] Branching from answer creates child nodes below parent
[ ] Quality gates fire on Gemini output; retry on failure
[ ] Canvas saves to IndexedDB on state changes (debounced 500ms)
[ ] Page refresh restores full canvas state
[ ] Double-click "Show Answer" while loading is prevented (FSM guard)
[ ] ExplorationCard component is separate from PlanCard component
```

### Phase 2 Verification

```
[ ] "Discuss" button appears on resolved exploration nodes
[ ] DialoguePanel opens with mode selector showing 4 modes
[ ] Each mode produces distinctly different AI responses
[ ] AI responses include turnType and suggestedResponses
[ ] Clicking a suggested response creates a user turn and triggers AI response
[ ] Free-form text input works for user turns
[ ] Challenge depth affects response intensity (compare gentle vs intense)
[ ] "Conclude & Synthesize" produces enriched answer content
[ ] Dialogue history persists across page refreshes
[ ] 10+ turn dialogues work without context overflow
```

### Phase 3 Verification

```
[ ] Session creation produces exactly 4 lanes
[ ] Lane tabs render with correct labels and colors
[ ] Lane switching shows only that lane's nodes/edges
[ ] Persona differences are visible (compare Expansive vs Analytical output)
[ ] Promote button appears only on resolved nodes (FSM guard)
[ ] Promote modal requires reason selection
[ ] Promoted nodes display gold badge
[ ] Unpromote removes promotion and badge
[ ] "Generate Lane Plan" requires >= 1 promoted node
[ ] Lane plan sections contain EvidenceRef with quotes
[ ] Session status transitions: exploring -> lane_planning -> synthesis_ready
[ ] Synthesis button disabled when < 3 lane plans
[ ] Synthesis button enabled when >= 3 lane plans
```

### Phase 4 Verification

```
[ ] Map phase sends 6 pairwise comparison prompts (4 lanes)
[ ] Each pairwise comparison returns contradictions + synergies + gaps
[ ] Reduce phase resolves contradictions with trade-off explanations
[ ] Unified plan JSON validates against UnifiedPlanSchema
[ ] Every unified plan section has >= 1 EvidenceRef
[ ] EvidenceTrail renders clickable links that navigate to source nodes
[ ] Editing a node's answer marks descendants as stale
[ ] Stale nodes display yellow "Recalculate" badge
[ ] Stale lane plan displays warning
[ ] Re-synthesizing a stale unified plan clears the stale state
[ ] Full flow: topic -> 4 lanes -> 12 promotions -> 4 lane plans -> 1 unified plan
```

### Phase 5 Verification

```
[ ] Session list view shows all sessions
[ ] Creating a new session navigates to topic input
[ ] Deleting a session removes it from IndexedDB
[ ] Markdown export produces readable document with headers and bullets
[ ] JSON export produces valid, re-importable session file
[ ] API key stored in IndexedDB, not in source code
[ ] Dark mode toggle works
[ ] prefers-reduced-motion disables all animations
```

---

### Critical Files for Implementation

- `src/core/types/index.ts` - Central type definitions hub; all Zod schemas and TypeScript types that every other layer depends on
- `src/core/graph/context-compiler.ts` - The Context Compiler that builds token-budgeted, topologically-aware prompts; the single most critical piece of infrastructure that v1 lacked entirely
- `src/core/fsm/session-fsm.ts` - Session state machine controlling the exploring -> lane_planning -> synthesis_ready -> synthesized flow; gates all major features
- `src/store/semantic-store.ts` - The semantic Zustand store that replaces v1's monolithic atlasStore; holds all domain data separate from view state
- `src/generation/pipeline.ts` - Unified generation pipeline that composes context compilation, prompt building, provider call, parsing, and validation into a single `generate()` function
