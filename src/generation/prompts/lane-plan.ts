import type { SemanticNode, Promotion, PersonaId } from '../../core/types';
import { getPersonaPreamble, PLANNER_PREAMBLE } from './system-preambles';

export function buildLanePlanPrompt(
  promotedNodes: Array<{ node: SemanticNode; promotion: Promotion }>,
  personaId: PersonaId,
  sessionTopic: string,
): string {
  const sections: string[] = [];

  sections.push('[SYSTEM]');
  sections.push(getPersonaPreamble(personaId));
  sections.push('');
  sections.push('[PLANNING CONTEXT]');
  sections.push(`Session Topic: ${sessionTopic}`);
  sections.push(`Promoted Evidence (${promotedNodes.length} nodes):`);
  sections.push('');

  for (const { node, promotion } of promotedNodes) {
    sections.push(`--- Evidence Node: ${node.id} ---`);
    sections.push(`Question: ${node.question}`);
    if (node.answer) {
      sections.push(`Summary: ${node.answer.summary}`);
      for (const bullet of node.answer.bullets) {
        sections.push(`  - ${bullet}`);
      }
    }
    sections.push(`Promotion Reason: ${promotion.reason}`);
    if (promotion.note) {
      sections.push(`Note: ${promotion.note}`);
    }
    sections.push('');
  }

  sections.push('[TASK]');
  sections.push(`Generate a structured plan based on the promoted evidence above.
Each section must include evidence citations referencing the source nodes by their ID.

Return JSON matching this exact schema:
{
  "goals": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary|supporting"}] }],
  "assumptions": [{ "heading": "...", "content": ["..."], "evidence": [...] }],
  "strategy": [{ "heading": "...", "content": ["..."], "evidence": [...] }],
  "milestones": [{ "heading": "...", "content": ["..."], "evidence": [...] }],
  "risks": [{ "heading": "...", "content": ["..."], "evidence": [...] }],
  "nextActions": [{ "heading": "...", "content": ["..."], "evidence": [...] }]
}

Ensure JSON is valid. Every section must have at least one evidence citation.`);

  return sections.join('\n');
}

export function buildDirectPlanPrompt(
  promotedNodes: Array<{ node: SemanticNode; promotion: Promotion }>,
  sessionTopic: string,
): string {
  const sections: string[] = [];

  sections.push('[SYSTEM]');
  sections.push(PLANNER_PREAMBLE);
  sections.push('');
  sections.push('[PLANNING CONTEXT]');
  sections.push(`Session Topic: ${sessionTopic}`);
  sections.push(`Promoted Evidence (${promotedNodes.length} nodes from all lanes):`);
  sections.push('');

  for (const { node, promotion } of promotedNodes) {
    sections.push(`--- Evidence Node: ${node.id} ---`);
    sections.push(`Lane: ${promotion.laneId}`);
    sections.push(`Question: ${node.question}`);
    if (node.answer) {
      sections.push(`Summary: ${node.answer.summary}`);
      for (const bullet of node.answer.bullets) {
        sections.push(`  - ${bullet}`);
      }
    }
    sections.push(`Promotion Reason: ${promotion.reason}`);
    if (promotion.note) {
      sections.push(`Note: ${promotion.note}`);
    }
    sections.push('');
  }

  sections.push('[TASK]');
  sections.push(`Generate a unified structured plan based on ALL the promoted evidence above.
This evidence comes from multiple exploration lanes — synthesize insights across all of them.
Each section must include evidence citations referencing the source nodes by their ID.

Return JSON matching this exact schema:
{
  "goals": [{ "heading": "...", "content": ["..."], "evidence": [{"nodeId": "...", "laneId": "...", "quote": "...", "relevance": "primary|supporting"}] }],
  "assumptions": [{ "heading": "...", "content": ["..."], "evidence": [...] }],
  "strategy": [{ "heading": "...", "content": ["..."], "evidence": [...] }],
  "milestones": [{ "heading": "...", "content": ["..."], "evidence": [...] }],
  "risks": [{ "heading": "...", "content": ["..."], "evidence": [...] }],
  "nextActions": [{ "heading": "...", "content": ["..."], "evidence": [...] }]
}

Ensure JSON is valid. Every section must have at least one evidence citation.`);

  return sections.join('\n');
}
