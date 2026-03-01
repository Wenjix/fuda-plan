import { describe, it, expect, vi } from 'vitest'
import { propagateStaleness } from '../../../core/graph/staleness'
import type { SemanticNode, SemanticEdge } from '../../../core/types'

const now = '2026-03-01T00:00:00.000+00:00'
const sessionId = '00000000-0000-4000-a000-000000000000'
const laneId = '00000000-0000-4000-a000-000000000001'

function makeNode(id: string): SemanticNode {
  return {
    id,
    sessionId,
    laneId,
    parentId: null,
    nodeType: 'exploration',
    pathType: 'go-deeper',
    question: `Q ${id}`,
    fsmState: 'resolved',
    promoted: false,
    depth: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function makeEdge(src: string, tgt: string): SemanticEdge {
  return {
    id: `${src}->${tgt}`,
    sessionId,
    laneId,
    sourceNodeId: src,
    targetNodeId: tgt,
    createdAt: now,
  }
}

describe('propagateStaleness', () => {
  // Tree:  A -> B -> D
  //        A -> C -> E
  //                   \-> F
  const nodes = ['A', 'B', 'C', 'D', 'E', 'F'].map(makeNode)
  const edges = [
    makeEdge('A', 'B'),
    makeEdge('A', 'C'),
    makeEdge('B', 'D'),
    makeEdge('C', 'E'),
    makeEdge('C', 'F'),
  ]

  it('marks direct children as stale', () => {
    const stale = propagateStaleness('A', nodes, edges)
    expect(stale).toContain('B')
    expect(stale).toContain('C')
  })

  it('propagates to all descendants (BFS)', () => {
    const stale = propagateStaleness('A', nodes, edges)
    expect(stale).toContain('D')
    expect(stale).toContain('E')
    expect(stale).toContain('F')
    expect(stale.length).toBe(5) // B, C, D, E, F
  })

  it('does not include the changed node itself', () => {
    const stale = propagateStaleness('A', nodes, edges)
    expect(stale).not.toContain('A')
  })

  it('propagates from mid-tree node', () => {
    const stale = propagateStaleness('C', nodes, edges)
    expect(stale).toEqual(['E', 'F'])
  })

  it('returns empty array for leaf node', () => {
    const stale = propagateStaleness('D', nodes, edges)
    expect(stale).toEqual([])
  })

  it('returns empty array for unknown node', () => {
    const stale = propagateStaleness('Z', nodes, edges)
    expect(stale).toEqual([])
  })

  it('handles diamond graph (two paths to same node)', () => {
    // Diamond:  A -> B -> D
    //           A -> C -> D
    const diamondNodes = ['A', 'B', 'C', 'D'].map(makeNode)
    const diamondEdges = [
      makeEdge('A', 'B'),
      makeEdge('A', 'C'),
      makeEdge('B', 'D'),
      makeEdge('C', 'D'),
    ]
    const stale = propagateStaleness('A', diamondNodes, diamondEdges)
    // D should appear only once
    expect(stale.filter((id) => id === 'D').length).toBe(1)
    expect(stale.length).toBe(3) // B, C, D
  })

  it('detects cycles and does not infinite loop', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cyclicNodes = ['X', 'Y', 'Z'].map(makeNode)
    const cyclicEdges = [makeEdge('X', 'Y'), makeEdge('Y', 'Z'), makeEdge('Z', 'Y')]

    const stale = propagateStaleness('X', cyclicNodes, cyclicEdges)
    expect(stale).toContain('Y')
    expect(stale).toContain('Z')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
