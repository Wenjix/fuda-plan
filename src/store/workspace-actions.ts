import type { SessionStatus } from '../core/types/session';
import { saveSession, restoreSession, listSavedSessions } from '../persistence/hooks';
import { deleteEntity, getAllByIndex } from '../persistence/repository';
import { useSemanticStore } from './semantic-store';
import { useSessionStore } from './session-store';
import { useViewStore } from './view-store';
import { useJobStore } from './job-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionSummary {
  id: string;
  topic: string;
  status: SessionStatus;
  createdAt: string;
  nodeCount: number;
  lanePlanCount: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Switch from the current session to a different one.
 *
 * 1. Save the current session (if any)
 * 2. Clear all in-memory stores
 * 3. Restore the target session from IDB
 */
export async function switchSession(sessionId: string): Promise<void> {
  // Save whatever we have in memory first
  const current = useSessionStore.getState().session;
  if (current) {
    await saveSession();
  }

  // Clear all stores to prepare for the new session
  useSemanticStore.getState().clear();
  useViewStore.getState().clear();
  useJobStore.getState().clear();
  useSessionStore.getState().clear();

  // Restore the target session
  const ok = await restoreSession(sessionId);
  if (!ok) {
    throw new Error(`Failed to restore session: ${sessionId}`);
  }
}

/**
 * Delete a session and its related entities from IDB.
 *
 * If the deleted session is the currently active one, all stores are cleared.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const current = useSessionStore.getState().session;

  // If deleting the active session, clear all stores
  if (current && current.id === sessionId) {
    useSemanticStore.getState().clear();
    useViewStore.getState().clear();
    useJobStore.getState().clear();
    useSessionStore.getState().clear();
  }

  // Delete the session envelope from IDB
  // We delete all related entities by querying the by-session index
  const storeNames = [
    'lanes',
    'nodes',
    'edges',
    'promotions',
    'lanePlans',
    'unifiedPlans',
    'dialogueTurns',
    'jobs',
  ] as const;

  const deletions = storeNames.map(async (storeName) => {
    const entities = await getAllByIndex(storeName, 'by-session', sessionId);
    return Promise.all(
      entities.map((e) => deleteEntity(storeName, (e as { id: string }).id)),
    );
  });

  await Promise.all(deletions);

  // Finally delete the session itself
  await deleteEntity('sessions', sessionId);
}

/**
 * List all saved sessions with summary information.
 *
 * Loads session records from IDB and augments them with entity counts.
 */
export async function listSessions(): Promise<SessionSummary[]> {
  const savedSessions = await listSavedSessions();

  const summaries = await Promise.all(
    savedSessions.map(async (s) => {
      const [nodes, lanePlans] = await Promise.all([
        getAllByIndex('nodes', 'by-session', s.id),
        getAllByIndex('lanePlans', 'by-session', s.id),
      ]);

      // We need to get the full session to read status; listSavedSessions
      // only returns { id, topic, updatedAt }. We fetch the session entity.
      const { getEntity } = await import('../persistence/repository');
      const fullSession = await getEntity('sessions', s.id);

      return {
        id: s.id,
        topic: s.topic,
        status: (fullSession?.status ?? 'exploring') as SessionStatus,
        createdAt: fullSession?.createdAt ?? s.updatedAt,
        nodeCount: nodes.length,
        lanePlanCount: lanePlans.length,
      };
    }),
  );

  // Sort by most recently updated
  return summaries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
