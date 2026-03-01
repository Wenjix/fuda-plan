import { ReactFlow, Background, Controls } from '@xyflow/react';
import type { NodeTypes, EdgeTypes, OnNodesChange, OnEdgesChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSemanticStore } from '../../store/semantic-store';
import { useSessionStore } from '../../store/session-store';
import { useViewStore } from '../../store/view-store';
import { projectToReactFlow } from '../../store/view-projection';
import { ExplorationCard } from '../ExplorationCard/ExplorationCard';
import { PlanCard } from '../PlanCard/PlanCard';
import { Connector } from '../shared/Connector';
import { useMemo, useCallback } from 'react';

export function FudaCanvas() {
  const semanticNodes = useSemanticStore(s => s.nodes);
  const semanticEdges = useSemanticStore(s => s.edges);
  const viewStates = useViewStore(s => s.viewNodes);
  const activeLaneId = useSessionStore(s => s.activeLaneId);

  // Stable references for nodeTypes and edgeTypes to avoid React Flow re-registration
  const nodeTypes: NodeTypes = useMemo(() => ({
    explorationCard: ExplorationCard,
    planCard: PlanCard,
  }), []);

  const edgeTypes: EdgeTypes = useMemo(() => ({
    fudaConnector: Connector,
  }), []);

  // Memoize the projection computation
  const { nodes, edges } = useMemo(
    () => projectToReactFlow(semanticNodes, semanticEdges, viewStates, activeLaneId ?? ''),
    [semanticNodes, semanticEdges, viewStates, activeLaneId]
  );

  // Stable callbacks for React Flow event handlers
  const onNodesChange = useCallback<OnNodesChange>(() => {
    // Node changes handled by our stores, not by React Flow internal state
  }, []);

  const onEdgesChange = useCallback<OnEdgesChange>(() => {
    // Edge changes handled by our stores, not by React Flow internal state
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
