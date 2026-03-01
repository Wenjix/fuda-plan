import { useSemanticStore } from '../store/semantic-store';
import { useSessionStore } from '../store/session-store';
import { putEntity, loadSessionEnvelope, getAllByIndex } from './repository';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Save current session state to IDB.
 * Writes all entities from the semantic and session stores.
 */
export async function saveSession(): Promise<void> {
  const session = useSessionStore.getState().session;
  if (!session) return;

  const { nodes, edges, promotions, lanes, lanePlans, unifiedPlan, dialogueTurns } = useSemanticStore.getState();

  // Save session
  await putEntity('sessions', session);

  // Save all entities in parallel
  await Promise.all([
    ...lanes.map(l => putEntity('lanes', l)),
    ...nodes.map(n => putEntity('nodes', n)),
    ...edges.map(e => putEntity('edges', e)),
    ...promotions.map(p => putEntity('promotions', p)),
    ...lanePlans.map(lp => putEntity('lanePlans', lp)),
    ...(unifiedPlan ? [putEntity('unifiedPlans', unifiedPlan)] : []),
    ...dialogueTurns.map(dt => putEntity('dialogueTurns', dt)),
  ]);
}

/**
 * Trigger a debounced save (500ms trailing edge).
 */
export function debouncedSave(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    saveSession().catch(err => console.warn('Auto-save failed:', err));
  }, 500);
}

/**
 * Subscribe to store changes for auto-save.
 * Returns an unsubscribe function.
 */
export function startAutoSave(): () => void {
  const unsub1 = useSemanticStore.subscribe(debouncedSave);
  const unsub2 = useSessionStore.subscribe(debouncedSave);
  return () => {
    unsub1();
    unsub2();
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

/**
 * Load a session from IDB and hydrate the stores.
 * Returns true if successfully loaded, false if session not found.
 */
export async function restoreSession(sessionId: string): Promise<boolean> {
  try {
    const envelope = await loadSessionEnvelope(sessionId);

    // Hydrate session store
    useSessionStore.getState().setSession(envelope.session);
    useSessionStore.getState().setActiveLane(envelope.session.activeLaneId);
    useSessionStore.getState().setUIMode('exploring');

    // Hydrate semantic store
    useSemanticStore.getState().loadSession({
      nodes: envelope.nodes,
      edges: envelope.edges,
      promotions: envelope.promotions,
      lanes: envelope.lanes,
      lanePlans: envelope.lanePlans,
      unifiedPlan: envelope.unifiedPlans[0] ?? null,
      dialogueTurns: envelope.dialogueTurns,
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * List all saved sessions from IDB (for session picker).
 */
export async function listSavedSessions(): Promise<Array<{ id: string; topic: string; updatedAt: string }>> {
  const { getDB } = await import('./repository');
  const db = await getDB();
  const sessions = await db.getAll('sessions');
  return sessions.map(s => ({
    id: s.id,
    topic: s.topic,
    updatedAt: s.updatedAt,
  }));
}
