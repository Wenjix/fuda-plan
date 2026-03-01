import type { SemanticNode, SemanticEdge } from '../types'
import { buildAdjacencyIndex } from './traversal'

export function propagateStaleness(
  changedNodeId: string,
  nodes: SemanticNode[],
  edges: SemanticEdge[],
): string[] {
  const index = buildAdjacencyIndex(nodes, edges)
  const staleIds: string[] = []
  const visited = new Set<string>()
  const queue = [...(index.childrenOf.get(changedNodeId) ?? [])]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) {
      console.warn('Cycle detected in staleness propagation', { changedNodeId, current })
      continue
    }
    visited.add(current)
    staleIds.push(current)
    const children = index.childrenOf.get(current) ?? []
    queue.push(...children)
  }

  return staleIds
}
