import type { JobType, CompiledContext, PlanningSession, PersonaId } from '../../core/types';
import { getPersonaPreamble, PLANNER_PREAMBLE } from './system-preambles';
import { buildPathQuestionsPrompt } from './path-questions';
import { buildAnswerPrompt } from './answer';
import { buildBranchPrompt } from './branch';
import { buildDialoguePrompt, buildConcludeSynthesisPrompt } from './dialogue';

export { buildDialoguePrompt, buildConcludeSynthesisPrompt };

export function buildPrompt(
  jobType: JobType,
  context: CompiledContext,
  session: PlanningSession,
  personaId: PersonaId = 'analytical',
): string {
  const preamble = getPersonaPreamble(personaId);

  switch (jobType) {
    case 'path_questions':
      return buildPathQuestionsPrompt(context, preamble);
    case 'answer':
      return buildAnswerPrompt(context, preamble);
    case 'branch':
      return buildBranchPrompt(context, preamble);
    case 'dialogue_turn':
      // Phase 2: Use dialogue prompt with session defaults.
      // For full dialogue control (mode, history), callers should use
      // buildDialoguePrompt directly.
      return buildDialoguePrompt('socratic', [], context, session.challengeDepth);
    case 'lane_plan':
    case 'unified_plan':
      return buildAnswerPrompt(context, PLANNER_PREAMBLE);
  }
}
