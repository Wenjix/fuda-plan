import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebSocketPtyBackend } from '../../services/ws-pty-backend';
import type { TerminalBackendEvents, TerminalConnectionState } from '../../services/terminal-backend';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

// Capture the most recently constructed MockWebSocket
let lastMockWs: MockWebSocket | null = null;

// Install mock WebSocket globally
const OriginalWebSocket = globalThis.WebSocket;
beforeEach(() => {
  lastMockWs = null;
  (globalThis as unknown as Record<string, unknown>).WebSocket = class extends MockWebSocket {
    constructor() {
      super();
      lastMockWs = this;
    }
  };
  // Copy static constants
  Object.assign(globalThis.WebSocket, {
    CONNECTING: MockWebSocket.CONNECTING,
    OPEN: MockWebSocket.OPEN,
    CLOSING: MockWebSocket.CLOSING,
    CLOSED: MockWebSocket.CLOSED,
  });
});

afterEach(() => {
  globalThis.WebSocket = OriginalWebSocket;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

function createMockEvents() {
  const output: string[] = [];
  const states: TerminalConnectionState[] = [];
  const exits: Array<{ exitCode: number | null; signal: string | null }> = [];
  const toolStatuses: Array<{ tool: string; status: unknown }> = [];

  const events: TerminalBackendEvents = {
    onOutput: (data) => output.push(data),
    onStateChange: (state) => states.push(state),
    onExit: (exitCode, signal) => exits.push({ exitCode, signal }),
    onToolStatus: (tool, status) => toolStatuses.push({ tool, status }),
  };

  return { events, output, states, exits, toolStatuses };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebSocketPtyBackend', () => {
  let backend: WebSocketPtyBackend;
  let mocks: ReturnType<typeof createMockEvents>;

  beforeEach(() => {
    backend = new WebSocketPtyBackend('ws://localhost:3001/ws/pty');
    mocks = createMockEvents();
  });

  it('starts in disconnected state', () => {
    expect(backend.getState()).toBe('disconnected');
  });

  it('transitions through connecting → ready on successful connect', async () => {
    const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });

    // Should be connecting immediately
    expect(mocks.states).toContain('connecting');

    // Simulate WebSocket open
    lastMockWs!.simulateOpen();
    await connectPromise;

    expect(backend.getState()).toBe('ready');
    expect(mocks.states).toEqual(['connecting', 'ready']);
  });

  it('sends spawn message on connect', async () => {
    const connectPromise = backend.connect({ cols: 120, rows: 40, cwd: '/tmp', events: mocks.events });
    lastMockWs!.simulateOpen();
    await connectPromise;

    const sent = JSON.parse(lastMockWs!.sent[0]);
    expect(sent).toEqual({ type: 'spawn', cols: 120, rows: 40, cwd: '/tmp' });
  });

  it('transitions to error on WebSocket error', async () => {
    const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
    lastMockWs!.simulateError();

    await expect(connectPromise).rejects.toThrow('WebSocket connection failed');
    expect(backend.getState()).toBe('error');
  });

  it('sends data message on write', async () => {
    const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
    lastMockWs!.simulateOpen();
    await connectPromise;

    backend.write('ls -la\r');

    const sent = JSON.parse(lastMockWs!.sent[1]); // [0] is spawn
    expect(sent).toEqual({ type: 'data', data: 'ls -la\r' });
  });

  it('ignores write when disconnected', () => {
    // Should not throw
    backend.write('hello');
    expect(lastMockWs).toBeNull();
  });

  it('sends resize message', async () => {
    const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
    lastMockWs!.simulateOpen();
    await connectPromise;

    backend.resize(120, 40);

    const sent = JSON.parse(lastMockWs!.sent[1]);
    expect(sent).toEqual({ type: 'resize', cols: 120, rows: 40 });
  });

  it('dispatches data messages to onOutput', async () => {
    const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
    lastMockWs!.simulateOpen();
    await connectPromise;

    lastMockWs!.simulateMessage({ type: 'data', data: 'hello world\r\n' });

    expect(mocks.output).toEqual(['hello world\r\n']);
  });

  it('dispatches exit messages and transitions to disconnected', async () => {
    const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
    lastMockWs!.simulateOpen();
    await connectPromise;

    lastMockWs!.simulateMessage({ type: 'exit', exitCode: 0, signal: null });

    expect(mocks.exits).toEqual([{ exitCode: 0, signal: null }]);
    expect(backend.getState()).toBe('disconnected');
  });

  it('disconnect closes WebSocket and transitions to disconnected', async () => {
    const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
    lastMockWs!.simulateOpen();
    await connectPromise;

    backend.disconnect();

    expect(backend.getState()).toBe('disconnected');
  });

  describe('probeTool', () => {
    it('sends probe message and resolves on probeResult', async () => {
      const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
      lastMockWs!.simulateOpen();
      await connectPromise;

      const probePromise = backend.probeTool('vibe');

      // Verify probe message was sent
      const sent = JSON.parse(lastMockWs!.sent[1]);
      expect(sent).toEqual({ type: 'probe', tool: 'vibe' });

      // Simulate server response
      const mockStatus = {
        available: true,
        command: 'vibe',
        version: '1.0.0',
        installRequired: false,
        installScope: null,
        pythonVersion: '3.11.0',
        uvAvailable: true,
        apiKeyConfigured: true,
        setupRequired: false,
        vibeHome: '/home/user/.vibe',
        lastCheckedAt: '2026-03-01T00:00:00.000Z',
      };
      lastMockWs!.simulateMessage({ type: 'probeResult', tool: 'vibe', status: mockStatus });

      const result = await probePromise;
      expect(result).toEqual(mockStatus);
      expect(mocks.toolStatuses).toHaveLength(1);
      expect(mocks.toolStatuses[0].tool).toBe('vibe');
    });

    it('rejects on timeout', async () => {
      vi.useFakeTimers();

      const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
      lastMockWs!.simulateOpen();
      await connectPromise;

      const probePromise = backend.probeTool('vibe');

      // Advance past timeout
      vi.advanceTimersByTime(10_001);

      await expect(probePromise).rejects.toThrow('Probe timed out for tool: vibe');

      vi.useRealTimers();
    });

    it('rejects when not connected', async () => {
      await expect(backend.probeTool('vibe')).rejects.toThrow('Not connected');
    });

    it('rejects pending probes on disconnect', async () => {
      const connectPromise = backend.connect({ cols: 80, rows: 24, events: mocks.events });
      lastMockWs!.simulateOpen();
      await connectPromise;

      const probePromise = backend.probeTool('vibe');
      backend.disconnect();

      await expect(probePromise).rejects.toThrow('Disconnected');
    });
  });
});
