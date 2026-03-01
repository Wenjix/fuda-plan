import type { ITerminalBackend } from '../services/terminal-backend';
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
 * Open the terminal drawer. Creates a backend if none exists.
 * Returns the backend so the component can wire onData/onOutput.
 */
export function openTerminal(cols: number, rows: number): ITerminalBackend {
  useViewStore.getState().setTerminalOpen(true);

  if (activeBackend && useTerminalStore.getState().connectionState === 'ready') {
    return activeBackend;
  }

  const backend = createTerminalBackend();
  activeBackend = backend;

  const sessionId = generateId();
  useTerminalStore.getState().setTerminalSessionId(sessionId);

  backend.connect({
    cols,
    rows,
    events: {
      onOutput: () => {
        // Output wiring is handled by the component directly via backend reference
      },
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
