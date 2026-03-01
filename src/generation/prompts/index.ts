import type { JobType, CompiledContext, PlanningSession } from '../../core/types';
import { getPersonaPreamble, PLANNER_PREAMBLE } from './system-preambles';
import { buildPathQuestionsPrompt } from './path-questions';
import { buildAnswerPrompt } from './answer';
import { buildBranchPrompt } from './branch';

export function buildPrompt(
  jobType: JobType,
  context: CompiledContext,
  _session: PlanningSession
): string {
  // For now, use a default persona. Lane-specific persona will be resolved
  // when the pipeline passes the lane's personaId.
  const preamble = getPersonaPreamble('analytical');

  switch (jobType) {
    case 'path_questions':
      return buildPathQuestionsPrompt(context, preamble);
    case 'answer':
      return buildAnswerPrompt(context, preamble);
    case 'branch':
      return buildBranchPrompt(context, preamble);
    case 'dialogue_turn':
      // Phase 2 - placeholder
      return buildAnswerPrompt(context, preamble);
    case 'lane_plan':
    case 'unified_plan':
      // Phase 3/4 - use planner preamble
      return buildAnswerPrompt(context, PLANNER_PREAMBLE);
  }
}
