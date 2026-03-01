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

### Decision Log

Each entry justifies the chosen technology against alternatives considered.

#### State Management: Zustand

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Zustand** (chosen) | Selector-based subscriptions prevent cross-store re-render cascades. Store splitting is trivial. No providers needed. | Less mature devtools than Redux. | **Chosen:** 3 data domains at different update frequencies (view 60fps, semantic seconds, session static). Zustand's store splitting maps cleanly to these. |
| Redux Toolkit | Mature devtools, entity adapters, large ecosystem. | Single dispatch queue: canvas drags compete with LLM events. More boilerplate ceremony. | Overengineered for single-user client app. |
| Jotai | Fine-grained reactivity per atom. | Atom-per-node model: staleness propagation triggers N individual reconciliations instead of batch update. | Poor fit for batch graph operations like staleness propagation. |
| Valtio | Proxy mutation feels natural and imperative. | Proxies break with IndexedDB's `structuredClone`. React 19 concurrent mode edge cases with proxy tracking. | Risky for the persistence layer which relies on structuredClone. |

#### Persistence: IndexedDB via `idb`

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **IndexedDB/idb** (chosen) | Async, multi-MB capacity, indexed object stores, transactional with atomic rollback. | Verbose API, no SQL, manual schema migrations. | **Chosen:** Access pattern is load-full-session + update-one-entity. IndexedDB's transactional guarantees prevent mid-write corruption. |
| localStorage | Simplest API, synchronous reads. | 5MB limit, synchronous writes block during streaming, no transactions. | **Disqualified:** Sessions with 100+ nodes easily exceed 5MB. Synchronous writes would stall the UI during LLM streaming. |
| sql.js / wa-sqlite | Full SQL support, FTS5 for search, powerful queries. | 1MB+ WASM initialization payload, serialization complexity, cold-start latency. | Overkill: all filtering happens in-memory in Zustand stores. No complex queries needed. |

#### Canvas: @xyflow/react

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **@xyflow/react** (chosen) | Custom React node components (render rich cards), pan/zoom/drag built-in, minimap, `onlyRenderVisibleElements` for performance. | Opinionated data shapes for nodes/edges. | **Chosen:** ExplorationCard and PlanCard slot in directly as custom node types. |
| d3-force | Maximum layout flexibility, force-directed graph algorithms. | SVG-only rendering — cannot embed React components inside nodes. | Cannot render rich card content with interactive buttons, dialogue panels, etc. |
| Cytoscape.js | Mature graph algorithms library, good for analysis. | HTML Canvas rendering — no React components inside nodes. | Same React component limitation as d3. Rich node content is a core requirement. |

#### LLM Provider: Gemini 2.0-flash

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Gemini flash** (chosen) | Free tier available, CORS-friendly (direct browser-to-API calls), SSE streaming, 1M token context window. | Client-side key exposure risk (mitigated by user-provided key). | **Chosen:** Only major LLM API that supports direct browser calls without a server proxy. This is the enabling constraint for the no-backend architecture. |
| Claude (Anthropic) | Superior structured output, excellent dialectic reasoning. | CORS restrictions — requires server proxy for browser-to-API calls. | **Blocked:** Violates the no-backend constraint. Candidate for Phase 8 with backend. |
| GPT-4o (OpenAI) | Strong JSON mode, wide ecosystem. | Same CORS blocker as Claude — requires server proxy. | **Blocked:** Same no-backend constraint. Candidate for Phase 8. |
| Local (Ollama/WebLLM) | No API key needed, works offline, full privacy. | Quality insufficient for complex structured JSON output (StructuredPlan, ConflictResolution). Model size vs. quality tradeoff. | Not viable for plan schemas requiring reliable structured output. |

#### Synthesis: Map-Reduce vs Alternatives

| Approach | LLM Calls | Ordering Bias | Conflict Traceability | Decision |
|----------|-----------|---------------|----------------------|----------|
| **Pairwise map-reduce** (chosen) | 8 (6 map + 1 reduce + 1 format, map calls parallelizable) | None — every pair compared symmetrically | Full — each ConflictResolution record traces to specific lane pair | **Chosen:** Core value prop of FUDA Plan is traceability. Every conflict resolution is auditable. |
| Round-table (all plans at once) | 1 | None | Low — no intermediate artifacts, conflicts are inferred not extracted | Faster but sacrifices the provenance that makes the tool trustworthy. |
| Sequential merge (A+B then AB+C then ABC+D) | 3 | High — first plan anchors the merged result, later plans get compressed | Medium — merge artifacts exist but first plan is privileged | Ordering determines outcome. Privileges whichever lane is first. |
| Tournament bracket (A vs B, C vs D, winner vs winner) | 3 | Medium — bracket position matters | Medium — misses direct A-C and B-D comparisons | Loses cross-bracket conflict detection entirely. |

#### Validation: Zod

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Zod** (chosen) | `z.infer<typeof Schema>` eliminates type duplication. Single source of truth for runtime + compile-time types. Rich error messages. | Slightly larger bundle than alternatives. | **Chosen:** Type duplication was a major bug source in v1. Zod's infer pattern eliminates the entire class. |
| io-ts | Functional composition, Haskell-inspired. | No `infer` equivalent — must maintain separate TypeScript interfaces. Steep learning curve. | Type duplication defeats the purpose. |
| ArkType | Fastest validation, good inference. | Newer, smaller community, API still evolving. | Too immature for a specification-driven project. |
| TypeBox | JSON Schema compatible, fast. | Inference support weaker than Zod's. Designed for server-side validation. | Less ergonomic for client-side development patterns. |

#### Build Tool: Vite

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Vite** (chosen) | Sub-second HMR, native ESM dev server, Rollup-based production build, first-class React support. | Less mature plugin ecosystem than webpack. | **Chosen:** Pure SPA with no SSR — Vite's strengths perfectly match. |
| Next.js | SSR, file-system routing, server components. | FUDA Plan is a pure client-side app with no server. Next.js adds server complexity we explicitly don't want. | Overengineered for client-only architecture. |
| Remix | Nested routes, loader/action pattern. | Same server-dependency issue as Next.js. | Same objection — no backend is a core constraint. |
| Parcel | Zero-config bundler. | Less predictable for production optimization. Smaller ecosystem for React. | Vite's explicit config is actually an advantage for a specification-driven project. |

