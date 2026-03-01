import type { ITerminalBackend } from './terminal-backend';
import { LocalEchoBackend } from './local-echo-backend';

export type TerminalRuntimeMode = 'local' | 'container' | 'host';

export interface TerminalFactoryConfig {
  runtimeMode: TerminalRuntimeMode;
  vibeBin: 'auto' | 'vibe' | 'mistral-vibe';
  vibeHome: string;
}

const DEFAULT_CONFIG: TerminalFactoryConfig = {
  runtimeMode: 'local',
  vibeBin: 'auto',
  vibeHome: '/home/fuda/.vibe',
};

/**
 * Factory for creating terminal backends.
 * Currently returns LocalEchoBackend for all modes; swap to real
 * backends (ContainerPtyBackend, HostPtyBackend) when infrastructure exists.
 */
export function createTerminalBackend(
  config: Partial<TerminalFactoryConfig> = {},
): ITerminalBackend {
  const resolved = { ...DEFAULT_CONFIG, ...config };

  switch (resolved.runtimeMode) {
    case 'container':
    case 'host':
      // Future: return new ContainerPtyBackend(resolved) / HostPtyBackend(resolved)
      return new LocalEchoBackend();
    case 'local':
    default:
      return new LocalEchoBackend();
  }
}
