import type {
  JobType,
  SemanticNode,
  SemanticEdge,
  PlanningSession,
  ModelLane,
} from '../core/types';
import { compileContext } from '../core/graph/context-compiler';
import { buildPrompt } from './prompts';
import { getProvider } from './providers';
import { parseAndValidate } from '../core/validation/schema-gates';
import { rateLimiter } from './rate-limiter';

export interface GenerateOptions {
  targetNodeId: string;
  jobType: JobType;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  session: PlanningSession;
  lanes: ModelLane[];
  apiKey: string;
  onChunk?: (delta: string) => void;
}

export interface GenerateResult {
  success: boolean;
  data?: unknown;
  error?: string;
  feedback: string;
}

export async function generate(
  options: GenerateOptions,
): Promise<GenerateResult> {
  // 1. Compile context from graph
  const context = compileContext(
    options.targetNodeId,
    options.nodes,
    options.edges,
  );

  // 2. Resolve persona from active lane
  const activeLane = options.lanes.find(
    (l) => l.id === options.session.activeLaneId,
  );
  const personaId = activeLane?.personaId ?? 'analytical';

  // 3. Build prompt with context + persona
  const prompt = buildPrompt(
    options.jobType,
    context,
    options.session,
    personaId,
  );

  // 4. Acquire rate limiter token before calling provider
  await rateLimiter.acquire();

  // 5. Call provider
  const provider = getProvider(options.apiKey);
  const raw = options.onChunk
    ? await provider.generateStream(prompt, options.onChunk)
    : await provider.generate(prompt);

  // 6. Parse + validate
  return parseAndValidate(options.jobType, raw);
}
