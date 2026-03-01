import type { SemanticNode, SemanticEdge } from '../types'

export interface AdjacencyIndex {
  childrenOf: Map<string, string[]>
  parentOf: Map<string, string>
}

export function buildAdjacencyIndex(
  _nodes: SemanticNode[],
  edges: SemanticEdge[],
): AdjacencyIndex {
  const childrenOf = new Map<string, string[]>()
  const parentOf = new Map<string, string>()

  for (const edge of edges) {
    const children = childrenOf.get(edge.sourceNodeId) ?? []
    children.push(edge.targetNodeId)
    childrenOf.set(edge.sourceNodeId, children)
    parentOf.set(edge.targetNodeId, edge.sourceNodeId)
  }

  return { childrenOf, parentOf }
}

export function getAncestorChain(
  targetId: string,
  nodes: Map<string, SemanticNode>,
  index: AdjacencyIndex,
): SemanticNode[] {
  const chain: SemanticNode[] = []
  const visited = new Set<string>()
  let current = targetId
  while (true) {
    const parentId = index.parentOf.get(current)
    if (!parentId) break
    if (visited.has(parentId)) {
      console.warn('Cycle detected in ancestor chain', { targetId, parentId })
      break
    }
    visited.add(parentId)
    const parent = nodes.get(parentId)
    if (!parent) break
    chain.push(parent)
    current = parentId
  }
  return chain
}

export function getSiblings(
  targetId: string,
  nodes: Map<string, SemanticNode>,
  index: AdjacencyIndex,
): SemanticNode[] {
  const parentId = index.parentOf.get(targetId)
  if (!parentId) return []
  const children = index.childrenOf.get(parentId) ?? []
  return children
    .filter((id) => id !== targetId)
    .map((id) => nodes.get(id))
    .filter((n): n is SemanticNode => n !== undefined)
}
