import type { ITerminalBackend, TerminalBackendEvents } from '../services/terminal-backend';
import type { TerminalToolStatus } from '../services/terminal-tool-types';
import { createDefaultToolStatus } from '../services/terminal-tool-types';
import { createTerminalBackend } from '../services/terminal-factory';
import { useTerminalStore } from './terminal-store';
import { useViewStore } from './view-store';
import { generateId } from '../utils/ids';

// Module-level backend reference (not in Zustand — avoids serialization)
let activeBackend: ITerminalBackend | null = null;

export function getActiveBackend(): ITerminalBackend | null {
  return activeBackend;
}

export function setActiveBackend(backend: ITerminalBackend | null): void {
  activeBackend = backend;
}

/**
 * Prepare the terminal drawer for opening. Creates a backend and session
 * but does NOT connect — the caller provides events and connects.
 */
export function prepareTerminal(): ITerminalBackend {
  useViewStore.getState().setTerminalOpen(true);

  if (activeBackend && useTerminalStore.getState().connectionState === 'ready') {
    return activeBackend;
  }

  // If there's a stale backend, clean it up
  if (activeBackend) {
    activeBackend.disconnect();
    activeBackend = null;
  }

  const backend = createTerminalBackend();
  activeBackend = backend;

  const sessionId = generateId();
  useTerminalStore.getState().setTerminalSessionId(sessionId);

  return backend;
}

/**
 * Open the terminal drawer with default event wiring.
 * For components that need custom events (e.g. TerminalDrawer with xterm),
 * use prepareTerminal() + backend.connect() directly instead.
 */
export function openTerminal(cols: number, rows: number, events?: TerminalBackendEvents): ITerminalBackend {
  const backend = prepareTerminal();

  // If already connected, skip reconnecting
  if (useTerminalStore.getState().connectionState === 'ready') {
    return backend;
  }

  backend.connect({
    cols,
    rows,
    events: events ?? {
      onOutput: () => {},
      onStateChange: (state) => {
        useTerminalStore.getState().setConnectionState(state);
      },
      onExit: (exitCode, signal) => {
        useTerminalStore.getState().setLastExit({ exitCode, signal });
        useTerminalStore.getState().setConnectionState('disconnected');
        activeBackend = null;
      },
    },
  });

  return backend;
}

/**
 * Close/collapse the terminal drawer. Does NOT kill the running process.
 */
export function closeTerminal(): void {
  useViewStore.getState().setTerminalOpen(false);
}

/**
 * Toggle terminal open/closed.
 */
export function toggleTerminal(cols?: number, rows?: number): ITerminalBackend | null {
  const { terminalOpen } = useViewStore.getState();
  if (terminalOpen) {
    closeTerminal();
    return activeBackend;
  }
  return openTerminal(cols ?? 80, rows ?? 24);
}

/**
 * End the terminal session — disconnects backend and clears state.
 */
export function endTerminalSession(): void {
  if (activeBackend) {
    activeBackend.disconnect();
    activeBackend = null;
  }
  useTerminalStore.getState().clear();
}

/**
 * Probe Mistral Vibe tool status via the active backend.
 * Falls back to a simulated "not available" status in local-echo mode.
 */
export async function probeVibeToolStatus(): Promise<TerminalToolStatus> {
  const backend = getActiveBackend();
  const store = useTerminalStore.getState();

  store.setToolProbeInProgress(true);

  try {
    let status: TerminalToolStatus;

    if (backend?.probeTool) {
      status = await backend.probeTool('vibe');
    } else {
      // Frontend-only mode: no real shell, report install_required
      status = createDefaultToolStatus();
      status.installRequired = true;
      status.installScope = 'host';
      status.lastCheckedAt = new Date().toISOString();
    }

    store.setToolStatus('mistralVibe', status);
    return status;
  } catch (err) {
    useTerminalStore.getState().setErrorMessage(
      err instanceof Error ? err.message : 'Vibe tool probe failed',
    );
    throw err;
  } finally {
    useTerminalStore.getState().setToolProbeInProgress(false);
  }
}
