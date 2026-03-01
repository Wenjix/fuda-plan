import { create } from 'zustand';

export interface ViewNodeState {
  semanticId: string;
  position: { x: number; y: number };
  isCollapsed: boolean;
  isAnswerVisible: boolean;
  isNew: boolean;
  spawnIndex: number;
}

interface ViewState {
  viewNodes: Map<string, ViewNodeState>;
  activeNodeId: string | null;
  streamBuffers: Map<string, string>;

  setActiveNode: (id: string | null) => void;
  setViewNode: (id: string, state: ViewNodeState) => void;
  updatePosition: (id: string, position: { x: number; y: number }) => void;
  toggleCollapse: (id: string) => void;
  appendStream: (nodeId: string, chunk: string) => void;
  clearStream: (nodeId: string) => void;
  clear: () => void;
}

export const useViewStore = create<ViewState>()((set) => ({
  viewNodes: new Map(),
  activeNodeId: null,
  streamBuffers: new Map(),

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
  clear: () => set({ viewNodes: new Map(), activeNodeId: null, streamBuffers: new Map() }),
}));