#### CSS: CSS Modules

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **CSS Modules** (chosen) | Zero-runtime overhead (critical for canvas at 60fps), scoped class names, standard CSS features, works with Vite out of the box. | No dynamic styling without CSS custom properties. | **Chosen:** Canvas performance is critical — 100+ nodes must render smoothly during pan/zoom. Zero runtime cost is non-negotiable. |
| Tailwind CSS | Rapid prototyping, consistent design tokens. | Utility classes in JSX reduce readability for complex components. Build-time overhead. | Acceptable alternative, but CSS Modules better for component isolation in canvas context. |
| styled-components | Dynamic theming, CSS-in-JS colocation. | Runtime CSS generation during React Flow pan/zoom creates jank. React 19 SSR issues. | Runtime overhead disqualifies it for canvas-heavy rendering. |
| vanilla-extract | Type-safe CSS, zero runtime. | Build-time extraction complexity. Less intuitive for team onboarding. | Good alternative, but CSS Modules are simpler and more widely understood. |

#### Store Architecture: 3+1 Stores

| Store | Update Frequency | Data | Persisted? |
|-------|-----------------|------|-----------|
| `semantic-store` | Seconds (on LLM response) | Nodes, edges, promotions, plans | Yes |
| `view-store` | 60fps (canvas drag/zoom) | Positions, collapse state, UI mode | Yes |
| `session-store` | Rare (topic change, mode switch) | Session metadata, active lane, challenge depth | Yes |
| `job-store` | Seconds (job lifecycle) | Generation job queue, status, errors | No (ephemeral) |

Justification: Different update frequencies prevent high-frequency view updates (60fps canvas interactions) from triggering re-renders in components subscribed to low-frequency semantic data. The job store is ephemeral because jobs are transient — they complete or fail within seconds and don't need to survive page refresh.

#### Token Budget Strategy: Greedy Priority Packing (v1)

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Greedy priority packing** (chosen) | Simple, deterministic, testable. Ancestors first, then siblings, then cousins. | Doesn't adapt budget per job type (answers need more context than branches). | **Chosen for v1:** Predictable behavior, easy to debug. |
| Per-job-type dynamic allocation | Answers get 60% context, branches get 40%. Optimizes relevance. | More complex, harder to test, needs tuning per job type. | Documented as v2 enhancement path. |
| Embedding-based relevance ranking | Most relevant content regardless of graph position. | Requires embedding model client-side. Adds latency and complexity. | Not viable without backend. |

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
Layer 3: State Management     Zustand split stores (semantic, view, session + ephemeral job store)
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
      personas.ts                 # 4 exploration personas + planner (see Persona System Prompts below)
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

### Persona System Prompts

These are the actual system prompt strings used in `src/generation/personas.ts`. Each persona is a complete instruction set — not just a description but the full prompt text injected at the system level for every LLM call within that lane.

**Expansive Persona:**
```
You are the Expansive Planner. Your role is to think big-picture: long-term vision,
philosophical implications, creative reframings, and connections across domains. You
see possibilities where others see constraints.

Style: Imaginative, wide-ranging, future-oriented. Use analogies from other fields.
Ask "what if?" frequently. Embrace uncertainty as creative space.

Anti-patterns to avoid:
- Never be generic. "Think outside the box" is not a useful instruction.
- Never ignore practical constraints entirely — acknowledge them, then transcend them.
- Never repeat the user's framing without adding a new angle.
- Never start with "That's a great question!" or similar filler.
```

**Analytical Persona:**
```
You are the Analytical Planner. Your role is to decompose problems into components,
identify logical dependencies, evaluate evidence quality, and build structured
arguments. You value precision over inspiration.

Style: Structured, logical, evidence-grounded. Use numbered lists, decision matrices,
and explicit criteria. Quantify when possible. Flag logical fallacies.

Anti-patterns to avoid:
- Never present opinions as facts. Clearly distinguish "evidence suggests" from "I think."
- Never skip showing your reasoning. Every conclusion needs a visible chain of logic.
- Never produce vague recommendations. "Improve X" → "Reduce X from Y to Z by doing W."
- Never start with "That's a great question!" or similar filler.
```

**Pragmatic Persona:**
```
You are the Pragmatic Planner. Your role is to evaluate ideas through the lens of
real-world implementation: timelines, resources, team capacity, technical debt, and
operational risk. You favor concrete steps over abstract principles.

Style: Direct, specific, implementation-focused. Use numbers when possible. Reference
industry precedents. Answer "what would it take?" and "what could go wrong?"

Anti-patterns to avoid:
- Never be vague. "Improve performance" → "Reduce p95 latency from 800ms to 200ms."
- Never list generic best practices. Ground every point in the user's specific context.
- Never ignore the human element — teams, skills, hiring, morale matter.
- Never start with "That's a great question!" or similar filler.
```

**Socratic Persona:**
```
You are the Socratic Questioner. Your role is to surface hidden assumptions, reveal
contradictions, and force the user to justify their reasoning. You never state
opinions — you only ask questions.

Style: Probing, precise, relentless. Each question should target a specific assumption
or logical gap. Build questions that fork the conversation into revealing paths.

Anti-patterns to avoid:
- Never state your own position. You ask, you don't tell.
- Never ask yes/no questions. Every question should require explanation.
- Never ask vague questions. "What do you think about that?" is useless. Be specific.
- Never start with "That's a great question!" or similar filler.
```

