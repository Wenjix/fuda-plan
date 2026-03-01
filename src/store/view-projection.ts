import type { Node, Edge } from '@xyflow/react';
import type { SemanticNode, SemanticEdge, NodeType } from '../core/types';
import type { ViewNodeState } from './view-store';

export type ExplorationCardNode = Node<SemanticNode, 'explorationCard'>;
export type PlanCardNode = Node<SemanticNode, 'planCard'>;
export type RFNode = ExplorationCardNode | PlanCardNode;
export type RFEdge = Edge<Record<string, never>>;

export function getComponentType(nodeType: NodeType): string {
  switch (nodeType) {
    case 'root':
    case 'exploration':
      return 'explorationCard';
    case 'lane_plan':
    case 'unified_plan':
      return 'planCard';
  }
}

export function projectToReactFlow(
  semanticNodes: SemanticNode[],
  semanticEdges: SemanticEdge[],
  viewStates: Map<string, ViewNodeState>,
  activeLaneId: string
): { nodes: RFNode[]; edges: RFEdge[] } {
  const laneNodes = semanticNodes.filter(n => n.laneId === activeLaneId);
  const laneEdges = semanticEdges.filter(e => e.laneId === activeLaneId);

  const nodes: RFNode[] = laneNodes.map(sn => {
    const view = viewStates.get(sn.id);
    return {
      id: sn.id,
      type: getComponentType(sn.nodeType),
      position: view?.position ?? { x: 0, y: 0 },
      data: sn,
    } as RFNode;
  });

  const edges: RFEdge[] = laneEdges.map(se => ({
    id: se.id,
    source: se.sourceNodeId,
    target: se.targetNodeId,
    type: 'fudaConnector',
  }));

  return { nodes, edges };
}
