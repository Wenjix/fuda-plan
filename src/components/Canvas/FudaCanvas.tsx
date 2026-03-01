import { ReactFlow, Background, Controls } from '@xyflow/react';
import type { NodeTypes, EdgeTypes, OnNodesChange, OnEdgesChange, ReactFlowInstance, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSemanticStore } from '../../store/semantic-store';
import { useSessionStore } from '../../store/session-store';
import { useViewStore } from '../../store/view-store';
import { useRadialMenuStore } from '../../store/radial-menu-store';
import { projectToReactFlow } from '../../store/view-projection';
import { ExplorationCard } from '../ExplorationCard/ExplorationCard';
import { PlanCard } from '../PlanCard/PlanCard';
import { Connector } from '../shared/Connector';
import { RadialMenu } from '../RadialMenu/RadialMenu';
import { useMemo, useCallback, useEffect, useRef } from 'react';

export function FudaCanvas() {
  const semanticNodes = useSemanticStore(s => s.nodes);
  const semanticEdges = useSemanticStore(s => s.edges);
  const viewStates = useViewStore(s => s.viewNodes);
  const activeLaneId = useSessionStore(s => s.activeLaneId);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

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

  // Persist drag positions to our store
  const onNodesChange = useCallback<OnNodesChange>((changes) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        useViewStore.getState().updatePosition(change.id, change.position);
      }
    }
  }, []);

  const onEdgesChange = useCallback<OnEdgesChange>(() => {
    // Edge changes handled by our stores, not by React Flow internal state
  }, []);

  // fitView on initial render
  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
    setTimeout(() => instance.fitView({ padding: 0.2 }), 50);
  }, []);

  // Right-click context menu for node branching
  const onNodeContextMenu = useCallback<NodeMouseHandler>((event, node) => {
    if (node.type !== 'explorationCard') return;
    event.preventDefault();
    const semanticNode = useSemanticStore.getState().getNode(node.id);
    if (!semanticNode) return;
    useRadialMenuStore.getState().open(
      node.id,
      semanticNode.fsmState,
      event.clientX,
      event.clientY,
    );
  }, []);

  // Re-layout when lane changes and all nodes are at (0,0)
  useEffect(() => {
    if (!activeLaneId) return;

    // Check if all visible nodes are still at default position
    const laneNodes = semanticNodes.filter(n => n.laneId === activeLaneId);
    const allAtOrigin = laneNodes.length > 1 && laneNodes.every(n => {
      const view = viewStates.get(n.id);
      return view && view.position.x === 0 && view.position.y === 0;
    });

    if (allAtOrigin) {
      const laneEdges = semanticEdges.filter(e =>
        laneNodes.some(n => n.id === e.sourceNodeId)
      );
      useViewStore.getState().relayoutTree(laneNodes, laneEdges);
    }

    // Fit view after layout
    if (rfInstanceRef.current) {
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.2 }), 100);
    }
  }, [activeLaneId, semanticNodes, semanticEdges, viewStates]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeContextMenu={onNodeContextMenu}
        onInit={onInit}
        defaultEdgeOptions={{ type: 'fudaConnector' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--canvas-dot, #1a1a2e)" gap={20} />
        <Controls />
      </ReactFlow>
      <RadialMenu />
    </div>
  );
}
