# V2 Canvas Terminal with xterm.js (Open/Collapsible + Real CLI)

## Summary
- Review of `plan_for_fuda.md` shows v1 explicitly excludes CLI tooling and backend, so terminal support is a v2 addition.
- V2 adds one shared, openable/collapsible terminal for the canvas, powered by `xterm.js` on the client and a backend PTY in an isolated container.
- Chosen defaults: backend PTY, single shared terminal, isolated full shell, workspace mount read/write, network enabled, ephemeral lifecycle.

## Important Existing-Plan Updates
1. Keep v1 non-goals unchanged for historical clarity, but add a new "V2 Delta" note stating terminal/CLI support starts in v2.
2. Add a new phase section after current phase roadmap: `Phase 6 (V2): Interactive Terminal`.
3. Extend canvas layout notes to include terminal drawer behavior and combined layout with DialoguePanel.
4. Extend testing and verification sections with terminal-specific criteria.

## Public APIs / Interfaces / Types
1. Add backend REST endpoint `POST /api/terminal/sessions` that creates a terminal session for a FUDA session and returns `{ terminalSessionId, wsUrl, expiresAt }`.
2. Add backend REST endpoint `DELETE /api/terminal/sessions/:terminalSessionId` that terminates the shell/container.
3. Add WebSocket endpoint `/api/terminal/ws/:terminalSessionId` for bidirectional PTY streaming.
4. Define protocol messages (shared TS types in frontend/backend):

```ts
type ClientMsg =
  | { type: 'init'; sessionId: string; cols: number; rows: number; cwd?: string }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' }
  | { type: 'close' };

type ServerMsg =
  | { type: 'ready'; terminalSessionId: string; cwd: string; shell: string }
  | { type: 'output'; data: string }
  | { type: 'status'; state: 'connecting' | 'ready' | 'closing' | 'closed' }
  | { type: 'exit'; exitCode: number | null; signal: string | null }
  | { type: 'error'; code: 'unauthorized' | 'spawn_failed' | 'not_found' | 'io_error'; message: string };
```

5. Add frontend ephemeral store interface:

```ts
interface TerminalState {
  connectionState: 'disconnected' | 'connecting' | 'ready' | 'error';
  terminalSessionId: string | null;
  isOpen: boolean;
  heightPx: number;
  lastExit: { exitCode: number | null; signal: string | null } | null;
}
```

## Architecture and Implementation Plan
1. Frontend terminal UI:
- Add `xterm`, `xterm-addon-fit`, `xterm-addon-web-links`.
- Create `TerminalDrawer` component docked to canvas bottom.
- Add toolbar toggle button `Terminal` and shortcut `Ctrl+\``.
- Drawer default height `280px`, resizable between `200px` and `520px`.
- Open/close is collapsible (hide/show). Collapse does not kill running process. Explicit "End Session" action kills process.

2. Frontend state and wiring:
- Add `src/store/terminal-store.ts` as ephemeral (not persisted).
- Keep terminal geometry state (`isOpen`, `heightPx`) in `view-store` persistence so UI preference survives reload.
- Add `src/services/terminal-client.ts` for REST + WS lifecycle.
- Use `ResizeObserver` + `FitAddon.fit()` when drawer opens, resizes, window resizes, or DialoguePanel toggles.

3. Backend PTY/session manager:
- Add backend service module `server/terminal/*` with session manager, container runner, ws handler, protocol types.
- One terminal instance per FUDA session (shared terminal behavior).
- On first open, create session + container + shell; on reconnect while alive, reattach.
- Ephemeral policy: terminate after last client disconnect grace period (15s) or explicit close; no long-lived resume across browser sessions.

4. Container execution model:
- Spawn isolated container per terminal session from a fixed CLI image.
- Mount project workspace read/write at `/workspace`.
- Network enabled.
- Run unprivileged user, drop extra capabilities, set CPU/memory/pid limits, no Docker socket mount.
- Inject env vars: `FUDA_SESSION_ID`, `FUDA_ACTIVE_LANE_ID` (initial), `FUDA_TOPIC` (sanitized).

5. Canvas/layout behavior:
- Terminal drawer pushes canvas upward (no overlay), matching existing non-overlay panel philosophy.
- DialoguePanel still pushes canvas left; both panels can be open simultaneously.
- Canvas remains pannable/zoomable while terminal streams.

6. Error handling:
- Backend unavailable: terminal toggle disabled with reason tooltip.
- WS drop: show "Terminal disconnected" banner with `Reconnect` action.
- Container spawn failure: non-blocking toast and terminal state to `error`.
- Command output buffering remains in xterm buffer only; no IndexedDB persistence.

## Test Cases and Scenarios
1. Frontend unit tests:
- Terminal store transitions for connect, ready, error, close.
- Drawer open/collapse/resize state behavior.
- `fit()` invoked on open and container resize events.

2. Frontend component tests:
- Toolbar toggle opens and collapses drawer.
- Terminal remains active while collapsed, output visible after reopen.
- Combined layout with DialoguePanel does not overlap interactive regions.

3. Backend unit tests:
- Session manager creates single shared terminal per FUDA session.
- Graceful termination on explicit close and disconnect timeout.
- Protocol validation rejects malformed messages.

4. Integration tests:
- Open terminal, run `echo hello`, verify streamed output.
- Resize terminal and verify PTY receives new cols/rows.
- Reconnect WS during active session and continue output.

5. Security and isolation tests:
- Container runs as non-root.
- Workspace mounted at expected path with RW access.
- Resource limits applied.
- Network egress functional (per chosen policy).

6. Verification criteria additions:
- Terminal button appears in canvas toolbar.
- Terminal opens/collapses without breaking canvas interactions.
- Real CLI commands execute and stream output.
- Closing terminal session terminates backend shell/container.
- Reload starts a fresh terminal session (ephemeral behavior).

## Assumptions and Defaults
- Backend runtime is available in v2 and can run container workloads.
- Docker-compatible container runtime is available on host.
- Single-user trust model remains; no multi-tenant auth introduced in this phase.
- Terminal history and process state are not included in FUDA exports or IndexedDB persistence.
- Existing LLM generation pipeline remains unchanged; terminal is an orthogonal capability.
