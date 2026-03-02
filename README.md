# FUDA — Multi-Perspective AI Planning

**FUDA** (Future-directed Understanding and Decision Architecture) is a browser-native strategic planning tool that explores any topic simultaneously through four AI personas — Expansive, Analytical, Pragmatic, and Socratic — then synthesizes their independent explorations into a single, evidence-backed unified plan.

## Problem Statement

Most AI planning tools give you one perspective. You ask a question, get one answer, and build a plan from a single viewpoint. This creates blind spots — a pragmatic planner misses creative reframes, an expansive thinker overlooks operational constraints, and nobody probes the hidden assumptions underneath.

FUDA solves this by running four independent AI exploration lanes in parallel, each with a distinct cognitive style, then reconciling their findings through a structured synthesis pipeline. The result is a plan that has been stress-tested from multiple angles before you even begin executing.

## Vision

A planning session in FUDA follows five phases:

1. **Topic Input** — State a planning question (e.g., "Should we migrate from a monolith to microservices?"). FUDA creates a session and seeds four independent exploration lanes.

2. **Exploration** — Each lane's AI persona generates a tree of follow-up questions arranged along six "Conversation Compass" directions: Clarify, Go Deeper, Challenge, Apply, Connect, Surprise. You navigate the tree by answering nodes and branching in any direction.

3. **Dialogue** — On any resolved node, open a Socratic dialogue in four modes: Socratic, Devil's Advocate, Steelman, or Collaborative.

4. **Lane Plans** — Promote key insights from each lane. The AI synthesizes a per-lane structured plan (goals, assumptions, strategy, milestones, risks, next actions) with evidence citations linking every claim back to exploration nodes.

5. **Synthesis** — A map-reduce pipeline compares all lane-plan pairs, surfaces contradictions and synergies, resolves conflicts, and produces a **Unified Plan** with a full evidence trail.

After synthesis, **Talk to Plan** lets you reflect on the unified plan by voice or text. The AI identifies gaps, proposes edits, and you approve or reject each change.

## Tech Stack

### Frontend

| Layer | Technology |
|-------|------------|
| UI framework | React 19 |
| Build tool | Vite 7 |
| Language | TypeScript 5.9 (strict) |
| State management | Zustand 5 |
| Graph canvas | React Flow (`@xyflow/react` v12) |
| Schema validation | Zod 4 |
| Persistence | IndexedDB via `idb` |
| Testing | Vitest + @testing-library/react |

### AI Providers

Each persona is wired to a specific LLM provider. Keys are resolved from IndexedDB settings with fallback to `.env` variables.

| Persona | Provider | Model |
|---------|----------|-------|
| Expansive | Mistral | `mistral-large-2512` |
| Analytical | Mistral | `mistral-large-2512` |
| Pragmatic | Anthropic | `claude-sonnet-4-6` |
| Socratic | Anthropic | `claude-sonnet-4-6` |

Cross-lane operations (synthesis, Talk to Plan) use the default Mistral provider. Voice features use ElevenLabs STT/TTS.

### Backend (optional)

Express 5 + `node-pty` WebSocket server for the embedded terminal feature.

## The Four Personas

**Expansive** (`#7B4FBF` purple) — Imaginative, wide-ranging, future-oriented. Sees possibilities where others see constraints. Uses analogies across domains. Asks "what if?" frequently.

**Analytical** (`#4A90D9` blue) — Structured, logical, evidence-grounded. Uses numbered lists, decision matrices, and explicit criteria. Quantifies when possible. Flags logical fallacies.

**Pragmatic** (`#3DAA6D` green) — Direct, specific, implementation-focused. Evaluates ideas through timelines, resources, team capacity, and operational risk. References industry precedents.

**Socratic** (`#D94F4F` red) — Probing, precise, relentless. Surfaces hidden assumptions, reveals contradictions, forces justification. Never states opinions — only asks questions.

## Architecture

### Generation Pipeline

Every AI call goes through a fixed pipeline:

1. **Context compilation** — Traverses the semantic graph from the target node upward, packing a 4,000-token budget across ancestors (60%), siblings (30%), and cousins (10%).
2. **Persona resolution** — The target node's lane determines which persona and LLM provider to use.
3. **Prompt construction** — System preamble + compiled context + job-type-specific instructions with exact JSON schema.
4. **Rate limiting** — Token-bucket rate limiter (12 RPM, burst 4) + concurrency controller (4 simultaneous jobs).
5. **Provider call** — Streaming for live canvas updates, single call otherwise.
6. **Schema validation** — Zod validation against the expected response schema per job type.

### Quadrant Canvas

The 2x2 grid layout shows all four persona lanes simultaneously with:
- Draggable splitters between panes
- Auto-resize that biases screen space toward the most active quadrant
- Responsive breakpoints (2x2 → 2x1 → stack)
- Per-pane focus (expand) and pin (lock size) controls

