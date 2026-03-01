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

## V2.1 Upgrade: Mistral Vibe CLI Enablement
### Goal
- After terminal v2 ships, users can run Mistral Vibe immediately in FUDA terminal sessions.
- Account for the executable reality from upstream docs: package name is `mistral-vibe`, primary CLI command is `vibe`.
- Treat readiness as two checks, not one: binary availability and API-key/config readiness.

### Runtime Strategy
1. Keep container-backed terminal as the default runtime (from v2).
2. Add explicit backend config:
- `TERMINAL_RUNTIME_MODE=container|host` (default `container`).
- `TERMINAL_VIBE_BIN=auto|vibe|mistral-vibe` (default `auto`; probe `vibe` first, then `mistral-vibe`).
- `TERMINAL_VIBE_HOME=/home/fuda/.vibe` (container default).
3. Behavior by mode:
- `container`: user's host install is irrelevant unless container image also includes Vibe.
- `host`: user's local install is usable if in `PATH`.

### API and Protocol Additions
1. Extend `POST /api/terminal/sessions` response:

```ts
interface TerminalToolStatus {
  available: boolean;
  command: 'vibe' | 'mistral-vibe' | null;
  version: string | null;
  installRequired: boolean;
  installScope: 'host' | 'container';
  pythonVersion: string | null;
  uvAvailable: boolean;
  apiKeyConfigured: boolean;
  setupRequired: boolean;
  vibeHome: string | null;
}

interface CreateTerminalSessionResponseV21 {
  terminalSessionId: string;
  wsUrl: string;
  expiresAt: string;
  tools: {
    mistralVibe: TerminalToolStatus;
  };
}
```

2. Add optional client/server re-check messages:

```ts
type ClientMsgV21 = { type: 'probe_tool'; tool: 'vibe' };
type ServerMsgV21 = { type: 'tool_status'; tool: 'vibe'; status: TerminalToolStatus };
```

3. Backend probe command sequence (runtime shell):
- `command -v vibe || command -v mistral-vibe`
- `<resolved-bin> --version` (if present)
- `python3 --version` (or `python --version`)
- `command -v uv`
- API-key presence check via `MISTRAL_API_KEY` env or `${VIBE_HOME}/.env` entry (report boolean only; never return value)

### Installation and First-Run UX
1. If binary + API key are ready:
- Show "Mistral Vibe ready (`vibe`)" status in terminal drawer.

2. If binary is missing:
- Show non-blocking banner with copyable install commands.
- Recommended install order:
  1. `uv tool install mistral-vibe`
  2. `pip install mistral-vibe`
  3. `curl -LsSf https://mistral.ai/vibe/install.sh | bash`

3. If binary exists but API key is not configured:
- Show setup guidance:
  1. `vibe --setup`
  2. or `export MISTRAL_API_KEY=...`
- Clarify that Vibe may write credentials to `${VIBE_HOME}/.env`.
4. Trust-folder behavior:
- If Vibe prompts for folder trust, treat as an interactive first-run step and surface a notice instead of classifying the tool as broken.
- Keep terminal usable so user can approve trust in-session.

5. Terminal compatibility handling:
- Vibe targets modern UNIX terminals; xterm.js compatibility should be treated as "best effort".
- Provide fallback command examples for non-interactive usage:
  - `vibe --prompt "..." --max-turns 3 --output text`

6. Security and controls:
- Never auto-run installers or `vibe --setup` without explicit user action.
- Redact secrets from diagnostics and telemetry.
- Do not persist API keys in FUDA app state or IndexedDB.

### Container Image and Env Changes (Default Mode)
1. Build terminal image variant with pinned Vibe stack:
- Python 3.12+, `uv`, `mistral-vibe` package, `vibe` command available.
- Build args: `MISTRAL_VIBE_VERSION`, `PYTHON_VERSION`.
2. Set container defaults for reproducibility:
- `VIBE_HOME=/home/fuda/.vibe`.
- Precreate minimal `config.toml` with `enable_auto_update = false`.
3. Validate on container startup:
- Fail fast if configured Vibe command is missing.

### Frontend Changes
1. Extend terminal tooling state:

```ts
interface TerminalToolingState {
  mistralVibe: {
    available: boolean;
    command: 'vibe' | 'mistral-vibe' | null;
    version: string | null;
    installRequired: boolean;
    installScope: 'host' | 'container' | null;
    pythonVersion: string | null;
    uvAvailable: boolean;
    apiKeyConfigured: boolean;
    setupRequired: boolean;
    vibeHome: string | null;
    lastCheckedAt: string | null;
  };
}
```

