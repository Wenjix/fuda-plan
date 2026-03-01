import type {
  PlanningSession,
  SemanticNode,
  SemanticEdge,
  GenerationJob,
  ModelLane,
  PathType,
  JobType,
} from '../core/types';
import { DEFAULT_LANES } from '../core/types/lane';
import { nodeTransition } from '../core/fsm/node-fsm';
import { generate } from '../generation/pipeline';
import type { GenerateResult } from '../generation/pipeline';
import { generateId } from '../utils/ids';
import { loadSettings } from '../persistence/settings-store';
import { isOnline } from '../utils/online-status';
import { useSemanticStore } from './semantic-store';
import { useSessionStore } from './session-store';
import { useJobStore } from './job-store';
import { useViewStore } from './view-store';
import type { ViewNodeState } from './view-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_BRANCH_DEPTH = 15;

// ---------------------------------------------------------------------------
// Lanes are now stored in the semantic store (useSemanticStore.lanes)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function makeJob(
  sessionId: string,
  targetNodeId: string,
  jobType: JobType,
): GenerationJob {
  return {
    id: generateId(),
    sessionId,
    targetNodeId,
    jobType,
    fsmState: 'queued',
    attempts: 0,
    maxAttempts: 3,
    idempotencyKey: `${targetNodeId}:${jobType}:${Date.now()}`,
    createdAt: now(),
  };
}

// ---------------------------------------------------------------------------
// 1. createSession
// ---------------------------------------------------------------------------

