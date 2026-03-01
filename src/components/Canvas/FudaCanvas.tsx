import { ReactFlow, Background, Controls } from '@xyflow/react';
import type { NodeTypes, EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSemanticStore } from '../../store/semantic-store';
import { useSessionStore } from '../../store/session-store';
import { useViewStore } from '../../store/view-store';
import { projectToReactFlow } from '../../store/view-projection';
import { ExplorationCard } from '../ExplorationCard/ExplorationCard';
import { Connector } from '../shared/Connector';
import { useMemo } from 'react';

// Register custom node types
const nodeTypes: NodeTypes = {
  explorationCard: ExplorationCard,
  planCard: ExplorationCard, // placeholder until PlanCard exists
};

const edgeTypes: EdgeTypes = {
  fudaConnector: Connector,
};

export function FudaCanvas() {
  const semanticNodes = useSemanticStore(s => s.nodes);
  const semanticEdges = useSemanticStore(s => s.edges);
  const viewStates = useViewStore(s => s.viewNodes);
  const activeLaneId = useSessionStore(s => s.activeLaneId);

  const { nodes, edges } = useMemo(
    () => projectToReactFlow(semanticNodes, semanticEdges, viewStates, activeLaneId ?? ''),
    [semanticNodes, semanticEdges, viewStates, activeLaneId]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'fudaConnector' }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1a2e" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