2. Add `TerminalSetupNotice` states:
- `ready`: compact status pill with resolved command and version.
- `install_required`: install command snippets.
- `setup_required`: API key/setup instructions.

3. Keep tool status ephemeral (no IndexedDB persistence), same as terminal session state.

### Test Additions for v2.1
1. Backend unit tests:
- Resolves command correctly when only `vibe` exists.
- Falls back to `mistral-vibe` when `vibe` alias is missing.
- Reports `setupRequired=true` when API key is absent.

2. Frontend unit/component tests:
- Renders `ready`, `install_required`, and `setup_required` states.
- Re-check action triggers `probe_tool` and updates state.
- Missing/setup banners do not block terminal input/output.

3. Integration tests:
- `container` mode image can run `vibe --version` and `vibe --help`.
- `host` mode uses host binary when present.
- Missing binary and missing API key each produce distinct guidance.
- Programmatic fallback command (`vibe --prompt ...`) runs in non-interactive scenarios.

### Rollout Plan
1. v2: ship PTY terminal without hard dependency on Vibe.
2. v2.1: ship Vibe probe + install/setup readiness UX + runtime config.
3. v2.1.1: ship pinned container image, hardened CI coverage, and terminal compatibility QA matrix.

---

## Phase 1 Implementation Plan (Frontend-Only)

### Context

Fuda-plan is a **purely frontend app** — no backend, no server directory, no WebSocket infrastructure. This implementation plan covers the complete terminal UI/UX with a local echo backend, behind a service abstraction so a real PTY backend can be swapped in later without touching UI code.

### Architecture Decision

**Phased approach**: Ship the full terminal drawer UI with a `LocalEchoBackend` (built-in commands: `help`, `clear`, `echo`, `env`, `history`, `date`). The `ITerminalBackend` interface enables a future `WebSocketPtyBackend` swap by changing one factory function.

### Step 1: Install dependencies

```bash
npm install xterm @xterm/addon-fit @xterm/addon-web-links
```

### Step 2: Service abstraction layer

**New files:**

| File | Purpose |
|------|---------|
| `src/services/terminal-backend.ts` | `ITerminalBackend` interface + `TerminalBackendEvents` types |
| `src/services/local-echo-backend.ts` | `LocalEchoBackend` implementing the interface — handles line editing, command history, built-in commands |
| `src/services/terminal-factory.ts` | `createTerminalBackend()` factory — returns `LocalEchoBackend` now, swappable later |

Interface shape:

```ts
interface ITerminalBackend {
  connect(opts: { cols: number; rows: number; cwd?: string; events: TerminalBackendEvents }): Promise<void>;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  disconnect(): void;
  getState(): TerminalConnectionState;
}
```

Built-in commands for local echo: `help`, `clear`, `echo`, `env` (shows FUDA session vars), `history`, `date`, `whoami`.

### Step 3: State management

**New file: `src/store/terminal-store.ts`** — Ephemeral Zustand store (follows `radial-menu-store.ts` pattern):
- `connectionState: TerminalConnectionState`
- `terminalSessionId: string | null`
- `lastExit`, `errorMessage`
- Actions: `setConnectionState`, `setLastExit`, `setErrorMessage`, `clear`

**Modified: `src/store/view-store.ts`** — Add terminal geometry (persists via auto-save):
- `terminalOpen: boolean` (default `false`)
- `terminalHeightPx: number` (default `280`, clamped `200–520`)
- Actions: `setTerminalOpen`, `toggleTerminal`, `setTerminalHeight`
- Reset `terminalOpen` to `false` in `clear()`

**New file: `src/store/terminal-actions.ts`** — Action module (follows `plan-actions.ts` pattern):
- `openTerminal()` — sets `terminalOpen: true`, creates backend if needed
- `closeTerminal()` — sets `terminalOpen: false` (does NOT kill process — spec requirement)
- `endTerminalSession()` — disconnects backend + clears state
- `toggleTerminal()` — convenience toggle
- `getActiveBackend()` / `setActiveBackend()` — module-level backend ref

### Step 4: Terminal drawer component

**New files:**
- `src/components/TerminalDrawer/TerminalDrawer.tsx`
- `src/components/TerminalDrawer/TerminalDrawer.module.css`
- `src/components/TerminalDrawer/xterm-theme.ts`

Component responsibilities:
- Mount xterm.js `Terminal` instance with `FitAddon` and `WebLinksAddon`
- Wire `term.onData` → `backend.write`, `backend.onOutput` → `term.write`
- `ResizeObserver` + `FitAddon.fit()` on container resize
- Resize handle (top edge, drag to adjust height 200–520px)
- Header bar: "Terminal" label, status dot, connection state text, "End Session" button
- Theme reactivity: `MutationObserver` on `data-theme` attr updates xterm theme
- Re-fit when `terminalHeightPx` changes

