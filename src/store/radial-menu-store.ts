import { create } from 'zustand';
import type { NodeFSMState } from '../core/types/node';

export interface PaneBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RadialMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  targetNodeId: string | null;
  targetFsmState: NodeFSMState | null;
  /** Bounds of the pane that triggered the menu (for clamping in quadrant mode) */
  paneBounds: PaneBounds | null;
  open: (nodeId: string, fsmState: NodeFSMState, x: number, y: number, paneBounds?: PaneBounds) => void;
  close: () => void;
}

export const useRadialMenuStore = create<RadialMenuState>()((set) => ({
  isOpen: false,
  position: { x: 0, y: 0 },
  targetNodeId: null,
  targetFsmState: null,
  paneBounds: null,

  open: (nodeId, fsmState, x, y, paneBounds) =>
    set({ isOpen: true, position: { x, y }, targetNodeId: nodeId, targetFsmState: fsmState, paneBounds: paneBounds ?? null }),

  close: () =>
    set({ isOpen: false, targetNodeId: null, targetFsmState: null, paneBounds: null }),
}));