export async function createSession(topic: string): Promise<PlanningSession> {
  if (topic.length < 10) {
    throw new Error('Topic must be at least 10 characters');
  }

  const sessionId = generateId();
  const timestamp = now();

  // Create 4 ModelLane entities from DEFAULT_LANES
  const lanes: ModelLane[] = DEFAULT_LANES.map((def, index) => ({
    id: generateId(),
    sessionId,
    label: def.label,
    personaId: def.personaId,
    colorToken: def.colorToken,
    sortOrder: index,
    isEnabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const activeLaneId = lanes[0].id;

  const session: PlanningSession = {
    id: sessionId,
    topic,
    createdAt: timestamp,
    updatedAt: timestamp,
    challengeDepth: 'balanced',
    activeLaneId,
    status: 'exploring',
    version: 'fuda_v1',
  };

  // Update all stores — clear for fresh start
  useSemanticStore.getState().clear();
  useJobStore.getState().clear();
  useViewStore.getState().clear();

  // Persist lanes in the semantic store (after clear)
  useSemanticStore.getState().setLanes(lanes);

  useSessionStore.getState().setSession(session);
  useSessionStore.getState().setActiveLane(activeLaneId);
  useSessionStore.getState().setUIMode('compass');

  return session;
}

// ---------------------------------------------------------------------------
// 2. explore
// ---------------------------------------------------------------------------

export async function explore(
  session: PlanningSession,
  laneId: string,
  topic: string,
): Promise<void> {
  const timestamp = now();

  const rootNode: SemanticNode = {
    id: generateId(),
    sessionId: session.id,
    laneId,
    parentId: null,
    nodeType: 'root',
    pathType: 'clarify',
    question: topic,
    fsmState: 'idle',
    promoted: false,
    depth: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  useSemanticStore.getState().addNode(rootNode);

  const viewNode: ViewNodeState = {
    semanticId: rootNode.id,
    position: { x: 0, y: 0 },
    isCollapsed: false,
    isAnswerVisible: false,
    isNew: true,
    spawnIndex: 0,
  };
  useViewStore.getState().setViewNode(rootNode.id, viewNode);

  const job = makeJob(session.id, rootNode.id, 'path_questions');

  useSessionStore.getState().setUIMode('exploring');

  // Fire and forget
  void runJob(job, session);
}

// ---------------------------------------------------------------------------
// 2b. exploreAllLanes — create root nodes for all lanes
// ---------------------------------------------------------------------------

export async function exploreAllLanes(
  session: PlanningSession,
  topic: string,
): Promise<void> {
  const lanes = useSemanticStore.getState().lanes;
  if (lanes.length === 0) {
    throw new Error('No lanes available — create a session first');
  }

  const timestamp = now();

  for (const lane of lanes) {
    const rootNode: SemanticNode = {
      id: generateId(),
      sessionId: session.id,
      laneId: lane.id,
      parentId: null,
      nodeType: 'root',
      pathType: 'clarify',
      question: topic,
      fsmState: 'idle',
      promoted: false,
      depth: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    useSemanticStore.getState().addNode(rootNode);

    const viewNode: ViewNodeState = {
      semanticId: rootNode.id,
      position: { x: 0, y: 0 },
      isCollapsed: false,
      isAnswerVisible: false,
      isNew: true,
      spawnIndex: 0,
    };
    useViewStore.getState().setViewNode(rootNode.id, viewNode);

    const job = makeJob(session.id, rootNode.id, 'path_questions');

    // Fire and forget per-lane generation
    void runJob(job, session);
  }

  useSessionStore.getState().setUIMode('exploring');
}

// ---------------------------------------------------------------------------
// 3. answerNode
// ---------------------------------------------------------------------------

export async function answerNode(nodeId: string): Promise<void> {
  const node = useSemanticStore.getState().getNode(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // Guard: node must be able to transition to generating
  const nextState = nodeTransition(node.fsmState, { type: 'GENERATE_REQUESTED' });
  if (!nextState) {
    throw new Error(
      `Cannot start generation on node in state "${node.fsmState}"`,
    );
  }

  // Transition node FSM -> 'generating'
  useSemanticStore.getState().updateNode(nodeId, {
    fsmState: nextState,
    updatedAt: now(),
  });

  const session = useSessionStore.getState().session;
  if (!session) {
    throw new Error('No active session');
  }

  const job = makeJob(session.id, nodeId, 'answer');

  // Fire and forget
  void runJob(job, session);
}

// ---------------------------------------------------------------------------
// 4. branchFromNode
// ---------------------------------------------------------------------------

export async function branchFromNode(
  nodeId: string,
  pathType: PathType,
): Promise<void> {
  const parentNode = useSemanticStore.getState().getNode(nodeId);
  if (!parentNode) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // Guard: parent must be in 'resolved' state
  if (parentNode.fsmState !== 'resolved') {
    throw new Error(
      `Cannot branch from node in state "${parentNode.fsmState}"; must be "resolved"`,
    );
  }

  // Soft depth limit: auto-promote and refuse branching beyond MAX_BRANCH_DEPTH
  if (parentNode.depth >= MAX_BRANCH_DEPTH) {
    // Auto-promote the node instead of branching deeper
    if (!parentNode.promoted) {
      useSemanticStore.getState().updateNode(nodeId, {
        promoted: true,
        updatedAt: now(),
      });
    }
    throw new Error(
      `Depth limit reached (${MAX_BRANCH_DEPTH}). Node has been promoted. Consider promoting insights rather than branching deeper.`,
    );
  }

  const session = useSessionStore.getState().session;
  if (!session) {
    throw new Error('No active session');
  }

  const timestamp = now();

  const childNode: SemanticNode = {
    id: generateId(),
    sessionId: session.id,
    laneId: parentNode.laneId,
    parentId: parentNode.id,
    nodeType: 'exploration',
    pathType,
    question: `Exploring "${pathType}" from: ${parentNode.question}`,
    fsmState: 'idle',
    promoted: false,
    depth: parentNode.depth + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const edge: SemanticEdge = {
    id: generateId(),
    sessionId: session.id,
    laneId: parentNode.laneId,
    sourceNodeId: parentNode.id,
    targetNodeId: childNode.id,
    createdAt: timestamp,
  };

  useSemanticStore.getState().addNode(childNode);
  useSemanticStore.getState().addEdge(edge);

  const viewNode: ViewNodeState = {
    semanticId: childNode.id,
    position: { x: 0, y: 0 },
    isCollapsed: false,
    isAnswerVisible: false,
    isNew: true,
    spawnIndex: 0,
  };
  useViewStore.getState().setViewNode(childNode.id, viewNode);

  const job = makeJob(session.id, childNode.id, 'branch');

  // Fire and forget
  void runJob(job, session);
}

// ---------------------------------------------------------------------------
// 5. runJob (internal)
// ---------------------------------------------------------------------------

export async function runJob(
  job: GenerationJob,
  session: PlanningSession,
): Promise<void> {
  // Only add to store if this is a fresh job (not a retry re-entry)
  const existing = useJobStore.getState().getJob(job.id);
  if (!existing) {
    useJobStore.getState().addJob(job);
  }

  // Transition job: queued -> running
  useJobStore.getState().updateJobState(job.id, { type: 'START' });

  // Gather current graph state for the pipeline
  const { nodes, edges, lanes: sessionLanes } = useSemanticStore.getState();

  // Load API key from persisted settings
  const settings = await loadSettings();
  const apiKey = settings.geminiApiKey;

  try {
    // Check online status before attempting generation
    if (!isOnline()) {
      throw new Error('Device is offline. Generation will resume when reconnected.');
    }

    const result: GenerateResult = await generate({
      targetNodeId: job.targetNodeId,
      jobType: job.jobType,
      nodes,
      edges,
      session,
      lanes: sessionLanes,
      apiKey,
      onChunk: (delta: string) => {
        useViewStore.getState().appendStream(job.targetNodeId, delta);
      },
    });

    if (!result.success) {
      throw new Error(result.feedback || result.error || 'Generation failed');
    }

    // Transition job: running -> succeeded
    useJobStore.getState().updateJobState(job.id, { type: 'SUCCEED' });

    // Transition node FSM -> resolved and attach result data
    const node = useSemanticStore.getState().getNode(job.targetNodeId);
    if (node) {
      const nextNodeState = nodeTransition(node.fsmState, {
        type: 'GENERATION_SUCCEEDED',
      });
      if (nextNodeState) {
        useSemanticStore.getState().updateNode(job.targetNodeId, {
          fsmState: nextNodeState,
          answer: result.data as SemanticNode['answer'],
          updatedAt: now(),
        });
      }
    }

    // Clear the stream buffer now that generation is done
    useViewStore.getState().clearStream(job.targetNodeId);
  } catch (_error) {
    const currentJob = useJobStore.getState().getJob(job.id);
    const canRetry =
      !!currentJob && currentJob.attempts + 1 < currentJob.maxAttempts;

    // Transition job: running -> retrying or failed
    useJobStore.getState().updateJobState(job.id, {
      type: 'FAIL',
      canRetry,
    });

    if (canRetry) {
      // Transition job: retrying -> running (retry)
      useJobStore.getState().updateJobState(job.id, { type: 'RETRY' });

      // Recursive retry — re-enter runJob with updated job state
      const retryJob = useJobStore.getState().getJob(job.id);
      if (retryJob) {
        await runJob({ ...retryJob }, session);
      }
    } else {
      // Transition node FSM -> failed
      const node = useSemanticStore.getState().getNode(job.targetNodeId);
      if (node) {
        const nextNodeState = nodeTransition(node.fsmState, {
          type: 'GENERATION_FAILED',
        });
        if (nextNodeState) {
          useSemanticStore.getState().updateNode(job.targetNodeId, {
            fsmState: nextNodeState,
            updatedAt: now(),
          });
        }
      }

      // Clear the stream buffer on final failure
      useViewStore.getState().clearStream(job.targetNodeId);
    }
  }
}