**Planner Persona** (used for lane plan and unified plan generation):
```
You are the Strategic Planner. Your role is to synthesize exploration insights into
actionable, structured plans. You work with evidence — every claim in your plan must
trace back to a specific exploration node.

Style: Authoritative, structured, evidence-based. Use the provided StructuredPlan
schema exactly. Every section must contain EvidenceRef citations. Be specific about
timelines, owners, and success criteria.

Anti-patterns to avoid:
- Never make claims without evidence citations. If no evidence supports a point, say so.
- Never produce vague milestones. "Launch MVP" → "Deploy auth service to staging by week 4."
- Never ignore conflicts between lanes. Surface them explicitly in conflictsResolved.
- Never start with "Here's my plan" or similar preamble. Return the JSON directly.
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

### Canvas Layout

```
+----------------------------------------------------------------------+
|  FUDA Plan                               [Settings] [Export] [Sessions]|
+----------------------------------------------------------------------+
|  Topic: "Should we migrate from monolith to microservices?"           |
+----------------------------------------------------------------------+
|  [Expansive] [Analytical] [*Pragmatic*] [Socratic]  Challenge:[=bal] |
+----------------------------------------------------------------------+
|  +-- Canvas (React Flow, pannable/zoomable) -----------------------+ |
|  |              +--[ROOT]------------------+                       | |
|  |              | Q: What are the specific |                       | |
|  |              | pain points?             |                       | |
|  |              | [Show Answer] [Discuss]  |                       | |
|  |              | State: resolved [*]prom  |                       | |
|  |              +--------+---------+-------+                       | |
|  |                  |         |         |                          | |
|  |           +------+    +----+----+  +-+----------+              | |
|  |           v           v         v  v            v              | |
|  |  +[CHILD 1]----+ +[CHILD 2]---+ +[CHILD 3]----+              | |
|  |  | Q: Deploy   | | Q: What    | | Q: Bounded  |              | |
|  |  | coupling?   | | would break| | contexts?   |              | |
|  |  | [ShowAnswer]| | A: "The..." | [ShowAnswer] |              | |
|  |  | State: idle | | State:resol| | State: idle |              | |
|  |  +-------------+ | [Discuss]  | +-------------+              | |
|  |                   +-----+-----+                               | |
|  +---------------------------------------------------------------+ |
|  +-- DialoguePanel (right side, when "Discuss" clicked) ---------+ |
|  |  Mode: [Socratic] [Devil] [*Steelman*] [Collab]              | |
|  |  AI: "Your concern about sessions is valid, but..."          | |
|  |  Suggested: [But what about...] [Fair point] [New angle]     | |
|  |  [Type response...]                                [Send]    | |
|  |  [Conclude & Synthesize]                                     | |
|  +---------------------------------------------------------------+ |
|  Status: 2/4 lane plans | Session: exploring                      |
+----------------------------------------------------------------------+
```

**Layout notes:**
- Canvas occupies ~75% of width when DialoguePanel is closed, ~55% when open
- DialoguePanel slides in from the right, pushing canvas left (not overlaying)
- Lane selector tabs are color-coded: purple (Expansive), blue (Analytical), green (Pragmatic), red (Socratic)
- Active lane tab has bold text and underline; inactive tabs are dimmed
- Promoted nodes show a gold star badge `[*]` next to their state indicator
- Stale nodes show a yellow "Recalculate" badge replacing the state indicator

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

#### Why These Five Promotion Reasons

The five reasons correspond to five independent dimensions of planning quality. Together they ensure promoted evidence covers the full spectrum, not clustering on one type:

| Reason | Plan Quality Dimension | Without It... |
|--------|----------------------|---------------|
| `insightful_reframe` | Creativity | Plan is conventional — follows obvious paths only |
| `actionable_detail` | Specificity | Plan is aspirational — says "improve X" without concrete steps |
| `risk_identification` | Robustness | Plan is brittle — breaks on first contact with reality |
| `assumption_challenge` | Validity | Plan is unfounded — built on unexamined premises |
| `cross_domain_link` | Breadth | Plan is insular — misses connections to adjacent domains |

A plan that has promoted evidence in all five categories is more likely to be creative, specific, robust, valid, and broad. The promotion modal enforces that users *think* about which dimension this node serves, rather than just star-marking "good" nodes.

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
  const visited = new Set<string>(); // Cycle guard — see Edge Case 10b-10
  let current = targetId;
  while (true) {
    const parentId = index.parentOf.get(current);
    if (!parentId) break;
    if (visited.has(parentId)) {
      console.warn('Cycle detected in ancestor chain', { targetId, parentId });
      break;
    }
    visited.add(parentId);
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

#### Why Ancestors > Siblings > Cousins

An LLM generating a response for node N needs the *causal chain* that led to N. Ancestors form this chain — each ancestor's Q&A pair narrows the scope that N inhabits. Without ancestors, the LLM produces shallow, context-free answers that ignore the conversational trajectory.

Siblings provide lateral awareness — they prevent repetition by showing what else was explored from the same parent. But sibling context is not load-bearing for coherence; it's supplementary.

Cousins (children of parent's siblings) provide the weakest signal: breadth one level removed. Included only when budget permits, and only as question-only summaries (no answers) to conserve tokens.

**Budget allocation table:**

| Tier | Budget Share | Rationale |
|------|------------|-----------|
| Ancestors | 60% (2400 tokens) | Causal chain. Fits full chain up to depth 6 with typical answer lengths. |
| Siblings | 30% (1200 tokens) | Anti-repetition. Fits 3-4 sibling summaries at ~300 tokens each. |
| Cousins | 10% (400 tokens) | Breadth signal. Truncated to question-only. |

Surplus from an under-filled tier rolls forward to the next tier. The root node is always included regardless of budget (reserves 300 tokens) because it establishes the entire topic frame.

`src/core/graph/context-compiler.ts`:

```typescript
import type { SemanticNode, SemanticEdge, CompiledContext, ContextEntry } from '../types';
import { buildAdjacencyIndex, getAncestorChain, getSiblings } from './traversal';

const DEFAULT_TOKEN_BUDGET = 4000;
// Why 4000 tokens:
// (1) Larger context degrades response quality by diluting relevance — LLMs perform
//     better with focused context than with everything-and-the-kitchen-sink.
// (2) Longer prompts increase latency and cost proportionally.
// (3) 4000 context + ~2000 system prompt + ~2000 output target = ~8000 total per call,
//     well within Gemini's 1M window while keeping response times under 3-5 seconds.
//
// Deep tree handling (depth > 6): nearest ancestors are prioritized. Root is always
// included (300 token reserve). Middle ancestors may be dropped to fit budget, with
// a "[N ancestors omitted]" marker in the formatted context.

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

  // 3. Cousins (lowest priority) -- question-only, if budget remains
  const parentId = index.parentOf.get(targetNodeId);
  if (parentId) {
    const parentSiblingIds = getSiblings(parentId, nodeMap, index)
      .map(s => s.id);
    for (const psId of parentSiblingIds) {
      const cousinIds = index.childrenOf.get(psId) ?? [];
      for (const cousinId of cousinIds) {
        const cousin = nodeMap.get(cousinId);
        if (!cousin) continue;
        // Cousins get question-only (no answer) to conserve budget
        const content = cousin.question;
        const tokens = estimateTokens(content);
        if (usedTokens + tokens > tokenBudget) break;
        entries.push({
          nodeId: cousin.id,
          role: 'cousin',
          distanceFromTarget: 2,
          content,
          tokenEstimate: tokens,
        });
        usedTokens += tokens;
      }
    }
  }

  // 4. Format into prompt string
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

  const cousins = entries.filter(e => e.role === 'cousin');
  if (cousins.length > 0) {
    for (const entry of cousins) {
      lines.push(`- Cousin (question only): "${entry.content.substring(0, 100)}"`);
    }
  }

  const target = nodeMap.get(targetNodeId);
  if (target) {
    lines.push(`- Current Node: "${target.question}"`);
  }

  return lines.join('\n');
}
```

#### Full Compiled Context Prompt Example

This is the complete prompt string sent to Gemini for an `answer` job on a depth-2 node in the Pragmatic lane. It shows how the context compiler output, persona preamble, and task instruction compose together:

```
[SYSTEM]
You are the Pragmatic Planner. Your role is to evaluate ideas through the lens of
real-world implementation: timelines, resources, team capacity, technical debt, and
operational risk. You favor concrete steps over abstract principles. When you lack
data, say so — never fill gaps with platitudes.

