#!/usr/bin/env bash
# create_beads.sh — Create 160+ beads from FUDA Plan specification
# Creates 33 epics, 167 tasks, and ~246 blocking dependencies
#
# Strategy:
#   Pass 1: Create ALL beads via br create --silent (with auto-flush)
#   Pass 2: Export to JSONL, patch deps with Python, reimport
#
# This bypasses a B-tree corruption bug in br dep add (v0.1.20).
set -euo pipefail

NAF="--no-auto-flush"

# Guard: prevent running on already-populated database
EXISTING=$(br count 2>/dev/null || echo "0")
if [ "$EXISTING" -gt 0 ]; then
  echo "ERROR: Database already has $EXISTING beads. Delete and reinit first:"
  echo "  rm -rf .beads && br init"
  exit 1
fi

echo "=== Creating FUDA Plan beads ==="
echo ""

########################################
# PASS 1: CREATE ALL BEADS
########################################

echo "--- Phase 0: Foundation ---"

# --- Epic 01: Project Scaffolding ---
echo "  Epic 01: Project Scaffolding"
E01=$(br create "Project Scaffolding" -t epic -p P0 -l "phase-0,infra" -d "Vite init, deps, tsconfig, eslint, vitest, directory structure" --silent)
T001=$(br create "Initialize Vite project with React-TS template" -t task -p P0 -l "phase-0,infra" --parent "$E01" --silent)
T002=$(br create "Install core deps: zustand, zod, idb, @xyflow/react" -t task -p P0 -l "phase-0,infra" --parent "$E01" --silent)
T003=$(br create "Install dev deps: vitest, testing-library, jsdom" -t task -p P0 -l "phase-0,infra" --parent "$E01" --silent)
T004=$(br create "Configure tsconfig.json with strict mode" -t task -p P0 -l "phase-0,infra" --parent "$E01" --silent)
T005=$(br create "Configure ESLint and Prettier" -t task -p P0 -l "phase-0,infra" --parent "$E01" --silent)
T006=$(br create "Configure Vitest (vitest.config.ts)" -t task -p P0 -l "phase-0,infra" --parent "$E01" --silent)
T007=$(br create "Create directory structure: core/, generation/, store/, persistence/, components/, utils/, __tests__/" -t task -p P0 -l "phase-0,infra" --parent "$E01" --silent)
T008=$(br create "Create .env.example with VITE_GEMINI_API_KEY" -t task -p P0 -l "phase-0,infra" --parent "$E01" --silent)

