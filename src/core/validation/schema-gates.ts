import { z } from 'zod'
import type { JobType } from '../types/job'
import { AnswerSchema } from '../types/node'
import { StructuredPlanSchema } from '../types/plan'
import { PathTypeSchema } from '../types/primitives'

// LLM response schemas per job type (shapes the LLM is expected to return)

const BranchResponseSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().min(1),
      pathType: PathTypeSchema,
    }),
  ).min(1).max(6),
})

const DialogueTurnResponseSchema = z.object({
  content: z.string().min(1),
  turnType: z.enum(['challenge', 'pushback', 'reframe', 'probe', 'concede', 'synthesize']),
  suggestedResponses: z.array(
    z.object({
      text: z.string().min(1),
      intent: z.enum(['defend', 'concede', 'redirect', 'deepen', 'conclude']),
    }),
  ).max(3).optional(),
})

const PathQuestionsResponseSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().min(1),
      pathType: PathTypeSchema,
    }),
  ).min(1).max(6),
})

const jobTypeSchemas: Record<JobType, z.ZodTypeAny> = {
  answer: AnswerSchema,
  branch: BranchResponseSchema,
  dialogue_turn: DialogueTurnResponseSchema,
  lane_plan: StructuredPlanSchema,
  unified_plan: StructuredPlanSchema,
  path_questions: PathQuestionsResponseSchema,
}

export interface SchemaGateResult {
  success: boolean
  data?: unknown
  error?: string
  feedback: string
}

export function validateOutput(jobType: JobType, parsed: unknown): SchemaGateResult {
  const schema = jobTypeSchemas[jobType]
  if (!schema) {
    return {
      success: false,
      error: `Unknown job type: ${jobType}`,
      feedback: `Internal error: no schema for job type "${jobType}".`,
    }
  }

  const result = schema.safeParse(parsed)
  if (result.success) {
    return { success: true, data: result.data, feedback: '' }
  }

  const issues = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ')

  return {
    success: false,
    error: issues,
    feedback: `Your response did not match the expected schema. Issues: ${issues}. Ensure your JSON response is complete and valid.`,
  }
}

export function parseJSON(raw: string): { success: boolean; data?: unknown; error?: string } {
  try {
    const data = JSON.parse(raw)
    return { success: true, data }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Invalid JSON',
    }
  }
}

export function parseAndValidate(
  jobType: JobType,
  raw: string,
): SchemaGateResult {
  const jsonResult = parseJSON(raw)
  if (!jsonResult.success) {
    return {
      success: false,
      error: jsonResult.error,
      feedback: 'Your response was not valid JSON. Ensure your JSON response is complete and valid.',
    }
  }
  return validateOutput(jobType, jsonResult.data)
}
