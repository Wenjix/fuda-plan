import { create } from 'zustand';
import type { SemanticNode, SemanticEdge, Promotion, LanePlan, UnifiedPlan } from '../core/types';

interface SemanticState {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  promotions: Promotion[];
  lanePlans: LanePlan[];
  unifiedPlan: UnifiedPlan | null;

  // Node CRUD
  addNode: (node: SemanticNode) => void;
  updateNode: (id: string, updates: Partial<SemanticNode>) => void;
  getNode: (id: string) => SemanticNode | undefined;

  // Edge CRUD
  addEdge: (edge: SemanticEdge) => void;

  // Promotion
  addPromotion: (promotion: Promotion) => void;
  removePromotion: (id: string) => void;

  // Plans
  addLanePlan: (plan: LanePlan) => void;
  setUnifiedPlan: (plan: UnifiedPlan | null) => void;

  // Bulk
  loadSession: (data: {
    nodes: SemanticNode[];
    edges: SemanticEdge[];
    promotions: Promotion[];
    lanePlans: LanePlan[];
    unifiedPlan: UnifiedPlan | null;
  }) => void;
  clear: () => void;
}

export const useSemanticStore = create<SemanticState>()((set, get) => ({
  nodes: [],
  edges: [],
  promotions: [],
  lanePlans: [],
  unifiedPlan: null,

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  updateNode: (id, updates) => set((s) => ({
    nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
  })),
  getNode: (id) => get().nodes.find((n) => n.id === id),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  addPromotion: (promotion) => set((s) => ({ promotions: [...s.promotions, promotion] })),
  removePromotion: (id) => set((s) => ({ promotions: s.promotions.filter((p) => p.id !== id) })),
  addLanePlan: (plan) => set((s) => ({ lanePlans: [...s.lanePlans, plan] })),
  setUnifiedPlan: (plan) => set({ unifiedPlan: plan }),
  loadSession: (data) => set(data),
  clear: () => set({ nodes: [], edges: [], promotions: [], lanePlans: [], unifiedPlan: null }),
}));
