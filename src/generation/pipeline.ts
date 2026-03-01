import type {
  JobType,
  SemanticNode,
  SemanticEdge,
  PlanningSession,
} from '../core/types';
import { compileContext } from '../core/graph/context-compiler';
import { buildPrompt } from './prompts';
import { getProvider } from './providers';
import { parseAndValidate } from '../core/validation/schema-gates';

export interface GenerateOptions {
  targetNodeId: string;
  jobType: JobType;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  session: PlanningSession;
  apiKey?: string;
  onChunk?: (delta: string) => void;
}

export async function generate(options: GenerateOptions): Promise<unknown> {
  // 1. Compile context from graph
  const context = compileContext(
    options.targetNodeId,
    options.nodes,
    options.edges,
  );

  // 2. Build prompt with context + persona
  const prompt = buildPrompt(options.jobType, context, options.session);

  // 3. Call provider
  const provider = getProvider(options.apiKey ?? options.session.id);
  const raw = options.onChunk
    ? await provider.generateStream(prompt, options.onChunk)
    : await provider.generate(prompt);

  // 4. Parse + validate
  const result = parseAndValidate(options.jobType, raw);
  if (!result.success) {
    throw new Error(result.feedback);
  }

  return result.data;
}