### Step 5: Theme integration

**Modified: `src/components/Settings/theme.css`** — Add terminal CSS custom properties:

```css
--terminal-bg: #1e1e2e;
--terminal-border: #2a2a3a;
--terminal-text: #cdd6f4;
--terminal-cursor: #f5e0dc;
--terminal-selection-bg: rgba(99, 102, 241, 0.3);
```

(Both light and dark themes get dark terminal backgrounds — standard practice.)

**`xterm-theme.ts`** reads these CSS vars at runtime to build xterm's `ITheme` object with Catppuccin Mocha ANSI palette.

### Step 6: Layout integration

**Modified: `src/App.tsx`** — Wrap canvas + terminal in a column flex container:

```tsx
// Before:
<div className="exploring-layout">
  <FudaCanvas />
  {planPanelOpen && <div className="plan-panel-container">...</div>}
</div>

// After:
<div className="exploring-layout">
  <div className="exploring-content">
    <FudaCanvas />
    {terminalOpen && <TerminalDrawer />}
  </div>
  {planPanelOpen && <div className="plan-panel-container">...</div>}
</div>
```

Add `Ctrl+`` keyboard shortcut via `useEffect` + `window.addEventListener('keydown', ...)`.

**Modified: `src/App.css`** — Add `.exploring-content`:

```css
.exploring-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
```

Update `.exploring-layout > :first-child` to target `.exploring-content`.

### Step 7: Toolbar integration

**Modified: `src/components/Toolbar/Toolbar.tsx`** — Add Terminal toggle button in `.right` section, before the Plan toggle (line 50). Mirrors the existing `planToggle` pattern exactly.

**Modified: `src/components/Toolbar/Toolbar.module.css`** — Add `.terminalToggle` / `.terminalToggleActive` styles (clone of `.planToggle` with monospace font-family).

### Step 8: Persistence guard

**Modified: `src/store/workspace-actions.ts`** (or session restore logic) — After loading a session, force `terminalOpen: false` since terminal sessions are ephemeral. `terminalHeightPx` persists (user preference).

### Step 9: Tests

| Test File | Covers |
|-----------|--------|
| `src/__tests__/store/terminal-store.test.ts` | State transitions, clear(), initial state |
| `src/__tests__/store/view-store-terminal.test.ts` | toggleTerminal, height clamping, clear resets |
| `src/__tests__/services/local-echo-backend.test.ts` | connect/disconnect lifecycle, built-in commands, state transitions |
| `src/__tests__/components/terminal-drawer.test.tsx` | Mocked xterm (jsdom has no canvas), integration with stores |

Add `ResizeObserver` polyfill to `src/__tests__/setup.ts`.

### Files Summary

**New (8):**
1. `src/services/terminal-backend.ts`
2. `src/services/local-echo-backend.ts`
3. `src/services/terminal-factory.ts`
4. `src/store/terminal-store.ts`
5. `src/store/terminal-actions.ts`
6. `src/components/TerminalDrawer/TerminalDrawer.tsx`
7. `src/components/TerminalDrawer/TerminalDrawer.module.css`
8. `src/components/TerminalDrawer/xterm-theme.ts`

**Modified (7):**
1. `package.json` — add xterm deps
2. `src/store/view-store.ts` — terminal geometry state
3. `src/App.tsx` — layout wrapper, keyboard shortcut, TerminalDrawer render
4. `src/App.css` — `.exploring-content` flex column
5. `src/components/Toolbar/Toolbar.tsx` — Terminal toggle button
6. `src/components/Toolbar/Toolbar.module.css` — toggle styles
7. `src/components/Settings/theme.css` — terminal CSS vars

**New tests (4):**
1. `src/__tests__/store/terminal-store.test.ts`
2. `src/__tests__/store/view-store-terminal.test.ts`
3. `src/__tests__/services/local-echo-backend.test.ts`
4. `src/__tests__/components/terminal-drawer.test.tsx`

### Verification

1. `npm run build` — TypeScript compiles without errors
2. `npm test` — all new and existing tests pass
3. Manual: open canvas → click Terminal button (or `Ctrl+``) → drawer opens, pushes canvas up → type `help` → see built-in commands → resize handle works (200–520px range) → collapse/reopen preserves terminal state → "End Session" clears terminal → Plan panel + terminal can coexist → light/dark theme switch updates terminal colors
