import { ReactFlow, Background, Controls, applyNodeChanges } from '@xyflow/react';
import type { Node, OnNodesChange, OnEdgesChange, ReactFlowInstance, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSemanticStore } from '../../store/semantic-store';
import { useViewStore } from '../../store/view-store';
import { useRadialMenuStore } from '../../store/radial-menu-store';
import { projectToReactFlow } from '../../store/view-projection';
import { nodeTypes, edgeTypes } from './shared-types';
import { useMemo, useCallback, useEffect, useRef, useState } from 'react';

interface LaneCanvasProps {
  laneId: string;
  /** Whether to show React Flow controls (hidden in compact panes) */
  showControls?: boolean;
  /** Min zoom level (lower in quadrant panes for overview) */
  minZoom?: number;
  /** Callback when a node is right-clicked for radial menu */
  onNodeContextMenu?: (nodeId: string, fsmState: string, x: number, y: number) => void;
}

export function LaneCanvas({
  laneId,
  showControls = true,
  minZoom = 0.5,
  onNodeContextMenu: onNodeContextMenuProp,
}: LaneCanvasProps) {
  const semanticNodes = useSemanticStore(s => s.nodes);
  const semanticEdges = useSemanticStore(s => s.edges);
  const viewStates = useViewStore(s => s.viewNodes);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const { nodes, edges } = useMemo(
    () => projectToReactFlow(semanticNodes, semanticEdges, viewStates, laneId),
    [semanticNodes, semanticEdges, viewStates, laneId]
  );

  const [rfNodes, setRfNodes] = useState<Node[]>([]);

  useEffect(() => {
    setRfNodes(nodes);
  }, [nodes]);

  const onNodesChange = useCallback<OnNodesChange>((changes) => {
    setRfNodes(prev => applyNodeChanges(changes, prev));
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        useViewStore.getState().updatePosition(change.id, change.position);
      }
    }
  }, []);

  const onEdgesChange = useCallback<OnEdgesChange>(() => {}, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
    setTimeout(() => instance.fitView({ padding: 0.2 }), 50);
  }, []);

  const onNodeContextMenu = useCallback<NodeMouseHandler>((event, node) => {
    if (node.type !== 'explorationCard') return;
    event.preventDefault();
    const semanticNode = useSemanticStore.getState().getNode(node.id);
    if (!semanticNode) return;
    if (onNodeContextMenuProp) {
      onNodeContextMenuProp(node.id, semanticNode.fsmState, event.clientX, event.clientY);
    } else {
      useRadialMenuStore.getState().open(
        node.id,
        semanticNode.fsmState,
        event.clientX,
        event.clientY,
      );
    }
  }, [onNodeContextMenuProp]);

  // Re-layout when lane has all nodes at origin
  const prevLaneRef = useRef(laneId);
  useEffect(() => {
    if (prevLaneRef.current === laneId && prevLaneRef.current !== undefined) return;
    prevLaneRef.current = laneId;

    const currentViewStates = useViewStore.getState().viewNodes;
    const laneNodes = semanticNodes.filter(n => n.laneId === laneId);
    const allAtOrigin = laneNodes.length > 1 && laneNodes.every(n => {
      const view = currentViewStates.get(n.id);
      return view && view.position.x === 0 && view.position.y === 0;
    });

    if (allAtOrigin) {
      const laneEdges = semanticEdges.filter(e =>
        laneNodes.some(n => n.id === e.sourceNodeId)
      );
      useViewStore.getState().relayoutTree(laneNodes, laneEdges);
    }

    if (rfInstanceRef.current) {
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.2 }), 100);
    }
  }, [laneId, semanticNodes, semanticEdges]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeContextMenu={onNodeContextMenu}
      onInit={onInit}
      minZoom={minZoom}
      defaultEdgeOptions={{ type: 'fudaConnector' }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="var(--canvas-dot, #1a1a2e)" gap={20} />
      {showControls && <Controls />}
    </ReactFlow>
  );
}
