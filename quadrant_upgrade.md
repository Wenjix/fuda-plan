# Quadrant Mode Upgrade Specification

## 1. Summary

This document specifies a full upgrade from the current single-lane canvas view to a **4-sub-canvas quadrant mode**:

- One lane per pane in a 2x2 grid (`Expansive`, `Analytical`, `Pragmatic`, `Socratic`)
- Each pane runs an independent React Flow instance
- Pane sizes are controlled by a **hybrid auto + manual** system
- Expanding one lane **shrinks** the other three, but they remain visible and interactive
- Auto-resize is driven by a **composite lane complexity score**

The spec also includes a forward-compatible path to eventual **4-model exploration** (one model per lane), while preserving v1/v2 constraints where multi-provider remains future/backend-gated.

## 2. Product Goals

1. Make cross-lane comparison continuous instead of lane-tab switching.
2. Keep lane isolation strict (nodes/edges/generation stay lane-local).
3. Preserve current core workflow (topic -> exploration -> promotion -> lane plans -> synthesis).
4. Support dense/deep exploration by dynamically allocating more screen space to high-complexity lanes.
5. Avoid regressions in performance, persistence, and synthesis correctness.

## 3. Non-Goals

1. No multi-user collaboration.
2. No CRDT/event-sourcing changes in this upgrade.
3. No hard requirement for multi-provider backend in the first quadrant release.
4. No hidden-lane mode in the first release (all lanes always visible).

## 4. Current-State Constraints (Must Be Addressed)

1. Canvas projection currently filters to a single `activeLaneId` (single-lane render path).
2. Session startup currently begins generation only on first lane (`TopicInput -> explore(session.activeLaneId)`).
3. Prompt persona resolution currently derives from `session.activeLaneId` instead of target node lane.
4. Provider selection is currently global (`getProvider(apiKey)`), not lane-aware.

These constraints require explicit refactors described below.

## 5. UX and Interaction Model

### 5.1 Layout

1. The main canvas area becomes a `2x2` pane grid:
   - Top-left: `Expansive`
   - Top-right: `Analytical`
   - Bottom-left: `Pragmatic`
   - Bottom-right: `Socratic`
2. Each pane shows:
   - Lane header (label, color token, stats, controls)
   - React Flow sub-canvas
3. The lane tab strip is removed in quadrant mode (kept only for legacy single-lane mode if feature-flagged).

### 5.2 Expand/Shrink Behavior

1. User can click `Focus` on any pane.
2. Focused pane scales to dominant size; other panes shrink but remain visible.
3. `Reset Layout` returns to equal-split baseline.
4. Resizing never hides a lane entirely.

### 5.3 Manual Resizing

1. Splitters between rows and columns support drag.
2. Manual resize sets `manualOverride=true` for affected panes.
3. Users can pin a pane size (`pinSize=true`) to disable auto changes for that pane.
4. `Unpin` restores auto behavior for that pane.

### 5.4 Auto-Resizing (Composite Score)

Auto-resize computes a score per lane, then allocates pane area proportionally.

`score = depthWeight + unresolvedWeight + activityWeight`

Default formula:

```ts
score =
  0.45 * normalize(maxDepth, 0, 15) +
  0.35 * normalize(unresolvedNodeCount, 0, 30) +
  0.20 * normalize(recentActivity, 0, 10);
```

- `maxDepth`: deepest node depth in lane
- `unresolvedNodeCount`: nodes in `idle|generating|failed`
- `recentActivity`: weighted events in last 90s (node created, generation start/chunk/success/fail)

Stability rules:

1. Recompute every `1500ms` and on major lane events.
2. Ignore deltas below `0.06` score difference (hysteresis).
3. Animate layout transitions over `220ms` ease-out.
4. Respect pinned panes; redistribute remaining area among unpinned panes.

### 5.5 Size Bounds

Per pane constraints:

1. `minWidthPct = 15`
2. `maxWidthPct = 55`
3. `minHeightPct = 15`
4. `maxHeightPct = 55`

Grid constraints:

1. Row sum = 100%
2. Column sum = 100%
3. No pane may violate min/max after solver pass; apply clamp + rebalance.

## 6. Public Interfaces and Types

## 6.1 New UI Mode and Feature Flag

```ts
type UIMode =
  | 'topic_input'
  | 'compass'
  | 'exploring'
  | 'workspace'
  | 'quadrant';

interface QuadrantFeatureFlags {
  quadrantModeEnabled: boolean; // default true in v2.2+
  legacySingleLaneEnabled: boolean; // default true during rollout, false after cutover
}
```

## 6.2 Pane and Layout Types

