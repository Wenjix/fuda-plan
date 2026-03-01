import { create } from 'zustand';
import type { PlanningSession, ChallengeDepth } from '../core/types';

type UIMode = 'topic_input' | 'compass' | 'exploring' | 'workspace';

interface SessionState {
  session: PlanningSession | null;
  activeLaneId: string | null;
  challengeDepth: ChallengeDepth;
  uiMode: UIMode;
  planPanelOpen: boolean;

  setSession: (session: PlanningSession | null) => void;
  setActiveLane: (laneId: string | null) => void;
  setChallengeDepth: (depth: ChallengeDepth) => void;
  setUIMode: (mode: UIMode) => void;
  setPlanPanelOpen: (open: boolean) => void;
  togglePlanPanel: () => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  activeLaneId: null,
  challengeDepth: 'balanced',
  uiMode: 'topic_input',
  planPanelOpen: false,

  setSession: (session) => set({ session }),
  setActiveLane: (laneId) => set({ activeLaneId: laneId }),
  setChallengeDepth: (depth) => set({ challengeDepth: depth }),
  setUIMode: (mode) => set({ uiMode: mode }),
  setPlanPanelOpen: (open) => set({ planPanelOpen: open }),
  togglePlanPanel: () => set((state) => ({ planPanelOpen: !state.planPanelOpen })),
  clear: () => set({ session: null, activeLaneId: null, challengeDepth: 'balanced', uiMode: 'topic_input', planPanelOpen: false }),
}));
