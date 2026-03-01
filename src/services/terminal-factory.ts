import type { ITerminalBackend } from './terminal-backend';
import { LocalEchoBackend } from './local-echo-backend';

/**
 * Factory for creating terminal backends.
 * Currently returns LocalEchoBackend; swap to WebSocketPtyBackend
 * when backend infrastructure is available.
 */
export function createTerminalBackend(): ITerminalBackend {
  return new LocalEchoBackend();
}
