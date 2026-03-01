import { create } from 'zustand';
import type { SemanticEdge } from '../core/types';

export interface ViewNodeState {
  semanticId: string;
  position: { x: number; y: number };
  isCollapsed: boolean;
  isAnswerVisible: boolean;
  isNew: boolean;
  spawnIndex: number;
}

/**
 * Collect all descendant node IDs from the given node using BFS on edges.
 */
export function getDescendantIds(nodeId: string, edges: SemanticEdge[]): string[] {
  // Build a quick children lookup from edges
  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    const children = childrenOf.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    childrenOf.set(edge.sourceNodeId, children);
  }

  const descendants: string[] = [];
  const queue: string[] = [...(childrenOf.get(nodeId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    descendants.push(current);
    const children = childrenOf.get(current) ?? [];
    for (const child of children) {
      queue.push(child);
    }
  }

  return descendants;
}

interface ViewState {
  viewNodes: Map<string, ViewNodeState>;
  activeNodeId: string | null;
  streamBuffers: Map<string, string>;
  dialoguePanelNodeId: string | null;

  setActiveNode: (id: string | null) => void;
  setViewNode: (id: string, state: ViewNodeState) => void;
  updatePosition: (id: string, position: { x: number; y: number }) => void;
  toggleCollapse: (id: string) => void;
  appendStream: (nodeId: string, chunk: string) => void;
  clearStream: (nodeId: string) => void;
  openDialoguePanel: (nodeId: string) => void;
  closeDialoguePanel: () => void;
  clear: () => void;
}

export const useViewStore = create<ViewState>()((set) => ({
  viewNodes: new Map(),
  activeNodeId: null,
  streamBuffers: new Map(),
  dialoguePanelNodeId: null,

  setActiveNode: (id) => set({ activeNodeId: id }),
  setViewNode: (id, state) => set((s) => {
    const next = new Map(s.viewNodes);
    next.set(id, state);
    return { viewNodes: next };
  }),
  updatePosition: (id, position) => set((s) => {
    const current = s.viewNodes.get(id);
    if (!current) return s;
    const next = new Map(s.viewNodes);
    next.set(id, { ...current, position });
    return { viewNodes: next };
  }),
  toggleCollapse: (id) => set((s) => {
    const current = s.viewNodes.get(id);
    if (!current) return s;
    const next = new Map(s.viewNodes);
    next.set(id, { ...current, isCollapsed: !current.isCollapsed });
    return { viewNodes: next };
  }),
  appendStream: (nodeId, chunk) => set((s) => {
    const next = new Map(s.streamBuffers);
    const current = next.get(nodeId) ?? '';
    next.set(nodeId, current + chunk);
    return { streamBuffers: next };
  }),
  clearStream: (nodeId) => set((s) => {
    const next = new Map(s.streamBuffers);
    next.delete(nodeId);
    return { streamBuffers: next };
  }),
  openDialoguePanel: (nodeId) => set({ dialoguePanelNodeId: nodeId }),
  closeDialoguePanel: () => set({ dialoguePanelNodeId: null }),
  clear: () => set({ viewNodes: new Map(), activeNodeId: null, streamBuffers: new Map(), dialoguePanelNodeId: null }),
}));
