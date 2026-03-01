import { useSessionStore } from './session-store';
import { useSemanticStore } from './semantic-store';
import { usePlanTalkStore } from './plan-talk-store';
import { loadSettings } from '../persistence/settings-store';
import { getProvider } from '../generation/providers';
import { buildPlanReflectionPrompt } from '../generation/prompts/plan-reflection';
import { PlanReflectionResponseSchema } from '../core/types';
import type { PlanTalkTurn, PlanSectionKey, StructuredPlan, PlanSection, UnifiedPlan } from '../core/types';
import { generateId } from '../utils/ids';

/**
 * Send user reflection text to AI for analysis against the unified plan.
 */
export async function analyzeReflection(transcriptText: string): Promise<void> {
  const store = usePlanTalkStore.getState();
  const session = useSessionStore.getState().session;
  const unifiedPlan = useSemanticStore.getState().unifiedPlan;

  if (!session) throw new Error('No active session');
  if (!unifiedPlan) throw new Error('No unified plan to reflect on');

  // Add user turn
  const userTurn: PlanTalkTurn = {
    id: generateId(),
    sessionId: session.id,
    unifiedPlanId: unifiedPlan.id,
    turnIndex: store.turns.length,
    speaker: 'user',
    transcriptText,
    source: 'typed',
    createdAt: new Date().toISOString(),
  };
  store.addTurn(userTurn);
  store.setTurnState('analyzing');
  store.setError(null);

  try {
    const settings = await loadSettings();
    const provider = getProvider(settings.geminiApiKey ?? '');

    const allTurns = [...store.turns, userTurn];
    const prompt = buildPlanReflectionPrompt(allTurns, unifiedPlan, session.topic);
    const raw = await provider.generate(prompt);

    // Parse JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    const parsed = JSON.parse(jsonMatch[0]);
    const result = PlanReflectionResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.error.message}`);
    }

    const data = result.data;

    // Add AI turn
    const aiTurn: PlanTalkTurn = {
      id: generateId(),
      sessionId: session.id,
      unifiedPlanId: unifiedPlan.id,
      turnIndex: store.turns.length + 1,
      speaker: 'ai',
      transcriptText: data.understanding,
      source: 'typed',
      createdAt: new Date().toISOString(),
    };

    store.addTurn(aiTurn);
    store.setUnderstanding(data.understanding);
    store.setGapCards(data.gapCards);
    store.setPendingEdits(data.proposedEdits);
    store.setUnresolvedQuestions(data.unresolvedQuestions);
    store.setTurnState('responded');
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Analysis failed');
    store.setTurnState('error');
  }
}

/**
 * Apply a single approved edit to the unified plan.
 */
export function applyEdit(editId: string): void {
  const store = usePlanTalkStore.getState();
  const semanticStore = useSemanticStore.getState();
  const plan = semanticStore.unifiedPlan;

  if (!plan) throw new Error('No unified plan');

  const edit = store.pendingEdits.find((e) => e.id === editId);
  if (!edit) throw new Error(`Edit ${editId} not found`);

  const updated = applyMutation(plan, edit.sectionKey, edit.operation, edit);
  semanticStore.setUnifiedPlan(updated);
}

/**
 * Apply all accepted (approved) edits.
 */
export function applyAllAccepted(): void {
  const store = usePlanTalkStore.getState();
  const semanticStore = useSemanticStore.getState();
  let plan = semanticStore.unifiedPlan;

  if (!plan) throw new Error('No unified plan');

  const accepted = store.pendingEdits.filter((e) => e.approved);
  if (accepted.length === 0) return;

  for (const edit of accepted) {
    plan = applyMutation(plan, edit.sectionKey, edit.operation, edit);
  }

  semanticStore.setUnifiedPlan(plan);
}

// --- Internal helpers ---

function applyMutation(
  plan: UnifiedPlan,
  sectionKey: PlanSectionKey,
  operation: string,
  edit: { targetHeading?: string; draftHeading?: string; draftContent?: string[] },
): UnifiedPlan {
  const sections = structuredClone(plan.sections) as StructuredPlan;
  const sectionArray: PlanSection[] = sections[sectionKey];

  switch (operation) {
    case 'add_section': {
      sectionArray.push({
        heading: edit.draftHeading ?? 'New Section',
        content: edit.draftContent ?? ['(content pending)'],
        evidence: plan.evidence.length > 0 ? [plan.evidence[0]] : [],
      });
      break;
    }
    case 'update_section': {
      const idx = sectionArray.findIndex((s) => s.heading === edit.targetHeading);
      if (idx >= 0) {
        if (edit.draftHeading) sectionArray[idx].heading = edit.draftHeading;
        if (edit.draftContent) sectionArray[idx].content = edit.draftContent;
      }
      break;
    }
    case 'remove_section': {
      const removeIdx = sectionArray.findIndex((s) => s.heading === edit.targetHeading);
      if (removeIdx >= 0 && sectionArray.length > 1) {
        sectionArray.splice(removeIdx, 1);
      }
      break;
    }
    case 'update_content_bullet': {
      const bulletIdx = sectionArray.findIndex((s) => s.heading === edit.targetHeading);
      if (bulletIdx >= 0 && edit.draftContent) {
        sectionArray[bulletIdx].content = edit.draftContent;
      }
      break;
    }
  }

  return {
    ...plan,
    sections,
    revision: (plan.revision ?? 1) + 1,
    updatedAt: new Date().toISOString(),
  };
}