# --- Epic 02: Primitive Types ---
echo "  Epic 02: Primitive Types"
E02=$(br create "Primitive Types" -t epic -p P0 -l "phase-0,types" -d "10 Zod schema files for all domain types plus barrel export" --silent)
T009=$(br create "Create primitives.ts: UUID, ISODateTime, PathType, ChallengeDepth schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T010=$(br create "Create session.ts: SessionStatus, PlanningSession schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T011=$(br create "Create lane.ts: PersonaId, ModelLane, DEFAULT_LANES schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T012=$(br create "Create node.ts: NodeFSMState, NodeType, Answer, BranchQuality, SemanticNode schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T013=$(br create "Create edge.ts: SemanticEdge schema" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T014=$(br create "Create dialogue.ts: DialecticMode, TurnType, SuggestedResponse, DialogueTurn schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T015=$(br create "Create promotion.ts: PromotionReason, Promotion schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T016=$(br create "Create plan.ts: EvidenceRef, PlanSection, StructuredPlan, LanePlan schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T017=$(br create "Create unified-plan.ts: ConflictResolution, UnifiedPlan schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T018=$(br create "Create job.ts: JobFSMState, JobType, GenerationJob schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T019=$(br create "Create context.ts: ContextRole, ContextEntry, CompiledContext schemas" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)
T020=$(br create "Create types/index.ts barrel export for all type modules" -t task -p P0 -l "phase-0,types" --parent "$E02" --silent)

# --- Epic 03: Utility Functions ---
echo "  Epic 03: Utility Functions"
E03=$(br create "Utility Functions" -t epic -p P0 -l "phase-0,core" -d "UUID generation, token estimation, animation constants" --silent)
T021=$(br create "Create utils/ids.ts: UUID generation utility" -t task -p P0 -l "phase-0,core" --parent "$E03" --silent)
T022=$(br create "Create utils/tokens.ts: token estimation (chars/4)" -t task -p P0 -l "phase-0,core" --parent "$E03" --silent)
T023=$(br create "Create utils/motion.ts: animation choreography constants" -t task -p P0 -l "phase-0,core" --parent "$E03" --silent)

# --- Epic 04: Finite State Machines ---
echo "  Epic 04: Finite State Machines"
E04=$(br create "Finite State Machines" -t epic -p P0 -l "phase-0,fsm" -d "Session, node, and job FSMs as pure transition functions" --silent)
T024=$(br create "Implement session-fsm.ts: sessionTransition() with guards" -t task -p P0 -l "phase-0,fsm" --parent "$E04" --silent)
T025=$(br create "Implement node-fsm.ts: nodeTransition(), canPromote(), canBranch()" -t task -p P0 -l "phase-0,fsm" --parent "$E04" --silent)
T026=$(br create "Implement job-fsm.ts: jobTransition() with retry logic" -t task -p P0 -l "phase-0,fsm" --parent "$E04" --silent)

# --- Epic 05: Graph Traversal ---
echo "  Epic 05: Graph Traversal"
E05=$(br create "Graph Traversal" -t epic -p P0 -l "phase-0,graph" -d "Adjacency index, ancestor chain, sibling queries" --silent)
T027=$(br create "Implement buildAdjacencyIndex: childrenOf + parentOf maps" -t task -p P0 -l "phase-0,graph" --parent "$E05" --silent)
T028=$(br create "Implement getAncestorChain: walk to root with cycle guard" -t task -p P0 -l "phase-0,graph" --parent "$E05" --silent)
T029=$(br create "Implement getSiblings: other children of same parent" -t task -p P0 -l "phase-0,graph" --parent "$E05" --silent)

# --- Epic 06: Context Compiler ---
echo "  Epic 06: Context Compiler"
E06=$(br create "Context Compiler" -t epic -p P0 -l "phase-0,graph" -d "Token-budgeted context with ancestor/sibling/cousin tiers" --silent)
T030=$(br create "Implement compileContext: token-budgeted ancestor/sibling/cousin packing" -t task -p P0 -l "phase-0,graph" --parent "$E06" --silent)
T031=$(br create "Implement formatContextForPrompt: structured prompt string" -t task -p P0 -l "phase-0,graph" --parent "$E06" --silent)
T032=$(br create "Implement cousin traversal: parent-sibling-children walk" -t task -p P0 -l "phase-0,graph" --parent "$E06" --silent)

# --- Epic 07: Quality Gates ---
echo "  Epic 07: Quality Gates"
E07=$(br create "Quality Gates" -t epic -p P0 -l "phase-0,validation" -d "Specificity, uniqueness (Jaccard), branchability gates + schema validation" --silent)
T033=$(br create "Implement specificity gate: named-entity/domain-term ratio" -t task -p P0 -l "phase-0,validation" --parent "$E07" --silent)
T034=$(br create "Implement uniqueness gate: Jaccard bigram similarity" -t task -p P0 -l "phase-0,validation" --parent "$E07" --silent)
T035=$(br create "Implement branchability gate: open-ended question heuristic" -t task -p P0 -l "phase-0,validation" --parent "$E07" --silent)
T036=$(br create "Implement runQualityGates orchestrator with retry strategy" -t task -p P0 -l "phase-0,validation" --parent "$E07" --silent)
T037=$(br create "Implement schema-gates.ts: Zod parse + retry logic" -t task -p P0 -l "phase-0,validation" --parent "$E07" --silent)

# --- Epic 08: Staleness Propagation ---
echo "  Epic 08: Staleness Propagation"
E08=$(br create "Staleness Propagation" -t epic -p P0 -l "phase-0,graph" -d "BFS downstream staleness + cross-layer plan invalidation" --silent)
T038=$(br create "Implement propagateStaleness: BFS with visited set" -t task -p P0 -l "phase-0,graph" --parent "$E08" --silent)
T039=$(br create "Implement cross-layer staleness: promoted node -> lane plan -> unified plan" -t task -p P0 -l "phase-0,graph" --parent "$E08" --silent)

# --- Epic 09: Persistence Layer ---
echo "  Epic 09: Persistence Layer"
E09=$(br create "Persistence Layer" -t epic -p P0 -l "phase-0,persistence" -d "IDB schema, CRUD repository, migration, settings store" --silent)
T040=$(br create "Define IDB schema: FudaDB interface with 9 object stores" -t task -p P0 -l "phase-0,persistence" --parent "$E09" --silent)
T041=$(br create "Implement repository.ts: typed CRUD with Zod validation on read/write" -t task -p P0 -l "phase-0,persistence" --parent "$E09" --silent)
T042=$(br create "Implement migration.ts: schema version migration strategy" -t task -p P0 -l "phase-0,persistence" --parent "$E09" --silent)
T043=$(br create "Implement settings store: API key + preferences in IDB" -t task -p P0 -l "phase-0,persistence" --parent "$E09" --silent)

# --- Epic 10: Phase 0 Test Suite ---
echo "  Epic 10: Phase 0 Test Suite"
E10=$(br create "Phase 0 Test Suite" -t epic -p P0 -l "phase-0,testing" -d "Comprehensive tests for FSMs, traversal, quality gates, IDB, type validation" --silent)
T044=$(br create "Write session-fsm tests: all valid/invalid transitions + guards" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)
T045=$(br create "Write node-fsm tests: transitions, canPromote, canBranch" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)
T046=$(br create "Write job-fsm tests: full lifecycle, retry path, terminal states" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)
T047=$(br create "Write context-compiler tests: ancestor chain, budget, format" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)
T048=$(br create "Write traversal tests: 5-deep tree, 3 siblings, empty graph" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)
T049=$(br create "Write staleness tests: propagation depth, diamond graph, leaf no-op" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)
T050=$(br create "Write quality-gate tests: specificity, uniqueness, branchability pass/fail" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)
T051=$(br create "Write IDB repository round-trip tests for all entity types" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)
T052=$(br create "Write type validation tests: Zod parse valid + reject invalid data" -t task -p P0 -l "phase-0,testing" --parent "$E10" --silent)

echo ""
echo "--- Phase 1: Single-Lane Exploration ---"

# --- Epic 11: Zustand Store Setup ---
echo "  Epic 11: Zustand Store Setup"
E11=$(br create "Zustand Store Setup" -t epic -p P1 -l "phase-1,store" -d "3+1 store architecture: semantic, view, session, job stores + projection" --silent)
T053=$(br create "Implement semantic-store.ts: nodes, edges, promotions, plans" -t task -p P1 -l "phase-1,store" --parent "$E11" --silent)
T054=$(br create "Implement view-store.ts: positions, collapse, stream buffers" -t task -p P1 -l "phase-1,store" --parent "$E11" --silent)
T055=$(br create "Implement session-store.ts: active session, lane, challenge depth" -t task -p P1 -l "phase-1,store" --parent "$E11" --silent)
T056=$(br create "Implement job-store.ts: ephemeral job queue + status tracking" -t task -p P1 -l "phase-1,store" --parent "$E11" --silent)
T057=$(br create "Implement view projection: semantic nodes -> React Flow nodes/edges" -t task -p P1 -l "phase-1,store" --parent "$E11" --silent)

# --- Epic 12: Generation Pipeline ---
echo "  Epic 12: Generation Pipeline"
E12=$(br create "Generation Pipeline" -t epic -p P1 -l "phase-1,generation" -d "Provider interface, mock/Gemini providers, selector, unified pipeline" --silent)
T058=$(br create "Define GenerationProvider interface: generate() + generateStream()" -t task -p P1 -l "phase-1,generation" --parent "$E12" --silent)
T059=$(br create "Implement mock provider: deterministic responses for testing" -t task -p P1 -l "phase-1,generation" --parent "$E12" --silent)
T060=$(br create "Implement Gemini provider: streaming + non-streaming with AbortController" -t task -p P1 -l "phase-1,generation" --parent "$E12" --silent)
T061=$(br create "Implement provider selector: choose provider based on session config" -t task -p P1 -l "phase-1,generation" --parent "$E12" --silent)
T062=$(br create "Implement pipeline.ts: context -> prompt -> provider -> parse -> validate" -t task -p P1 -l "phase-1,generation" --parent "$E12" --silent)

# --- Epic 13: Prompt Builders ---
echo "  Epic 13: Prompt Builders"
E13=$(br create "Prompt Builders" -t epic -p P1 -l "phase-1,generation" -d "System preambles, path-questions, answer, branch, dispatcher" --silent)
T063=$(br create "Implement system-preambles.ts: persona system prompts" -t task -p P1 -l "phase-1,generation" --parent "$E13" --silent)
T064=$(br create "Implement path-questions.ts: 6-direction compass prompt" -t task -p P1 -l "phase-1,generation" --parent "$E13" --silent)
T065=$(br create "Implement answer.ts: node answer generation prompt" -t task -p P1 -l "phase-1,generation" --parent "$E13" --silent)
T066=$(br create "Implement branch.ts: follow-up question generation prompt" -t task -p P1 -l "phase-1,generation" --parent "$E13" --silent)
T067=$(br create "Implement prompts/index.ts: buildPrompt dispatcher" -t task -p P1 -l "phase-1,generation" --parent "$E13" --silent)

# --- Epic 14: Personas ---
echo "  Epic 14: Personas"
E14=$(br create "Personas" -t epic -p P1 -l "phase-1,generation" -d "4 exploration personas + 1 planner persona definitions" --silent)
T068=$(br create "Define 4 exploration personas: expansive, analytical, pragmatic, socratic" -t task -p P1 -l "phase-1,generation" --parent "$E14" --silent)
T069=$(br create "Define planner persona for plan + synthesis generation" -t task -p P1 -l "phase-1,generation" --parent "$E14" --silent)

# --- Epic 15: Streaming Infrastructure ---
echo "  Epic 15: Streaming Infrastructure"
E15=$(br create "Streaming Infrastructure" -t epic -p P1 -l "phase-1,generation" -d "SSE parse, buffers, partial parse, error recovery" --silent)
T070=$(br create "Implement SSE parser for Gemini streaming responses" -t task -p P1 -l "phase-1,generation" --parent "$E15" --silent)
T071=$(br create "Implement stream buffers in view-store (Map<nodeId, string>)" -t task -p P1 -l "phase-1,store" --parent "$E15" --silent)
T072=$(br create "Implement partial parse handling: accumulate then parse on completion" -t task -p P1 -l "phase-1,generation" --parent "$E15" --silent)
T073=$(br create "Implement stream error recovery: discard partial, transition to failed" -t task -p P1 -l "phase-1,generation" --parent "$E15" --silent)

# --- Epic 16: Rate Limiting ---
echo "  Epic 16: Rate Limiting"
E16=$(br create "Rate Limiting" -t epic -p P1 -l "phase-1,generation" -d "Token bucket (12 RPM), job concurrency (max 2), 429 handling" --silent)
T074=$(br create "Implement token bucket rate limiter: 12 RPM with burst of 3" -t task -p P1 -l "phase-1,generation" --parent "$E16" --silent)
T075=$(br create "Implement job concurrency control: max 2 concurrent jobs" -t task -p P1 -l "phase-1,generation" --parent "$E16" --silent)
T076=$(br create "Implement HTTP 429 handling with Retry-After parsing" -t task -p P1 -l "phase-1,generation" --parent "$E16" --silent)

# --- Epic 17: Auto-Save & Restore ---
echo "  Epic 17: Auto-Save & Restore"
E17=$(br create "Auto-Save and Restore" -t epic -p P1 -l "phase-1,persistence" -d "Debounced auto-save (500ms) and session restore hooks" --silent)
T077=$(br create "Implement useAutoSave hook: 500ms trailing-edge debounce to IDB" -t task -p P1 -l "phase-1,persistence" --parent "$E17" --silent)
T078=$(br create "Implement useSessionRestore hook: IDB hydration with Zod validation" -t task -p P1 -l "phase-1,persistence" --parent "$E17" --silent)

# --- Epic 18: Core UI Components ---
echo "  Epic 18: Core UI Components"
E18=$(br create "Core UI Components" -t epic -p P1 -l "phase-1,ui" -d "App shell, TopicInput, Canvas, ExplorationCard, Compass, Toolbar, shared" --silent)
T079=$(br create "Implement App.tsx shell: layout, router, store providers" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)
T080=$(br create "Implement TopicInput component: min 10 chars validation" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)
T081=$(br create "Implement FudaCanvas: React Flow wrapper with custom node types" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)
T082=$(br create "Implement ExplorationCard: question, answer, branch buttons (promote button is stub until Phase 3)" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)
T083=$(br create "Implement ConversationCompass: 6-direction radial path selector" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)
T084=$(br create "Implement Toolbar: session status, actions, mode indicators" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)
T085=$(br create "Implement shared/Connector.tsx: custom edge component" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)
T086=$(br create "Implement shared/StreamingText.tsx: real-time text display with cursor" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)
T087=$(br create "Implement shared/StatusBadge.tsx: FSM state indicator badges" -t task -p P1 -l "phase-1,ui" --parent "$E18" --silent)

# --- Epic 19: Store Actions ---
echo "  Epic 19: Store Actions"
E19=$(br create "Store Actions" -t epic -p P1 -l "phase-1,store" -d "Exploration actions (explore, answer, branch) and session lifecycle" --silent)
T088=$(br create "Implement exploration actions: explore, answer, branch with pipeline" -t task -p P1 -l "phase-1,store" --parent "$E19" --silent)
T089=$(br create "Implement session lifecycle actions: create, load, reset" -t task -p P1 -l "phase-1,store" --parent "$E19" --silent)

# --- Epic 20: Phase 1 Test Suite ---
echo "  Epic 20: Phase 1 Test Suite"
E20=$(br create "Phase 1 Test Suite" -t epic -p P1 -l "phase-1,testing" -d "Pipeline, prompt, store, component, and integration tests" --silent)
T090=$(br create "Write pipeline tests: mock provider end-to-end generation" -t task -p P1 -l "phase-1,testing" --parent "$E20" --silent)
T091=$(br create "Write prompt builder tests: non-empty output with required sections" -t task -p P1 -l "phase-1,testing" --parent "$E20" --silent)
T092=$(br create "Write store tests: semantic-store add/update/query" -t task -p P1 -l "phase-1,testing" --parent "$E20" --silent)
T093=$(br create "Write component tests: ExplorationCard, ConversationCompass rendering" -t task -p P1 -l "phase-1,testing" --parent "$E20" --silent)
T094=$(br create "Write integration test: topic -> explore -> answer -> branch flow" -t task -p P1 -l "phase-1,testing" --parent "$E20" --silent)

echo ""
echo "--- Phase 2: Socratic Dialogue ---"

# --- Epic 21: Dialogue System ---
echo "  Epic 21: Dialogue System"
E21=$(br create "Dialogue System" -t epic -p P1 -l "phase-2,generation" -d "Prompt builder, 4 mode templates, challenge depth, actions, suggested responses" --silent)
T095=$(br create "Implement buildDialoguePrompt: mode + history + context + challenge depth" -t task -p P1 -l "phase-2,generation" --parent "$E21" --silent)
T096=$(br create "Implement 4 dialectic mode templates: socratic, devil, steelman, collaborative" -t task -p P1 -l "phase-2,generation" --parent "$E21" --silent)
T097=$(br create "Implement challenge depth modulation: gentle/balanced/intense prompt tuning" -t task -p P1 -l "phase-2,generation" --parent "$E21" --silent)
T098=$(br create "Implement dialogue store actions: addTurn, switchMode, getHistory" -t task -p P1 -l "phase-2,store" --parent "$E21" --silent)
T099=$(br create "Implement suggested responses handling: parse AI suggestions, wire clicks" -t task -p P1 -l "phase-2,generation" --parent "$E21" --silent)
T100=$(br create "Implement defensive user detection: auto-back-off on short responses" -t task -p P2 -l "phase-2,generation" --parent "$E21" --silent)
T101=$(br create "Implement conclude-and-synthesize: dialogue summary -> enriched answer" -t task -p P1 -l "phase-2,generation" --parent "$E21" --silent)
T163=$(br create "Write dialogue system tests: DialoguePanel render, mode selector, suggested responses clickable" -t task -p P1 -l "phase-2,testing" --parent "$E21" --silent)

# --- Epic 22: Dialogue UI ---
echo "  Epic 22: Dialogue UI"
E22=$(br create "Dialogue UI" -t epic -p P1 -l "phase-2,ui" -d "DialoguePanel, mode selector, SuggestedResponses, free-form input, conclude button" --silent)
T102=$(br create "Implement DialoguePanel component: slide-in sidebar with chat thread" -t task -p P1 -l "phase-2,ui" --parent "$E22" --silent)
T103=$(br create "Implement dialectic mode selector: 4 toggle buttons" -t task -p P1 -l "phase-2,ui" --parent "$E22" --silent)
T104=$(br create "Implement SuggestedResponses component: clickable response chips" -t task -p P1 -l "phase-2,ui" --parent "$E22" --silent)
T105=$(br create "Implement free-form text input for user dialogue turns" -t task -p P1 -l "phase-2,ui" --parent "$E22" --silent)
T106=$(br create "Implement conclude button: triggers dialogue synthesis" -t task -p P1 -l "phase-2,ui" --parent "$E22" --silent)
T107=$(br create "Wire Discuss button on ExplorationCard to open DialoguePanel" -t task -p P1 -l "phase-2,ui" --parent "$E22" --silent)

echo ""
echo "--- Phase 3: Multi-Lane + Promotion + Lane Plans ---"

# --- Epic 23: Multi-Lane System ---
echo "  Epic 23: Multi-Lane System"
E23=$(br create "Multi-Lane System" -t epic -p P1 -l "phase-3,store" -d "Lane initialization, LaneSelector, lane switching, per-lane root generation" --silent)
T108=$(br create "Implement lane initialization: create 4 DEFAULT_LANES on session create" -t task -p P1 -l "phase-3,store" --parent "$E23" --silent)
T109=$(br create "Implement LaneSelector component: color-coded tab bar" -t task -p P1 -l "phase-3,ui" --parent "$E23" --silent)
T110=$(br create "Implement lane switching: filter canvas to active lane nodes/edges" -t task -p P1 -l "phase-3,ui" --parent "$E23" --silent)
T111=$(br create "Implement per-lane root node generation with persona prompts" -t task -p P1 -l "phase-3,generation" --parent "$E23" --silent)
T164=$(br create "Write LaneSelector test: 4 tabs render, switching changes active lane" -t task -p P1 -l "phase-3,testing" --parent "$E23" --silent)

# --- Epic 24: Promotion System ---
echo "  Epic 24: Promotion System"
E24=$(br create "Promotion System" -t epic -p P1 -l "phase-3,store" -d "Promote/unpromote actions, badge, modal, wiring, tests" --silent)
T112=$(br create "Implement promotion store actions: promote, unpromote with FSM guard" -t task -p P1 -l "phase-3,store" --parent "$E24" --silent)
T113=$(br create "Implement PromotionBadge component: gold star indicator" -t task -p P1 -l "phase-3,ui" --parent "$E24" --silent)
T114=$(br create "Implement promotion modal: 5 PromotionReason radio buttons + note" -t task -p P1 -l "phase-3,ui" --parent "$E24" --silent)
T115=$(br create "Wire promotion flow: ExplorationCard -> modal -> store action -> badge" -t task -p P1 -l "phase-3,ui" --parent "$E24" --silent)
T116=$(br create "Write promotion tests: guard enforcement, promote/unpromote round-trip" -t task -p P1 -l "phase-3,testing" --parent "$E24" --silent)

# --- Epic 25: Lane Plan Generation ---
echo "  Epic 25: Lane Plan Generation"
E25=$(br create "Lane Plan Generation" -t epic -p P1 -l "phase-3,generation" -d "Prompt builder, generation action, PlanPanel, PlanCard, EvidenceRef, FSM wiring" --silent)
T117=$(br create "Implement buildLanePlanPrompt: promoted nodes + persona + topic" -t task -p P1 -l "phase-3,generation" --parent "$E25" --silent)
T118=$(br create "Implement lane plan generation action: collect promotions -> generate -> store" -t task -p P1 -l "phase-3,store" --parent "$E25" --silent)
T119=$(br create "Implement PlanPanel component: lane plan + unified plan viewer" -t task -p P1 -l "phase-3,ui" --parent "$E25" --silent)
T120=$(br create "Implement PlanCard component: structured plan sections display" -t task -p P1 -l "phase-3,ui" --parent "$E25" --silent)
T121=$(br create "Implement EvidenceRef display: clickable citations to source nodes" -t task -p P1 -l "phase-3,ui" --parent "$E25" --silent)
T122=$(br create "Wire session FSM: LANE_PLAN_CREATED -> lane_planning/synthesis_ready" -t task -p P1 -l "phase-3,fsm" --parent "$E25" --silent)
T123=$(br create "Write lane plan tests: generation, evidence binding, FSM transitions" -t task -p P1 -l "phase-3,testing" --parent "$E25" --silent)

echo ""
echo "--- Phase 4: Unified Synthesis ---"

# --- Epic 26: Map-Reduce Synthesis ---
echo "  Epic 26: Map-Reduce Synthesis"
E26=$(br create "Map-Reduce Synthesis" -t epic -p P2 -l "phase-4,generation" -d "Pairwise map, reduce, format phases with prompts, orchestrator, guard" --silent)
T124=$(br create "Implement map phase prompt: pairwise conflict/synergy/gap extraction" -t task -p P2 -l "phase-4,generation" --parent "$E26" --silent)
T125=$(br create "Implement map phase execution: C(4,2)=6 parallel pairwise comparisons" -t task -p P2 -l "phase-4,generation" --parent "$E26" --silent)
T126=$(br create "Implement reduce phase prompt: conflict resolution with trade-offs" -t task -p P2 -l "phase-4,generation" --parent "$E26" --silent)
T127=$(br create "Implement reduce phase execution: aggregate pairwise reports -> resolutions" -t task -p P2 -l "phase-4,generation" --parent "$E26" --silent)
T128=$(br create "Implement format phase prompt: unified plan with EvidenceRef citations" -t task -p P2 -l "phase-4,generation" --parent "$E26" --silent)
T129=$(br create "Implement format phase execution: generate + validate UnifiedPlanSchema" -t task -p P2 -l "phase-4,generation" --parent "$E26" --silent)
T130=$(br create "Implement synthesis orchestrator: map -> reduce -> format pipeline" -t task -p P2 -l "phase-4,generation" --parent "$E26" --silent)
T131=$(br create "Implement synthesis quality guard: evidence chain validation" -t task -p P2 -l "phase-4,validation" --parent "$E26" --silent)
T165=$(br create "Implement unified plan store action: trigger synthesis orchestrator, store UnifiedPlan, fire session FSM events" -t task -p P2 -l "phase-4,store" --parent "$E26" --silent)
T166=$(br create "Wire session FSM synthesis transitions: SYNTHESIS_TRIGGERED -> synthesizing, SYNTHESIS_COMPLETED -> synthesized" -t task -p P2 -l "phase-4,fsm" --parent "$E26" --silent)

# --- Epic 27: Evidence Trail UI ---
echo "  Epic 27: Evidence Trail UI"
E27=$(br create "Evidence Trail UI" -t epic -p P2 -l "phase-4,ui" -d "EvidenceTrail component, canvas navigation, stale badges, plan invalidation" --silent)
T132=$(br create "Implement EvidenceTrail component: clickable provenance breadcrumbs" -t task -p P2 -l "phase-4,ui" --parent "$E27" --silent)
T133=$(br create "Implement canvas navigation: click citation -> pan to source node" -t task -p P2 -l "phase-4,ui" --parent "$E27" --silent)
T134=$(br create "Implement stale badges on lane plans and unified plan" -t task -p P2 -l "phase-4,ui" --parent "$E27" --silent)
T135=$(br create "Implement plan invalidation: stale evidence -> recalculate prompt" -t task -p P2 -l "phase-4,ui" --parent "$E27" --silent)

# --- Epic 28: Phase 4 Tests ---
echo "  Epic 28: Phase 4 Tests"
E28=$(br create "Phase 4 Tests" -t epic -p P2 -l "phase-4,testing" -d "Map, reduce, evidence chain, full-flow integration tests" --silent)
T136=$(br create "Write map phase tests: pairwise extraction validation" -t task -p P2 -l "phase-4,testing" --parent "$E28" --silent)
T137=$(br create "Write reduce phase tests: conflict resolution completeness" -t task -p P2 -l "phase-4,testing" --parent "$E28" --silent)
T138=$(br create "Write evidence chain tests: unified -> lane plan -> promoted node integrity" -t task -p P2 -l "phase-4,testing" --parent "$E28" --silent)
T139=$(br create "Write full-flow integration test: topic -> 4 lanes -> synthesis -> verify" -t task -p P2 -l "phase-4,testing" --parent "$E28" --silent)

echo ""
echo "--- Phase 5: Polish & Future ---"

# --- Epic 29: Workspace Management ---
echo "  Epic 29: Workspace Management"
E29=$(br create "Workspace Management" -t epic -p P2 -l "phase-5,ui" -d "Session list, create, switch, delete" --silent)
T140=$(br create "Implement session list view with completion status cards" -t task -p P2 -l "phase-5,ui" --parent "$E29" --silent)
T141=$(br create "Implement create new session: navigate to topic input" -t task -p P2 -l "phase-5,ui" --parent "$E29" --silent)
T142=$(br create "Implement switch between sessions: save current, load selected" -t task -p P2 -l "phase-5,ui" --parent "$E29" --silent)
T143=$(br create "Implement delete session: remove from IDB with confirmation" -t task -p P2 -l "phase-5,ui" --parent "$E29" --silent)

# --- Epic 30: Export System ---
echo "  Epic 30: Export System"
E30=$(br create "Export System" -t epic -p P3 -l "phase-5,export" -d "Markdown unified, JSON full, per-lane MD, JSON import" --silent)
T144=$(br create "Implement Markdown unified plan export with headers and bullets" -t task -p P3 -l "phase-5,export" --parent "$E30" --silent)
T145=$(br create "Implement JSON full session export for backup" -t task -p P3 -l "phase-5,export" --parent "$E30" --silent)
T146=$(br create "Implement per-lane Markdown export" -t task -p P3 -l "phase-5,export" --parent "$E30" --silent)
T147=$(br create "Implement JSON session import with Zod validation" -t task -p P3 -l "phase-5,export" --parent "$E30" --silent)

# --- Epic 31: Settings Panel ---
echo "  Epic 31: Settings Panel"
E31=$(br create "Settings Panel" -t epic -p P3 -l "phase-5,ui" -d "Settings component, API key management, theme toggle, challenge depth" --silent)
T148=$(br create "Implement Settings component shell with tabbed sections" -t task -p P3 -l "phase-5,ui" --parent "$E31" --silent)
T149=$(br create "Implement API key management: validate format, test call, store in IDB" -t task -p P3 -l "phase-5,ui" --parent "$E31" --silent)
T150=$(br create "Implement theme toggle: light/dark with CSS custom properties" -t task -p P3 -l "phase-5,ui" --parent "$E31" --silent)
T151=$(br create "Implement default challenge depth selector" -t task -p P3 -l "phase-5,ui" --parent "$E31" --silent)
T167=$(br create "Implement animation toggle with prefers-reduced-motion media query support" -t task -p P3 -l "phase-5,ui" --parent "$E31" --silent)

# --- Epic 32: Error Handling ---
echo "  Epic 32: Error Handling"
E32=$(br create "Error Handling" -t epic -p P3 -l "phase-5,error-handling" -d "Timeouts, IDB quota, offline mode, multi-tab, cycle detection, demo mode" --silent)
T152=$(br create "Implement API timeout handling: 30s non-streaming, 10s inactivity, 60s ceiling" -t task -p P3 -l "phase-5,error-handling" --parent "$E32" --silent)
T153=$(br create "Implement IDB quota management: estimate, warn at 50MB, block on exceeded" -t task -p P3 -l "phase-5,error-handling" --parent "$E32" --silent)
T154=$(br create "Implement offline mode: detect, pause jobs, resume on reconnect" -t task -p P3 -l "phase-5,error-handling" --parent "$E32" --silent)
T155=$(br create "Implement multi-tab conflict detection with localStorage heartbeat" -t task -p P3 -l "phase-5,error-handling" --parent "$E32" --silent)
T156=$(br create "Implement cycle detection: visited-set guards in traversal + staleness" -t task -p P3 -l "phase-5,error-handling" --parent "$E32" --silent)
T157=$(br create "Implement demo mode: mock provider fallback when no API key configured" -t task -p P3 -l "phase-5,error-handling" --parent "$E32" --silent)

# --- Epic 33: Performance ---
echo "  Epic 33: Performance"
E33=$(br create "Performance Optimization" -t epic -p P4 -l "phase-5,performance" -d "Adjacency caching, collapse/expand, depth limit, dialogue cap, memoization" --silent)
T158=$(br create "Implement adjacency index caching in semantic store" -t task -p P4 -l "phase-5,performance" --parent "$E33" --silent)
T159=$(br create "Implement collapse/expand: hide descendants, show +N badge" -t task -p P4 -l "phase-5,performance" --parent "$E33" --silent)
T160=$(br create "Implement soft depth limit: replace Branch with Promote at depth 15" -t task -p P4 -l "phase-5,performance" --parent "$E33" --silent)
T161=$(br create "Implement dialogue turn cap: max 20 turns with conclude prompt" -t task -p P4 -l "phase-5,performance" --parent "$E33" --silent)
T162=$(br create "Implement useMemo/useCallback memoization for React Flow nodes" -t task -p P4 -l "phase-5,performance" --parent "$E33" --silent)

echo ""
TOTAL=$(br count 2>/dev/null)
echo "=== Pass 1 complete: $TOTAL beads created ==="

########################################
# PASS 2: EXPORT -> PATCH DEPS -> REIMPORT
########################################

echo ""
echo "Exporting to JSONL..."
# With auto-flush on creates, JSONL is already up-to-date.
# Just ensure it's flushed:
br sync --flush-only 2>/dev/null || echo "  (sync skipped, JSONL from auto-flush is fine)"

echo "Patching dependencies into JSONL..."

# Write dep list as a temp file for Python to consume
cat > /tmp/fuda_deps.txt << 'DEPEOF'
T002 T001
T003 T001
T004 T001
T005 T004
T006 T001
T007 T001
T008 T007
T010 T009
T011 T009
T012 T009
T013 T009
T014 T009
T015 T009
T016 T009
T017 T016
T018 T009
T019 T009
T020 T009
T020 T010
T020 T011
T020 T012
T020 T013
T020 T014
T020 T015
T020 T016
T020 T017
T020 T018
T020 T019
T028 T027
T029 T027
T031 T030
T032 T030
T036 T033
T036 T034
T036 T035
T039 T038
T041 T040
T042 T040
T043 T041
T057 T053
T057 T054
T059 T058
T060 T058
T061 T059
T061 T060
T062 T061
T062 T067
T062 T037
T063 T068
T064 T063
T065 T063
T066 T063
T067 T064
T067 T065
T067 T066
T069 T068
T071 T070
T072 T070
T073 T070
T075 T074
T076 T074
T078 T077
T080 T079
T081 T079
T082 T081
T083 T081
T083 T064
T084 T079
T084 T055
T085 T081
T086 T081
T087 T081
T096 T095
T097 T095
T098 T095
T099 T095
T100 T097
T101 T098
T103 T102
T104 T102
T104 T099
T105 T102
T106 T102
T107 T102
T109 T108
T110 T109
T111 T108
T111 T068
T113 T112
T114 T112
T114 T113
T115 T114
T116 T115
T118 T117
T120 T119
T121 T120
T122 T118
T123 T122
T125 T124
T126 T124
T127 T125
T127 T126
T128 T127
T129 T128
T130 T125
T130 T127
T130 T129
T131 T130
T133 T132
T134 T132
T135 T134
T141 T140
T142 T140
T143 T140
T147 T145
T149 T148
T150 T148
T151 T148
T009 T007
T021 T007
T022 T007
T023 T007
T024 T020
T025 T020
T026 T020
T027 T020
T030 T029
T030 T028
T030 T022
T033 T020
T034 T020
T035 T020
T037 T020
T038 T027
T040 T020
T044 T024
T045 T025
T046 T026
T047 T032
T047 T031
T048 T029
T048 T028
T049 T039
T050 T036
T050 T037
T051 T043
T052 T020
T053 T020
T053 T024
T053 T025
T054 T020
T055 T020
T056 T020
T056 T026
T058 T020
T062 T032
T062 T031
T063 T020
T068 T020
T070 T062
T071 T054
T074 T062
T077 T043
T077 T053
T078 T077
T079 T055
T081 T057
T086 T071
T088 T053
T088 T062
T088 T036
T088 T037
T089 T053
T089 T055
T090 T062
T091 T067
T092 T057
T093 T087
T093 T082
T093 T083
T094 T088
T094 T089
T095 T067
T095 T032
T098 T088
T101 T088
T102 T095
T102 T081
T106 T101
T107 T082
T108 T055
T108 T053
T109 T079
T110 T081
T111 T088
T112 T088
T112 T025
T113 T082
T117 T067
T117 T112
T118 T062
T119 T081
T122 T024
T124 T122
T124 T118
T130 T062
T132 T131
T132 T121
T134 T039
T136 T131
T137 T131
T138 T135
T139 T136
T139 T137
T139 T138
T140 T043
T140 T053
T144 T131
T145 T043
T146 T122
T148 T079
T149 T043
T152 T060
T153 T043
T154 T062
T155 T043
T156 T029
T157 T059
T158 T029
T158 T053
T159 T054
T160 T082
T161 T102
T162 T081
T102 T086
T163 T102
T163 T103
T163 T104
T164 T109
T165 T130
T165 T053
T165 T024
T166 T024
T166 T130
T167 T023
T167 T148
DEPEOF

# Write ID mapping file
cat > /tmp/fuda_idmap.txt << MAPEOF
T001=$T001
T002=$T002
T003=$T003
T004=$T004
T005=$T005
T006=$T006
T007=$T007
T008=$T008
T009=$T009
T010=$T010
T011=$T011
T012=$T012
T013=$T013
T014=$T014
T015=$T015
T016=$T016
T017=$T017
T018=$T018
T019=$T019
T020=$T020
T021=$T021
T022=$T022
T023=$T023
T024=$T024
T025=$T025
T026=$T026
T027=$T027
T028=$T028
T029=$T029
T030=$T030
T031=$T031
T032=$T032
T033=$T033
T034=$T034
T035=$T035
T036=$T036
T037=$T037
T038=$T038
T039=$T039
T040=$T040
T041=$T041
T042=$T042
T043=$T043
T044=$T044
T045=$T045
T046=$T046
T047=$T047
T048=$T048
T049=$T049
T050=$T050
T051=$T051
T052=$T052
T053=$T053
T054=$T054
T055=$T055
T056=$T056
T057=$T057
T058=$T058
T059=$T059
T060=$T060
T061=$T061
T062=$T062
T063=$T063
T064=$T064
T065=$T065
T066=$T066
T067=$T067
T068=$T068
T069=$T069
T070=$T070
T071=$T071
T072=$T072
T073=$T073
T074=$T074
T075=$T075
T076=$T076
T077=$T077
T078=$T078
T079=$T079
T080=$T080
T081=$T081
T082=$T082
T083=$T083
T084=$T084
T085=$T085
T086=$T086
T087=$T087
T088=$T088
T089=$T089
T090=$T090
T091=$T091
T092=$T092
T093=$T093
T094=$T094
T095=$T095
T096=$T096
T097=$T097
T098=$T098
T099=$T099
T100=$T100
T101=$T101
T102=$T102
T103=$T103
T104=$T104
T105=$T105
T106=$T106
T107=$T107
T108=$T108
T109=$T109
T110=$T110
T111=$T111
T112=$T112
T113=$T113
T114=$T114
T115=$T115
T116=$T116
T117=$T117
T118=$T118
T119=$T119
T120=$T120
T121=$T121
T122=$T122
T123=$T123
T124=$T124
T125=$T125
T126=$T126
T127=$T127
T128=$T128
T129=$T129
T130=$T130
T131=$T131
T132=$T132
T133=$T133
T134=$T134
T135=$T135
T136=$T136
T137=$T137
T138=$T138
T139=$T139
T140=$T140
T141=$T141
T142=$T142
T143=$T143
T144=$T144
T145=$T145
T146=$T146
T147=$T147
T148=$T148
T149=$T149
T150=$T150
T151=$T151
T152=$T152
T153=$T153
T154=$T154
T155=$T155
T156=$T156
T157=$T157
T158=$T158
T159=$T159
T160=$T160
T161=$T161
T162=$T162
T163=$T163
T164=$T164
T165=$T165
T166=$T166
T167=$T167
MAPEOF

python3 << 'PYEOF'
import json
from collections import defaultdict
from datetime import datetime

# Load ID mapping (T### -> br issue ID)
idmap = {}
with open('/tmp/fuda_idmap.txt') as f:
    for line in f:
        line = line.strip()
        if '=' in line:
            key, val = line.split('=', 1)
            idmap[key] = val

# Load dep list (ISSUE DEPENDS_ON)
deps = defaultdict(list)
with open('/tmp/fuda_deps.txt') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) == 2:
            issue_key, depends_on_key = parts
            issue_id = idmap.get(issue_key)
            depends_on_id = idmap.get(depends_on_key)
            if issue_id and depends_on_id:
                deps[issue_id].append(depends_on_id)

# Load JSONL
issues = []
with open('.beads/issues.jsonl') as f:
    for line in f:
        line = line.strip()
        if line:
            issues.append(json.loads(line))

# Patch dependencies
ts = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000000000Z')
patched = 0
for issue in issues:
    iid = issue['id']
    if iid in deps:
        existing = issue.get('dependencies', [])
        existing_set = {d['depends_on_id'] for d in existing}
        for dep_id in deps[iid]:
            if dep_id not in existing_set:
                existing.append({
                    'issue_id': iid,
                    'depends_on_id': dep_id,
                    'type': 'blocks',
                    'created_at': ts,
                    'created_by': 'ubuntu'
                })
                patched += 1
        if existing:
            issue['dependencies'] = existing

# Write back
with open('.beads/issues.jsonl', 'w') as f:
    for issue in issues:
        f.write(json.dumps(issue, separators=(',', ':')) + '\n')

print(f"  Patched {patched} dependencies across {len(deps)} issues")
PYEOF

echo "Rebuilding database from patched JSONL..."
rm -f .beads/beads.db .beads/beads.db-shm .beads/beads.db-wal
br init --force --no-auto-flush 2>/dev/null
br sync --import-only --no-auto-flush 2>&1 | grep -E 'Processed|Rebuilt|Error'

# Final export to ensure JSONL is in canonical form
echo "Final sync..."
br sync --flush-only 2>&1 | grep -v "^20" || true

########################################
# VERIFICATION
########################################
echo ""
echo "=== Verification ==="
echo "Total beads: $(br count 2>/dev/null)"
echo ""
echo "Ready tasks (should be Phase 0 foundation only):"
br ready --limit 10 2>/dev/null || true
echo ""
echo "Stats:"
br stats 2>/dev/null || true
echo ""
echo "=== Done! ==="