```ts
type LaneId = string;

type QuadrantSlot = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';

interface LanePaneAssignment {
  laneId: LaneId;
  slot: QuadrantSlot;
}

interface PaneSize {
  widthPct: number;
  heightPct: number;
}

interface LaneComplexityMetrics {
  laneId: LaneId;
  maxDepth: number;
  unresolvedNodeCount: number;
  recentActivity: number;
  score: number;
  updatedAt: string;
}

interface PaneBehavior {
  focused: boolean;
  pinned: boolean;
  manualOverride: boolean;
}

interface QuadrantLayoutState {
  assignments: LanePaneAssignment[];
  sizes: Record<LaneId, PaneSize>;
  behavior: Record<LaneId, PaneBehavior>;
  autoResizeEnabled: boolean;
  lastAutoLayoutAt: string | null;
}
```

## 6.3 Generation Persona Resolution (Critical Fix)

Replace active-lane persona selection with target-node lane selection:

```ts
interface GenerateOptions {
  targetNodeId: string;
  jobType: JobType;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  session: PlanningSession;
  lanes: ModelLane[];
  apiKey: string;
  onChunk?: (delta: string) => void;
}

// New deterministic lookup in generate():
// 1) find target node by targetNodeId
// 2) use targetNode.laneId to resolve lane
// 3) personaId = lane.personaId
```

Failure behavior:

1. If target node missing -> generation fails with typed error `target_node_not_found`.
2. If lane missing -> fallback persona `analytical` and emit warning telemetry.

## 6.4 Event Hooks for Layout Engine

```ts
type QuadrantEvent =
  | { type: 'NODE_CREATED'; laneId: LaneId; nodeId: string; depth: number }
  | { type: 'NODE_STATE_CHANGED'; laneId: LaneId; nodeId: string; from: NodeFSMState; to: NodeFSMState }
  | { type: 'GENERATION_CHUNK'; laneId: LaneId; nodeId: string; size: number }
  | { type: 'PANE_RESIZED_MANUAL'; laneId: LaneId; size: PaneSize }
  | { type: 'PANE_PINNED'; laneId: LaneId; pinned: boolean }
  | { type: 'PANE_FOCUSED'; laneId: LaneId | null };
```

## 6.5 Forward-Compatible Lane Model Mapping (Future)

```ts
type ProviderId = 'mock' | 'gemini' | 'anthropic' | 'openai' | 'local';

interface LaneModelConfig {
  laneId: LaneId;
  providerId: ProviderId;
  modelName: string;
  enabled: boolean;
}
```

Default in first quadrant release:

1. All lanes resolve to existing provider path (Gemini or mock fallback).
2. `LaneModelConfig` persisted but hidden behind feature flag until backend/provider matrix is available.

## 7. Architecture and File-Level Changes

## 7.1 New Components

1. `src/components/QuadrantCanvas/QuadrantCanvas.tsx`
   - Parent grid layout, splitter handling, focus/reset controls
2. `src/components/QuadrantCanvas/LanePane.tsx`
   - Lane header + one React Flow instance
3. `src/components/QuadrantCanvas/QuadrantCanvas.module.css`
4. `src/components/QuadrantCanvas/layout-engine.ts`
   - Score computation, bounded rebalancing, solver utilities

## 7.2 Updated Components

1. `src/App.tsx`
   - Render `QuadrantCanvas` in `uiMode='quadrant'`
2. `src/components/TopicInput/TopicInput.tsx`
   - After `createSession()`, call `exploreAllLanes()` instead of first-lane `explore()`
3. `src/components/Toolbar/Toolbar.tsx`
   - Add mode toggle: `Single Lane` / `Quadrants`
   - Add `Auto Resize` and `Reset Layout` actions
4. `src/components/LaneSelector/LaneSelector.tsx`
   - Keep for legacy mode only; hide in quadrant mode

## 7.3 Store Updates

1. Add `src/store/quadrant-store.ts`:
   - `QuadrantLayoutState`
   - actions: `setFocusedLane`, `setPinned`, `setManualSize`, `applyAutoLayout`, `resetLayout`
2. `src/store/session-store.ts`:
   - include `uiMode='quadrant'`
3. `src/store/view-projection.ts`:
   - add `projectLaneToReactFlow(..., laneId)` (lane-scoped projection)
   - keep old `projectToReactFlow` only for legacy mode

## 7.4 Generation Pipeline Updates

1. `src/generation/pipeline.ts`
   - resolve persona from target node lane (not `session.activeLaneId`)
2. `src/store/actions.ts`
   - ensure all generated jobs call into corrected lane-persona resolution

## 7.5 Persistence Updates

Add optional persisted store for layout preferences:

1. New IndexedDB store: `workspacePreferences` (or extend settings)
2. Persist:
   - `autoResizeEnabled`
   - per-lane `pinned`
   - per-lane manual sizes
3. Do **not** persist volatile metrics (`recentActivity`, computed scores)

Migration:

1. Backward-compatible defaults for sessions without quadrant state.
2. If missing, initialize equal 25% pane area equivalent in 2x2 grid.

## 8. Data Flow