Style: Direct, specific, evidence-grounded. Use numbers when possible. Reference
industry precedents. Never say "it depends" without specifying what it depends on.

Anti-patterns to avoid:
- Never be vague. "Improve performance" → "Reduce p95 latency from 800ms to 200ms."
- Never list generic best practices. Ground every point in the user's specific context.
- Never start with "Great question!" or other filler.

[GRAPH CONTEXT]
- Root (depth 2): "What are the specific deployment pain points that make microservices attractive?"
  → "Three teams share one release train, causing 2-3 week deployment queues. Feature
  branches average 14 days, leading to merge conflicts that consume 20% of sprint capacity."
- Ancestor (depth 1): "How would you handle distributed transactions for operations
  currently using a single database transaction?"
  → "Saga pattern with compensating transactions for the order flow. Event sourcing for
  the inventory service. Accept eventual consistency with a 5-second SLA."
- Sibling (Explored): "What bounded contexts have the most independent data models?"
- Sibling (Unexplored): "What parallels exist with Netflix's decomposition?"
- Current Node: "What specific monitoring and observability infrastructure would you
  need before extracting the first microservice?"

[TASK]
Generate a thorough answer to the Current Node's question. Consider the full context
of the exploration so far. Your answer should be specific to the user's situation,
not generic advice.

Return JSON matching this exact schema:
{
  "summary": "A 1-2 sentence synthesis (max 200 chars)",
  "bullets": ["3-8 specific points, each a complete thought"]
}

Ensure JSON is valid and complete. Do not include markdown formatting or code fences.
```

### 5c-ii. Quality Gates Specification

`src/core/validation/quality-gates.ts`

Quality gates target three independent failure modes of LLM-generated follow-up questions. They run client-side on every `branch` response before the questions are accepted into the graph.

#### Gate 1: Specificity

Guards against vagueness ("What are the implications?" or "Tell me more about that.").

**Metric:** `(named_entities + domain_terms) / min(total_words, 50)` where named entities are capitalized multi-word phrases and domain terms are nouns that appeared in the parent node's content.

**Threshold:** >= 0.3. Below 0.3, questions empirically reduce to generic "tell me more" variants that don't advance exploration.

**Implementation:** Split on whitespace, count terms matching parent content or containing uppercase letters. Cap denominator at 50 to prevent long questions from diluting the ratio.

#### Gate 2: Uniqueness

Guards against repetition (generating the same question with slightly different wording).

**Metric:** Jaccard similarity of word bigrams against each existing sibling question. `J(A,B) = |A ∩ B| / |A ∪ B|` where A and B are sets of consecutive word pairs.

**Threshold:** Jaccard < 0.6 against every sibling. Above 0.6, questions are too similar to add value.

**Why Jaccard over cosine similarity:** Runs entirely client-side with no embedding model. Bigram Jaccard is simple, fast, and surprisingly effective for detecting paraphrases of short questions.

#### Gate 3: Branchability

Guards against dead-end questions (yes/no questions that terminate exploration).

**Metric:** Heuristic score based on question structure. Open-ended starters (how, why, what if, in what ways, what would) score 1.0. Closed-form starters (is it, does it, can you, will it, has it) score 0.0. Mixed forms score 0.5. Final score is the average across detected patterns.

**Threshold:** >= 0.5. Below 0.5, the question is likely to produce a one-sentence answer with no natural follow-up paths.

**Why not LLM-scored:** Gates run per question (3-6 per branch response). An LLM call per question would triple latency for quality checking. The heuristic is fast and catches the most common failure mode (yes/no questions).

#### Retry Strategy

- Up to 2 retries per gate failure. Each retry appends the specific gate failure reason to the prompt (e.g., "The previous question was too vague. Generate a more specific question that references concrete entities.").
- **Multi-gate failure:** When multiple gates fail simultaneously, use the lowest-scoring gate's feedback for the retry instruction.
- **Exhausted retries:** After 2 failed retries, accept the question with a low-confidence visual badge (dimmed border, "?" icon). The user can still explore it, but it signals the system's uncertainty.

```typescript
export interface QualityGateResult {
  passed: boolean;
  gate: 'specificity' | 'uniqueness' | 'branchability';
  score: number;
  threshold: number;
  feedback: string; // Human-readable reason, appended to retry prompt
}

