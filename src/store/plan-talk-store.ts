import { create } from 'zustand';
import type { PlanTalkTurn, PlanTalkTurnState, ProposedPlanEdit, PlanGapCard } from '../core/types';

interface PlanTalkState {
  isOpen: boolean;
  turnState: PlanTalkTurnState;
  turns: PlanTalkTurn[];
  pendingEdits: ProposedPlanEdit[];
  currentUnderstanding: string;
  gapCards: PlanGapCard[];
  unresolvedQuestions: string[];
  error: string | null;

  open: () => void;
  close: () => void;
  setTurnState: (state: PlanTalkTurnState) => void;
  addTurn: (turn: PlanTalkTurn) => void;
  setPendingEdits: (edits: ProposedPlanEdit[]) => void;
  setGapCards: (cards: PlanGapCard[]) => void;
  setUnderstanding: (text: string) => void;
  setUnresolvedQuestions: (questions: string[]) => void;
  updateEditStatus: (editId: string, approved: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const usePlanTalkStore = create<PlanTalkState>()((set) => ({
  isOpen: false,
  turnState: 'idle',
  turns: [],
  pendingEdits: [],
  currentUnderstanding: '',
  gapCards: [],
  unresolvedQuestions: [],
  error: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setTurnState: (turnState) => set({ turnState }),
  addTurn: (turn) => set((s) => ({ turns: [...s.turns, turn] })),
  setPendingEdits: (edits) => set({ pendingEdits: edits }),
  setGapCards: (cards) => set({ gapCards: cards }),
  setUnderstanding: (text) => set({ currentUnderstanding: text }),
  setUnresolvedQuestions: (questions) => set({ unresolvedQuestions: questions }),
  updateEditStatus: (editId, approved) =>
    set((s) => ({
      pendingEdits: s.pendingEdits.map((e) =>
        e.id === editId ? { ...e, approved } : e,
      ),
    })),
  setError: (error) => set({ error }),
  clear: () =>
    set({
      turnState: 'idle',
      turns: [],
      pendingEdits: [],
      currentUnderstanding: '',
      gapCards: [],
      unresolvedQuestions: [],
      error: null,
    }),
}));