1. Session created -> 4 lanes initialized.
2. Topic submit -> `exploreAllLanes` seeds root + `path_questions` jobs for each lane.
3. Lane panes subscribe only to nodes/edges for their lane.
4. User interactions (branch/answer/promote) emit lane events.
5. Layout engine updates metrics + recomputes target sizes.
6. Quadrant store applies bounded animated resize.
7. Generation uses target node lane persona consistently.

## 9. Error Handling and Edge Cases

1. Missing lane data in pane:
   - Show inline empty state + `Retry lane load`.
2. Layout solver failure (NaN, invalid totals):
   - Fallback to equal 2x2 split and log recoverable error.
3. All panes pinned:
   - Auto-resize suspended; show tooltip `Auto layout paused (all panes pinned)`.
4. High-frequency generation chunks:
   - Activity metric update batched at 300ms to prevent thrash.
5. Very small viewport:
   - Switch to 2x2 scroll container at `< 980px` width.
   - Below `< 680px`, switch to 1-column stacked lane cards (still all visible).

## 10. Performance Requirements

1. 4-pane idle render budget: <= 40ms commit on modern laptop.
2. Pane resize interaction: >= 50fps under normal lane node counts (<150 nodes/lane).
3. Auto-layout recompute: <= 4ms per cycle for 4 lanes.
4. Avoid re-render cascade:
   - Selector-based store subscriptions per pane.
   - Memoized lane projection.
   - Debounced metrics pipeline.

## 11. Accessibility and Keyboard

1. Pane focus button keyboard reachable.
2. Splitters keyboard-adjustable:
   - `Arrow keys` +/- 2%
   - `Shift + Arrow` +/- 5%
3. Announce lane size changes via `aria-live="polite"`.
4. Preserve contrast with lane color accents.

## 12. Testing Specification

## 12.1 Unit Tests

1. `layout-engine.test.ts`
   - score computation with deterministic fixtures
   - clamp + rebalance invariants
   - pinned-pane redistribution
   - hysteresis behavior
2. `pipeline.persona-resolution.test.ts`
   - target-node-lane persona resolution
   - missing target/lane fallbacks
3. `quadrant-store.test.ts`
   - focus, pin, manual resize, reset
   - auto-layout disabled/enable flows

## 12.2 Component Tests

1. `QuadrantCanvas.test.tsx`
   - renders four panes with correct lane labels/colors
   - focus lane expands and others shrink
   - reset returns equal layout
2. `LanePane.test.tsx`
   - shows lane-specific nodes only
   - independent pan/zoom control
3. `Toolbar.quadrant-controls.test.tsx`
   - toggle mode
   - auto-resize switch
   - reset layout command

## 12.3 Integration Tests

1. Topic submit creates roots in all four lanes.
2. Branch in lane A does not mutate lane B/C/D node sets.
3. Generation in lane B uses lane B persona regardless of UI focus.
4. Pinned lane remains stable during auto-resize cycles.
5. Save/reload restores layout preferences and lane content.

## 12.4 Regression Tests

1. Lane plan generation still requires promoted nodes per lane.
2. Synthesis gating (`>=3 lane plans`) unchanged.
3. Export content and evidence mapping unchanged.

## 13. Acceptance Criteria

1. Four lanes are simultaneously visible in a 2x2 quadrant layout.
2. Each pane is independently pannable/zoomable.
3. Focused pane expands while others remain visible.
4. Auto-resize responds to lane complexity and activity.
5. Manual resize + pin reliably override auto-resize.
6. Persona selection is always based on target node lane.
7. No cross-lane node/edge leakage in rendering or mutation.
8. Existing synthesis and evidence-chain behavior remains intact.

## 14. Rollout Plan

### Phase Q1 (Quadrant Persona Mode)

1. Implement quadrant UI, layout engine, lane-scoped rendering.
2. Fix persona resolution by target node lane.
3. Keep provider path global (Gemini/mock), no multi-provider changes.
4. Gate with `quadrantModeEnabled`.

### Phase Q2 (Provider-Lane Config Foundations)

1. Introduce `LaneModelConfig` persistence and UI (read-only or soft-enabled).
2. Keep hard routing to existing provider unless backend capability is enabled.

### Phase Q3 (4-Model Exploration, Backend-Enabled)

1. Add provider routing per lane through backend-proxied provider implementations.
2. Support lane-specific credentials and model selection.
3. Add provider health checks and per-lane failure isolation.

## 15. Assumptions and Defaults

1. Exactly 4 lanes per session remain the default.
2. Lane labels/colors continue from `DEFAULT_LANES`.
3. Quadrant mode is desktop-first; mobile falls back to stacked all-lane layout.
4. Auto-resize is enabled by default.
5. Manual overrides persist across reload.
6. No backend dependency is introduced for Q1.
7. Future 4-model-per-lane support depends on backend/provider expansion already identified in long-term plan.