export function runQualityGates(
  question: string,
  siblingQuestions: string[],
  parentContent: string
): QualityGateResult[] {
  return [
    checkSpecificity(question, parentContent),
    checkUniqueness(question, siblingQuestions),
    checkBranchability(question),
  ];
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

#### IndexedDB Data Example

A realistic snapshot of all 9 object stores for a session with 4 nodes, 3 edges, 1 promotion, and 1 completed job:

```
sessions store:
  "sess-001" → {
    id: "sess-001", topic: "Should we migrate from monolith to microservices?",
    createdAt: "2025-01-15T10:00:00Z", updatedAt: "2025-01-15T10:45:00Z",
    challengeDepth: "balanced", activeLaneId: "lane-prag", status: "exploring",
    version: "fuda_v1"
  }

lanes store:
  "lane-expn" → { id: "lane-expn", sessionId: "sess-001", label: "Expansive",
                   personaId: "expansive", colorToken: "#7B4FBF", sortOrder: 0, ... }
  "lane-anlt" → { id: "lane-anlt", sessionId: "sess-001", label: "Analytical",
                   personaId: "analytical", colorToken: "#4A90D9", sortOrder: 1, ... }
  "lane-prag" → { id: "lane-prag", sessionId: "sess-001", label: "Pragmatic",
                   personaId: "pragmatic", colorToken: "#3DAA6D", sortOrder: 2, ... }
  "lane-socr" → { id: "lane-socr", sessionId: "sess-001", label: "Socratic",
                   personaId: "socratic", colorToken: "#D94F4F", sortOrder: 3, ... }

nodes store:
  "node-001" → { id: "node-001", sessionId: "sess-001", laneId: "lane-prag",
                  parentId: null, nodeType: "root", pathType: "go-deeper",
                  question: "What are the specific deployment pain points that make microservices attractive?",
                  answer: { summary: "Three teams share one release train...", bullets: [...] },
                  fsmState: "resolved", promoted: true, depth: 0, ... }
  "node-002" → { id: "node-002", sessionId: "sess-001", laneId: "lane-prag",
                  parentId: "node-001", nodeType: "exploration", pathType: "go-deeper",
                  question: "What bounded contexts have the most independent data models?",
                  answer: null, fsmState: "idle", promoted: false, depth: 1, ... }
  "node-003" → { id: "node-003", sessionId: "sess-001", laneId: "lane-prag",
                  parentId: "node-001", nodeType: "exploration", pathType: "challenge",
                  question: "How would you handle distributed transactions?",
                  answer: { summary: "Saga pattern with compensating transactions...", bullets: [...] },
                  fsmState: "resolved", promoted: false, depth: 1, ... }
  "node-004" → { id: "node-004", sessionId: "sess-001", laneId: "lane-prag",
                  parentId: "node-001", nodeType: "exploration", pathType: "connect",
                  question: "What parallels exist with Netflix's decomposition?",
                  answer: null, fsmState: "idle", promoted: false, depth: 1, ... }

edges store:
  "edge-001" → { id: "edge-001", sessionId: "sess-001", laneId: "lane-prag",
                  sourceNodeId: "node-001", targetNodeId: "node-002", ... }
  "edge-002" → { id: "edge-002", sessionId: "sess-001", laneId: "lane-prag",
                  sourceNodeId: "node-001", targetNodeId: "node-003", ... }
  "edge-003" → { id: "edge-003", sessionId: "sess-001", laneId: "lane-prag",
                  sourceNodeId: "node-001", targetNodeId: "node-004", ... }

promotions store:
  "promo-001" → { id: "promo-001", sessionId: "sess-001", laneId: "lane-prag",
                   nodeId: "node-001", reason: "risk_identification",
                   note: "Key insight about deployment coupling", ... }

lanePlans store:  (empty — no lane plans generated yet)
unifiedPlans store:  (empty)

dialogueTurns store:  (empty — no dialogue started)

jobs store:
  "job-001" → { id: "job-001", sessionId: "sess-001", targetNodeId: "node-003",
                 jobType: "answer", fsmState: "succeeded", attempts: 1, maxAttempts: 3,
                 idempotencyKey: "answer:node-003:1", error: undefined,
                 createdAt: "2025-01-15T10:30:00Z", resolvedAt: "2025-01-15T10:30:04Z" }
```

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

Split Zustand into three persisted stores plus one ephemeral store (3+1 architecture — see Decision Log: Store Architecture for rationale):

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

`src/store/job-store.ts` -- **Ephemeral (not persisted to IDB).** Holds `GenerationJob[]` with status tracking, concurrency control, and rate limiting state. Jobs are transient — they complete or fail within seconds and don't need to survive page refresh. On reload, any in-flight jobs are simply lost; the user can retry from the node's `failed` state.

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

#### LLM Response JSON Examples by Job Type

Each job type expects a specific JSON shape from the LLM. The `dialogue_turn` example is shown in Phase 2; here are the remaining 5:

**`answer` response** (for generating a node's answer content):
```json
{
  "summary": "Migrating from a monolith to microservices reduces deployment coupling but introduces distributed-system complexity that most teams underestimate by 2-3x.",
  "bullets": [
    "Each service requires independent CI/CD, monitoring, and on-call rotation — tripling operational overhead for a 3-service split",
    "Network latency between services adds 5-50ms per hop; a request touching 4 services adds 20-200ms vs monolith's in-process calls",
    "Data consistency shifts from ACID transactions to eventual consistency via sagas or outbox patterns",
    "Conway's Law applies: team boundaries should match service boundaries, requiring org restructuring before or during migration",
    "The 'strangler fig' pattern allows incremental migration, extracting one bounded context at a time while the monolith still serves remaining traffic"
  ]
}
```

**`branch` response** (for generating follow-up questions from a node):
```json
{
  "branches": [
    {
      "question": "What bounded contexts in the current monolith have the most independent data models and could be extracted first?",
      "pathType": "go-deeper",
      "quality": { "novelty": 0.8, "specificity": 0.9, "challenge": 0.4 }
    },
    {
      "question": "How would you handle distributed transactions for operations currently using a single database transaction?",
      "pathType": "challenge",
      "quality": { "novelty": 0.7, "specificity": 0.85, "challenge": 0.9 }
    },
    {
      "question": "What parallels exist with how Netflix or Shopify decomposed their monoliths, and which lessons transfer to your scale?",
      "pathType": "connect",
      "quality": { "novelty": 0.6, "specificity": 0.7, "challenge": 0.3 }
    }
  ]
}
```

**`path_questions` response** (for generating the 6 Conversation Compass directions):
```json
{
  "paths": {
    "clarify": "What exactly do you mean by 'monolith' — single deployable, single codebase, or single database?",
    "go-deeper": "What are the specific pain points that make microservices attractive over improving the monolith's modularity?",
    "challenge": "What evidence do you have that microservices will solve your deployment bottleneck rather than shifting it to operational complexity?",
    "apply": "If you extracted the authentication service as the first microservice tomorrow, what would break in the current system?",
    "connect": "How does this architecture decision interact with your team's hiring plan and on-call capacity over the next 12 months?",
    "surprise": "What if the real problem isn't the monolith architecture but the lack of feature flags and trunk-based development?"
  }
}
```

**`lane_plan` response** (for generating a structured plan from promoted nodes):
```json
{
  "goals": [
    {
      "heading": "Reduce deployment coupling between teams",
      "content": [
        "Enable independent deployment cycles for auth, catalog, and order services",
        "Target: each team deploys independently at least 2x per week"
      ],
      "evidence": [
        {
          "nodeId": "node-prag-012",
          "laneId": "lane-pragmatic",
          "quote": "deployment coupling is the primary bottleneck — 3 teams wait on 1 release train",
          "relevance": "primary"
        }
      ]
    }
  ],
  "assumptions": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
  "strategy": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
  "milestones": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
  "risks": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
  "nextActions": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }]
}
```

**`unified_plan` response** (for the final synthesis — same `StructuredPlan` shape plus conflict resolutions):
```json
{
  "sections": {
    "goals": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
    "assumptions": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
    "strategy": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
    "milestones": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
    "risks": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }],
    "nextActions": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary"}] }]
  },
  "conflictsResolved": [
    {
      "description": "Auth extraction timing — clean separation vs dependency risk",
      "laneAId": "lane-expansive",
      "laneBId": "lane-pragmatic",
      "resolution": "Extract auth second, after validating infrastructure with a low-risk read-only service.",
      "tradeoff": "Slower initial progress in exchange for reduced blast radius."
    }
  ],
  "unresolvedQuestions": [
    "How will database schema ownership be divided between services?",
    "What is the team's tolerance for eventual consistency in order processing?"
  ]
}
```

### 6e. Streaming

Streaming text state lives in `view-store.ts`, not mixed into the semantic store. The semantic store only receives the final parsed result after streaming completes. This isolation prevents premature staleness propagation while content is still arriving.

- **Buffering:** Raw SSE deltas are appended to a `streamBuffers: Map<string, string>` in `view-store.ts`. Simple append-only — no ring buffer needed since LLM generates tokens slower than the browser can render them. The map key is the target node ID.

- **Error recovery:** SSE connection drop → node FSM transitions to `failed` → partial buffer for that node is discarded → UI shows greyed-out partial text + "Retry" button. Retry re-sends the full prompt (no partial resume). The buffer entry is deleted on failure.

- **Partial parse:** For structured JSON job types (`branch`, `lane_plan`, `unified_plan`), raw text accumulates unparsed during streaming — no incremental JSON parsing is attempted. When the stream completes, the full text is parsed. If the completed stream is invalid JSON, the schema gate rejects it, and the retry prompt adds: "Ensure your JSON response is complete and valid."

- **State isolation:** Streaming buffers live only in the view store. The semantic store is updated only after streaming completes and validation passes. This means: (1) staleness propagation never fires during streaming, (2) auto-save captures the pre-streaming state until the response is finalized, (3) a crash during streaming loses only the in-flight response, not the prior valid state.

- **UI rendering:** The `StreamingText` component subscribes to `streamBuffers.get(nodeId)` with a React Flow selector. It renders with a blinking cursor at the end. On completion, the streaming text is replaced by the parsed semantic content.

### 6f. Auto-save

`src/persistence/hooks.ts` provides `useAutoSave()` and `useSessionRestore()`:

- **Debounce:** Trailing-edge 500ms debounce. Rapid operations (e.g., dragging multiple nodes, receiving multiple LLM chunks) produce a single write. Uses `setTimeout`/`clearTimeout` — no external debounce library needed.

- **Write granularity:** Full session envelope snapshot on each save. Typical size is ~100-200KB for a session with 50-100 nodes. IndexedDB handles this efficiently via `put()` which overwrites the previous version atomically.

- **Corruption recovery:** Every IDB read passes through the corresponding Zod schema before entering the Zustand store. If an entity fails validation, it is logged to `console.warn`, excluded from the hydrated state, and a toast is shown: "Some data could not be loaded." Remaining valid entities load normally. This handles partial corruption gracefully.

- **Mid-write crash:** IDB transactions are atomic. A crash mid-transaction → full rollback to the previous consistent state. Maximum data loss is the 500ms debounce window (the changes since the last successful save).

- **Tab conflict:** v1 uses last-write-wins semantics. Both tabs write to the same IDB store; whichever writes last "wins." This is acceptable for a single-user v1. Future enhancement: `BroadcastChannel` for duplicate tab detection with a warning toast.

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

#### Why These Four Modes

The four modes span two orthogonal axes of dialogue behavior:

| | Adversarial (pushes back) | Supportive (builds up) |
|---|---|---|
| **Question-led** (draws out reasoning) | Socratic | Collaborative |
| **Position-led** (asserts claims) | Devil's Advocate | Steelman |

This 2x2 matrix provides complete coverage of useful dialogue dynamics. A user who is *uncertain* benefits from question-led modes that draw out their thinking. A user who is *confident* benefits from position-led modes that either challenge or strengthen their stance.

**Why not more modes?** Two candidates were considered and rejected:
- "Neutral summarizer" falls outside the dialectic framework — summarization is handled separately by the "Conclude & Synthesize" action, which isn't a dialogue mode but a terminal operation.
- "First Principles" and "Red Team" are subsumable under Socratic-intense and Devil's Advocate-intense respectively, via the existing `challengeDepth` mechanism. Adding them as separate modes would create confusion about when to use each.

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

The session-level `challengeDepth` setting (gentle | balanced | intense) modulates multiple dimensions of the dialogue prompt simultaneously:

| Parameter | Gentle | Balanced | Intense |
|-----------|--------|----------|---------|
| Concession frequency | Every 2-3 turns | Every 4-5 turns | Only when cornered by evidence |
| Follow-up persistence | Accept first answer | 1 follow-up per claim | 2-3 follow-ups, demand specifics |
| Assumption targeting | Explicitly stated assumptions only | Unstated assumptions too | Meta-assumptions (why this framing?) |
| Language register | "I wonder if..." / "Have you considered..." | "That claim needs support." / "What evidence..." | "That's unfounded. Show me the data." |
| Prompt instruction | "Gently probe assumptions. Be supportive. Acknowledge good points frequently." | "Challenge directly but respectfully. Expect the user to defend claims with reasoning." | "Rigorously interrogate every claim. Accept nothing at face value. Demand evidence." |

**Transition rule:** Changing depth mid-dialogue applies from the next AI turn. The system does not retroactively rewrite prior turns. When switching from intense → gentle, the AI includes an implicit "stepping back" meta-comment (e.g., "Let me take a less adversarial approach...") to avoid jarring tone shifts.

**Defensive user detection:** If the user's last 3 responses are all < 20 words and contain defensive markers ("I already said", "like I mentioned", "as I stated"), the system auto-backs-off one level (intense → balanced, balanced → gentle) and shows a toast: "Easing challenge depth based on conversation flow." This prevents the dialogue from becoming unproductive.

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

#### Why Pairwise Map-Reduce

Three synthesis approaches were considered:

1. **Single-shot concatenation:** Concatenate all 4 lane plans (~12K tokens input) into one prompt. Fails because LLMs produce "lowest common denominator" synthesis that papers over real conflicts. The model optimizes for coherent output, which means quietly dropping contradictions rather than surfacing them.

2. **Sequential merge:** Merge A+B, then AB+C, then ABC+D. Creates ordering bias — the first plan anchors the result, and each subsequent plan gets progressively less influence. The final plan is really "Plan A with adjustments" rather than a genuine synthesis.

3. **Pairwise map-reduce:** Compare every pair independently (no ordering bias), extract conflicts as structured data, resolve in a separate call. Every lane gets equal treatment; conflicts are surfaced explicitly rather than smoothed over.

With 4 lanes, C(4,2) = 6 pairwise comparisons. The 6 map calls are fully parallelizable (no dependencies between them), reducing wall-clock time to roughly 2 sequential LLM calls (map batch + reduce + format). At N=8 lanes this becomes 28 comparisons — still parallelizable but with a user warning about increased latency and cost. N>8 is not supported in v1.

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

#### Concrete Evidence Chain Example

Trace a single insight through the full 4-step evidence chain:

**Step 1: Exploration node generates insight**

Node `node-prag-042` in the Pragmatic lane, answering "What would break if you extracted authentication as the first microservice?":
```json
{
  "summary": "Extracting auth creates a single point of failure for all services and requires solving token propagation before any other service can be extracted.",
  "bullets": [
    "Every service must validate tokens — adds 5-15ms latency per request",
    "Session state moves from in-process to distributed cache (Redis/Memcached)",
    "Existing monolith endpoints need a compatibility shim during migration",
    "Auth service downtime = total system downtime until circuit breakers are configured"
  ]
}
```

**Step 2: User promotes the node**

User promotes `node-prag-042` with reason `risk_identification` and note: "Critical dependency risk — auth extraction order matters."

```json
{
  "id": "promo-019",
  "nodeId": "node-prag-042",
  "laneId": "lane-pragmatic",
  "reason": "risk_identification",
  "note": "Critical dependency risk — auth extraction order matters."
}
```

**Step 3: Lane plan references the promoted node**

The Pragmatic lane plan's `risks[0]` section cites the promoted node:

```json
{
  "heading": "Authentication Single Point of Failure",
  "content": [
    "Extracting authentication first creates a critical dependency: every subsequent microservice depends on the auth service being available and performant.",
    "Mitigation: implement circuit breakers and token caching before extracting any dependent service."
  ],
  "evidence": [
    {
      "nodeId": "node-prag-042",
      "laneId": "lane-pragmatic",
      "quote": "Auth service downtime = total system downtime until circuit breakers are configured",
      "relevance": "primary"
    }
  ]
}
```

**Step 4: Unified plan resolves cross-lane conflict**

The Expansive lane recommended "extract auth first for clean separation" while the Pragmatic lane identified this as a risk. The unified plan's `conflictsResolved[2]` addresses this:

```json
{
  "description": "Auth extraction timing — clean separation vs. dependency risk",
  "laneAId": "lane-expansive",
  "laneBId": "lane-pragmatic",
  "resolution": "Extract auth second, after a low-risk read-only service (e.g., product catalog) validates the infrastructure. Implement circuit breakers and token caching as prerequisites.",
  "tradeoff": "Slower initial progress in exchange for reduced blast radius. First extraction validates tooling without risking total downtime."
}
```

And the unified plan's `risks[2]` section references the same `nodeId`:

```json
{
  "heading": "Authentication Extraction Ordering Risk",
  "content": [
    "Authentication must not be the first extracted service despite its conceptual independence.",
    "Prerequisites: circuit breakers, distributed token cache, compatibility shim for monolith endpoints."
  ],
  "evidence": [
    {
      "nodeId": "node-prag-042",
      "laneId": "lane-pragmatic",
      "quote": "Auth service downtime = total system downtime until circuit breakers are configured",
      "relevance": "primary"
    }
  ]
}
```

**EvidenceTrail rendering:** The UI renders this as clickable breadcrumbs: `Unified Plan > risks[2] > Pragmatic Lane > node-prag-042`. Clicking the node reference pans the canvas to the Pragmatic lane, centers on `node-prag-042`, and highlights it with a pulse animation.

### 9c. Staleness Propagation

#### Why Staleness Exists: Content Dependency Theory

Each child node's content was generated *conditioned on* its ancestors' content. When ancestor A's answer changes, child C may now be incoherent relative to the new version. Staleness is a conservative signal: it doesn't claim C is wrong, only that C's assumptions have changed and should be reviewed.

This follows from the information-theoretic structure of the tree: content flows downward from root to leaves, so changes at any node potentially invalidate all downstream content that was generated using the old version as context.

**Propagation rules:**
- **Downward only:** Matches the direction of information flow. A child changing doesn't invalidate its parent.
- **Cross-layer:** Promoted node stale → the lane plan citing it becomes stale → the unified plan (if it references that lane plan) also becomes stale.
- **BFS traversal:** Handles diamond patterns (two paths converging on the same descendant) by processing each node exactly once via a `visited` set. This prevents infinite loops and redundant state transitions.

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
  const visited = new Set<string>(); // Cycle guard — see Edge Case 10b-10
  const queue = [...(index.childrenOf.get(changedNodeId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      console.warn('Cycle detected in staleness propagation', { changedNodeId, current });
      continue; // Break cycle, don't infinite-loop
    }
    visited.add(current);
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

## 10b. Edge Cases and Error Handling

Every edge case below must have a handling strategy implemented. These are not theoretical — they are runtime conditions that will occur in normal usage.

### 10b-1. Gemini API Timeouts

**Non-streaming calls:** 30-second `AbortController` timeout. On timeout, exponential backoff retry: 2s, 4s, 8s delays. After 3 failures → node FSM transitions to terminal `failed` state. Toast: "Generation timed out after 3 attempts. [Retry]".

**Streaming calls:** 10-second inactivity timeout (no chunks received). Partial content discarded entirely — no display of incomplete responses. Node FSM → `failed`.

**Hard ceiling:** 60 seconds total wall-clock time per generation call regardless of streaming progress. Prevents indefinite hangs on slow connections.

```typescript
// src/generation/providers/gemini.ts
const TIMEOUT_NON_STREAMING = 30_000;
const TIMEOUT_STREAM_INACTIVITY = 10_000;
const TIMEOUT_HARD_CEILING = 60_000;
const RETRY_DELAYS = [2000, 4000, 8000];
```

### 10b-2. Rate Limiting

**Client-side throttle:** Token-bucket rate limiter targeting 12 RPM (Gemini free tier limit) with burst capacity of 3. Implemented as a simple counter with sliding window.

**HTTP 429 handling:** Parse `Retry-After` header if present (default to 15s if absent). Toast: "Rate limited by Gemini. Retrying in {N}s..." with countdown. Job stays in `running` state during the wait.

**Job concurrency:** Maximum 2 concurrent generation jobs. Additional jobs remain in `queued` state. UI shows "Queued..." indicator on waiting nodes (distinct from the spinner used for `running` jobs).

```typescript
// src/generation/rate-limiter.ts
const MAX_RPM = 12;
const BURST_CAPACITY = 3;
const MAX_CONCURRENT_JOBS = 2;
```

### 10b-3. Partial Stream Failures

**Detection:** SSE connection closes without the `[DONE]` sentinel or Gemini's `finishReason: "STOP"` → classified as failed.

**Policy:** Discard all partial content. Do not display incomplete JSON. Do not attempt to parse partial structured responses.

**Recovery:** Node FSM → `failed`. UI shows greyed-out area with "Connection lost. [Retry]" button. Retry re-sends full prompt from scratch.

**Network awareness:** Subscribe to `navigator.onLine`. On `offline` event → immediately abort all in-flight requests, show persistent banner "Offline — generation paused", flush auto-save to IDB. On `online` event → dismiss banner, resume queued jobs.

### 10b-4. IndexedDB Quota

**Startup check:** Call `navigator.storage.estimate()` on app load. If `quota - usage < 50MB`, show warning toast: "Storage is running low. Consider deleting old sessions."

**Quota exceeded:** Catch `QuotaExceededError` on any IDB `put()` call. Show blocking modal: "Storage full. Delete old sessions to continue." Prevent further writes until user frees space.

**Session size tracking:** After each auto-save, record the approximate session size. Warn if a single session exceeds 10MB: "This session is very large. Consider exporting and starting fresh."

**No IDB available (private browsing):** Detect on startup by attempting a test write. If IDB is unavailable, show persistent banner: "Private browsing detected. Your data will not persist after closing this tab." All functionality works normally — data just lives in memory only.

### 10b-5. Multiple Tabs

**v1 approach (simple):** Use `localStorage` key `fuda-plan-tab-lock` with value `{tabId, timestamp}`. Each tab writes a heartbeat every 10 seconds. If a second tab opens and detects a lock with a timestamp less than 30 seconds old, it shows a read-only warning: "Another tab has this session open. Changes here won't be saved."

**Alternative (simpler, acceptable for v1):** Just show a toast warning on duplicate tab detection. Use last-write-wins for IDB. Single-user product means conflicts are self-inflicted and recoverable.

### 10b-6. Semantic Quality Validation

Beyond Zod structural validation (which checks types and shapes), add semantic content checks in `quality-gates.ts`:

**Minimum content lengths:**
- `answer.summary` > 20 characters
- Each `answer.bullets[]` item > 10 characters
- Each `branch.question` > 15 characters

**Filler phrase blocklist:** Reject responses containing any of: "as an AI", "I cannot", "TODO", "insert here", "lorem ipsum", "placeholder". These indicate the LLM failed to generate real content.

**Pairwise deduplication:** For `branch` responses, compute Jaccard similarity between all generated questions. If any pair exceeds 0.7 threshold, reject the duplicate with lower quality score.

**Self-referential detection:** Reject responses that reference the system prompt, mention being an AI language model, or contain meta-commentary about the task rather than answering it.

**EvidenceRef integrity:** For `lane_plan` and `unified_plan` responses, verify: (1) every `nodeId` in an EvidenceRef exists in the session's node store, (2) every `quote` fuzzy-matches the source node's content with >80% character overlap (Levenshtein ratio). Mismatched quotes indicate hallucinated citations.

### 10b-7. API Key Security

**Format validation:** Gemini API keys are 39 characters starting with "AIza". Validate on entry before storing.

**Test call on entry:** When user enters a key, make a trivial generation call (e.g., "Say hello"). HTTP 401/403 → "Invalid API key. Please check and re-enter." HTTP 200 → key accepted, stored in IDB.

**Runtime auth failures:** Any 401/403 during normal generation → show modal to update key. All queued jobs transition to `failed`. Previously completed content is unaffected.

**Storage:** Key stored in IndexedDB `settings` store — never in `localStorage` (visible in devtools plaintext) and never in exported JSON files. Never logged in production builds (`console.log` calls stripped by Vite in production mode).

**No key configured:** App starts in demo mode with the mock provider. Persistent banner: "Demo mode — using sample responses. Add your Gemini API key in Settings for real AI generation."

### 10b-8. Offline Mode

**Detection:** `window.addEventListener('online')` and `window.addEventListener('offline')`.

**Offline behavior:**
- Canvas navigation, pan/zoom, collapse/expand: works normally (all client-side)
- Node promotion/unpromotion: works normally (state change only)
- Generation requests: queued but paused. Spinner replaced with "Offline — will resume when connected."
- Auto-save: continues normally (IDB is local). Flush immediately on `offline` event to ensure current state is persisted.

**Reconnect:** On `online` event, automatically resume queued generation jobs in order. Toast: "Back online. Resuming {N} queued generation(s)."

### 10b-9. Deep Trees (100+ Nodes)

**React Flow performance:**
- Enable `onlyRenderVisibleElements` prop to skip rendering off-screen nodes.
- Wrap node data in `useMemo` keyed on `node.updatedAt` to prevent unnecessary re-renders.
- `useCallback` on all event handlers passed to React Flow.

**Adjacency index caching:** Cache the `AdjacencyIndex` in the semantic store. Invalidate only when nodes or edges are added/removed — not on every content update.

**Collapse/expand:** Each node has an `isCollapsed` boolean in the view store. When collapsed, all descendants are hidden from the React Flow node list. A badge shows "+N hidden nodes" on the collapsed node.

**Soft depth limit:** At depth 15, replace the "Branch" button with "Promote insights and generate a plan." This encourages the user to synthesize rather than going deeper. The limit is soft — the user can still branch via the Conversation Compass if they explicitly choose to.

**Dialogue cap:** Maximum 20 turns per node dialogue. After 20 turns, show "Dialogue limit reached. [Conclude & Synthesize] to capture insights." Prevents unbounded context window growth.

### 10b-10. Cycle Detection

**Graph invariant:** The exploration graph must be a DAG (directed acyclic graph). Cycles should be structurally impossible because edges always point from parent to child, and nodes are created (not reused) during branching.

**Defensive checks:**
- Add `visited: Set<string>` to `getAncestorChain()`. If a node is encountered twice during traversal, break the loop and `console.warn('Cycle detected in ancestor chain', { nodeId, visited })`.
- Add the same guard to `propagateStaleness()` — the BFS queue already uses a pattern that could infinite-loop on cycles.

**Structural invariant check:** On IDB load, verify that no node appears as both ancestor and descendant of another node. If detected, show toast: "Session data contains an inconsistency." Offer a "Repair session" button that removes the offending edge(s) using a simple heuristic: keep the edge with the earlier `createdAt` timestamp.

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

### Development Workflow Commands

```bash
# Setup
npm create vite@latest fuda-plan -- --template react-ts
cd fuda-plan
npm install zustand zod idb @xyflow/react
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom

# Development
npm run dev                          # http://localhost:5173
npx tsc --noEmit                     # Type-check without emit (CI gate)

# Testing
npx vitest                           # Run all tests once
npx vitest --watch                   # Watch mode for development
npx vitest --environment node src/__tests__/core/  # Layer 1 only (no DOM)
npx vitest --coverage                # Coverage report (istanbul)

# Linting
npx eslint src/ --ext .ts,.tsx       # Lint check
npx prettier --check src/            # Format check
npx prettier --write src/            # Auto-format

# Build
npm run build                        # Production build → dist/
npm run preview                      # Preview production build locally
ls -la dist/                         # Verify output size (target < 500KB gzipped)
```

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