### Synthesis Pipeline

Rather than asking one LLM to reconcile four plans at once:
1. **Map phase** — C(n,2) pairwise comparisons run in parallel, identifying contradictions, synergies, and gaps
2. **Reduce phase** — Resolves all identified conflicts with explicit trade-off documentation
3. **Format phase** — Produces the final unified plan with merged sections and evidence trail

### FSM-Driven Lifecycle

Every `SemanticNode`, `GenerationJob`, and `PlanningSession` has a strict finite state machine preventing double-generation and making retry logic deterministic.

## Challenges Faced

**Provider API incompatibilities** — Each LLM provider has a different API shape. Gemini uses a unique request/response format. Anthropic requires special CORS headers for browser-side calls and has no native JSON mode. OpenAI deprecated `max_tokens` in favor of `max_completion_tokens` for newer models. We solved this with a provider abstraction layer: an OpenAI-compatible base class (shared by Mistral and OpenAI) and a standalone Anthropic provider with defensive code-fence stripping.

**Gemini and OpenAI API instability** — During development, both Gemini (`gemini-3.1-pro-preview`, `gemini-3.0-flash`) and OpenAI (`gpt-5.2-chat-latest`) returned persistent errors. We temporarily routed their lanes to Mistral and Anthropic respectively. The provider registry and mapping are designed so swapping back is a one-line config change.

**Context window management** — Sending the full exploration graph to the LLM would quickly exceed token limits. The tiered budget system (ancestors first, surplus rollover) keeps prompts tightly scoped while preserving the conversation thread that led to the current node.

**Cross-lane synthesis at scale** — Reconciling four independent plans is an O(n^2) comparison problem. The map-reduce decomposition breaks it into manageable pairwise chunks that run in parallel, with a single reduce pass to resolve conflicts globally.

**Browser-side streaming** — All providers use SSE streaming with different event formats (Gemini's `data:` with nested candidates, OpenAI's `choices[0].delta.content`, Anthropic's `content_block_delta`). Each provider implements its own SSE parser with shared timeout and retry infrastructure.

## Future Implementation Opportunities

**Re-enable Gemini and OpenAI lanes** — The provider classes and factory are fully wired. Once API issues are resolved, restoring the original 4-provider mapping is a single change in `PERSONA_PROVIDER_MAP`.

**Per-provider rate limiters** — Currently all providers share one rate limiter. Adding per-provider buckets would allow higher aggregate throughput when multiple providers are active.

**Custom persona-to-provider mapping** — Let users choose which model powers each lane via the Settings UI, rather than hardcoding the mapping.

**Session branching** — Fork a session at any point to explore alternative planning paths without losing the original exploration.

**Collaborative sessions** — Multi-user support where different people explore different lanes simultaneously, with real-time sync via WebSocket or CRDTs.

**Plan versioning and diff** — Track unified plan revisions over time and show diffs between versions, especially after Talk to Plan edits.

**Export to project management tools** — Convert the unified plan's milestones and next actions into Jira tickets, Linear issues, or GitHub projects.

**Offline support** — Service worker + IndexedDB already stores all data locally. Adding a sync queue would let users work offline and reconcile when back online.

## Getting Started

### Prerequisites

- Node.js 20+
- API keys for at least one of: Mistral, Anthropic (Gemini and OpenAI optional)
- (Optional) ElevenLabs API key for voice features

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file:

```env
VITE_MISTRAL_API_KEY=your_mistral_key
VITE_ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
VITE_GEMINI_API_KEY=AIza_your_gemini_key
VITE_OPENAI_API_KEY=sk-your_openai_key
```

Or enter keys at runtime in Settings — they're stored in IndexedDB and take priority over `.env` values.

### Running

```bash
npm run dev          # frontend only
npm run dev:full     # frontend + terminal server
```

### Testing

```bash
npm test             # run once
npm run test:watch   # watch mode
```

## Project Structure

```
src/
├── core/              # Domain types (Zod schemas), FSMs, graph utilities, validation
├── generation/
│   ├── providers/     # Mistral, Gemini, OpenAI, Anthropic, Demo adapters
│   ├── prompts/       # Prompt builders per job type + persona preambles
│   ├── pipeline.ts    # Context → prompt → provider → validate orchestration
│   └── rate-limiter.ts
├── store/             # Zustand stores + action modules
├── components/        # React components (Canvas, Quadrant, Dialogue, Plans, etc.)
├── persistence/       # IndexedDB schema, repository, settings, migrations
├── services/          # Voice (ElevenLabs), telemetry, terminal
└── utils/             # IDs, layout, export, tokens
```

The full implementation specification lives at `docs/plans/plan_for_fuda.md` (~2,600 lines covering 33 epics across 6 phases).
