import { create } from 'zustand';
import type { TerminalConnectionState } from '../services/terminal-backend';

interface TerminalState {
  connectionState: TerminalConnectionState;
  terminalSessionId: string | null;
  lastExit: { exitCode: number | null; signal: string | null } | null;
  errorMessage: string | null;

  setConnectionState: (state: TerminalConnectionState) => void;
  setTerminalSessionId: (id: string | null) => void;
  setLastExit: (exit: { exitCode: number | null; signal: string | null } | null) => void;
  setErrorMessage: (msg: string | null) => void;
  clear: () => void;
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  connectionState: 'disconnected',
  terminalSessionId: null,
  lastExit: null,
  errorMessage: null,

  setConnectionState: (connectionState) => set({ connectionState }),
  setTerminalSessionId: (terminalSessionId) => set({ terminalSessionId }),
  setLastExit: (lastExit) => set({ lastExit }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  clear: () =>
    set({
      connectionState: 'disconnected',
      terminalSessionId: null,
      lastExit: null,
      errorMessage: null,
    }),
}));
