import type { SemanticNode, SemanticEdge, CompiledContext, ContextEntry } from '../types'
import { buildAdjacencyIndex, getAncestorChain, getSiblings } from './traversal'
import { estimateTokens } from '../../utils/tokens'

const DEFAULT_TOKEN_BUDGET = 4000

function formatNodeContent(node: SemanticNode): string {
  const parts = [node.question]
  if (node.answer) {
    parts.push(node.answer.summary)
    parts.push(...node.answer.bullets)
  }
  return parts.join('\n')
}

export function compileContext(
  targetNodeId: string,
  allNodes: SemanticNode[],
  allEdges: SemanticEdge[],
  tokenBudget: number = DEFAULT_TOKEN_BUDGET,
): CompiledContext {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  const index = buildAdjacencyIndex(allNodes, allEdges)
  const entries: ContextEntry[] = []
  let usedTokens = 0

  // 1. Ancestors (highest priority) — pack nearest first
  const ancestors = getAncestorChain(targetNodeId, nodeMap, index)
  for (let i = 0; i < ancestors.length; i++) {
    const node = ancestors[i]
    const content = formatNodeContent(node)
    const tokens = estimateTokens(content)
    if (usedTokens + tokens > tokenBudget) break
    entries.push({
      nodeId: node.id,
      role: 'ancestor',
      distanceFromTarget: i + 1,
      content,
      tokenEstimate: tokens,
    })
    usedTokens += tokens
  }

  // 2. Siblings (medium priority) — if budget allows
  const siblings = getSiblings(targetNodeId, nodeMap, index)
  for (const sibling of siblings) {
    const content = formatNodeContent(sibling)
    const tokens = estimateTokens(content)
    if (usedTokens + tokens > tokenBudget) break
    entries.push({
      nodeId: sibling.id,
      role: 'sibling',
      distanceFromTarget: 1,
      content,
      tokenEstimate: tokens,
    })
    usedTokens += tokens
  }

  // 3. Cousins (lowest priority) — question-only, if budget remains
  const parentId = index.parentOf.get(targetNodeId)
  if (parentId) {
    const parentSiblingIds = getSiblings(parentId, nodeMap, index).map((s) => s.id)
    for (const psId of parentSiblingIds) {
      const cousinIds = index.childrenOf.get(psId) ?? []
      for (const cousinId of cousinIds) {
        const cousin = nodeMap.get(cousinId)
        if (!cousin) continue
        const content = cousin.question
        const tokens = estimateTokens(content)
        if (usedTokens + tokens > tokenBudget) break
        entries.push({
          nodeId: cousin.id,
          role: 'cousin',
          distanceFromTarget: 2,
          content,
          tokenEstimate: tokens,
        })
        usedTokens += tokens
      }
    }
  }

  // 4. Format into prompt string
  const formatted = formatContextForPrompt(entries, targetNodeId, nodeMap)

  return {
    entries,
    totalTokenEstimate: usedTokens,
    targetNodeId,
    formatted,
  }
}

function formatContextForPrompt(
  entries: ContextEntry[],
  targetNodeId: string,
  nodeMap: Map<string, SemanticNode>,
): string {
  const lines = ['[GRAPH CONTEXT]']

  const ancestors = entries
    .filter((e) => e.role === 'ancestor')
    .sort((a, b) => b.distanceFromTarget - a.distanceFromTarget) // Root first

  for (const entry of ancestors) {
    const label = entry.distanceFromTarget === ancestors.length ? 'Root' : 'Ancestor'
    lines.push(`- ${label} (depth ${entry.distanceFromTarget}): "${entry.content.substring(0, 200)}"`)
  }

  const siblingEntries = entries.filter((e) => e.role === 'sibling')
  for (const entry of siblingEntries) {
    const node = nodeMap.get(entry.nodeId)
    const stateLabel = node?.fsmState === 'resolved' ? 'Explored' : 'Unexplored'
    lines.push(`- Sibling (${stateLabel}): "${entry.content.substring(0, 150)}"`)
  }

  const cousins = entries.filter((e) => e.role === 'cousin')
  if (cousins.length > 0) {
    for (const entry of cousins) {
      lines.push(`- Cousin (question only): "${entry.content.substring(0, 100)}"`)
    }
  }

  const target = nodeMap.get(targetNodeId)
  if (target) {
    lines.push(`- Current Node: "${target.question}"`)
  }

  return lines.join('\n')
}
