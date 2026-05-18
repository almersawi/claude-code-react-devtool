# claude-code-react-devtool — Design

**Status:** Approved · **Date:** 2026-05-18

## Problem

When using Claude Code with a React app, identifying which component or element to change requires manually typing file paths, component names, and selectors into the terminal. This is tedious and error-prone, especially for visual changes ("make this button blue"). We also lose the ability to share visual context (screenshots) without leaving the terminal flow.

## Goal

A drop-in React devtool that runs alongside any React dev server and lets the developer (a) interact with their existing `claude` CLI session from inside the browser, and (b) attach precise component/DOM/route/screenshot context to prompts with a single click — eliminating manual tagging while preserving the full terminal Claude Code experience (skills, slash commands, MCP servers, hooks, permission prompts, plugins all behave exactly as they do in a normal terminal session).

## Non-goals

- Reinventing the Claude Code chat UI with rich cards/buttons. The terminal IS the chat.
- Production-build support. The component is dev-only.
- Multi-tab connections (single-client v1).
- Mobile / touch support.
- Custom router adapters beyond best-effort React Router detection.

## High-level architecture

One npm package, `claude-code-react-devtool`, with two surfaces:

1. **Library export**: `<ClaudeCodeDevTool />` React component. Dropped into the user's `App.tsx`, gated behind a dev-mode check. Renders a floating, draggable panel with a toolbar and an embedded xterm.js terminal.

2. **CLI entrypoint**: `npx claude-code-react-devtool`. Run in a separate terminal alongside the dev server. Spawns the real `claude` CLI inside a PTY (`node-pty`) and exposes a local WebSocket that the component connects to.

The WebSocket carries raw terminal bytes in both directions, plus a small structured channel for screenshot uploads. The PTY makes `claude` think it's running interactively, so every native feature (slash commands, skills, hooks, MCP, plugins, permission prompts) works unchanged.

```
┌─────────────────────────────────────────────────────────────┐
│  Your React app (e.g. localhost:5173)                       │
│  ┌──────────────────────────────────────┐                   │
│  │  <ClaudeCodeDevTool />               │                   │
│  │  ┌─ toolbar ────────────────────┐    │                   │
│  │  │ [Pick] [DOM] [Route] [Shot]  │    │                   │
│  │  └──────────────────────────────┘    │                   │
│  │  ┌─ xterm.js terminal ──────────┐    │                   │
│  │  │ Live PTY ←→ claude CLI       │    │                   │
│  │  └──────────────────────────────┘    │                   │
│  │  WebSocket client                    │                   │
│  └────────────────┬─────────────────────┘                   │
└───────────────────┼─────────────────────────────────────────┘
                    │ WebSocket (ws://localhost:7777/ws)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  npx claude-code-react-devtool  (Node bridge)               │
│   WebSocket server  ◄──►  node-pty  ◄──►  claude CLI        │
└─────────────────────────────────────────────────────────────┘
```

## Package layout

```
claude-code-react-devtool/
├── package.json              # bin + main + exports
├── bin/cli.js                # thin shim → dist/cli/index.js
├── src/
│   ├── cli/
│   │   ├── index.ts          # argv parsing, banner, lifecycle
│   │   ├── server.ts         # HTTP + WS server
│   │   ├── pty.ts            # node-pty wrapper, scrollback buffer
│   │   └── screenshots.ts    # base64 → file write, cleanup
│   ├── component/
│   │   ├── ClaudeCodeDevTool.tsx  # public component export
│   │   ├── Panel.tsx              # floating, draggable shell
│   │   ├── Terminal.tsx           # xterm.js wrapper + WS plumbing
│   │   ├── Toolbar.tsx            # Pick / DOM / Route / Screenshot
│   │   ├── picker/
│   │   │   ├── PickerOverlay.tsx  # hover highlight + click capture
│   │   │   ├── fiber.ts           # walk React fiber tree
│   │   │   └── tags.ts            # tag string formatters
│   │   ├── screenshot.ts          # html2canvas wrapper, panel hide
│   │   ├── route.ts               # location + best-effort router lookup
│   │   └── ws-client.ts           # reconnect logic, message types
│   └── shared/
│       └── protocol.ts       # WS message types (Client/ServerMsg)
└── dist/                     # build output
```

Build via `tsup` (fast, dual ESM/CJS for the library + CJS bin).

## Component API

```tsx
import { ClaudeCodeDevTool } from 'claude-code-react-devtool'

<ClaudeCodeDevTool
  port={7777}              // optional, default 7777
  position="br"            // 'br' | 'bl' | 'tr' | 'tl', default 'br'
  hotkey="Ctrl+`"          // optional, default Ctrl+`
  defaultOpen={false}      // optional, default false (starts as launcher dot)
/>
```

The component renders nothing if `NODE_ENV === 'production'` or `import.meta.env.PROD` is true (best-effort detection across bundlers; the dev-only convention is documented in the README).

Panel anatomy:

- **Header**: drag handle, connection status pill (`⦿ connected · cwd: ~/projects/my-app`), minimize/close
- **Toolbar**: `🎯 Pick` · `🔲 DOM` · `📍 Route` · `📷 Screenshot`
- **Body**: xterm.js terminal, full width, vertically resizable

The panel uses a top-level portal with `z-index: 2147483000` (one notch below max), is draggable, and persists position to `localStorage` under `ccdt:layout`.

## Toolbar tags

Every toolbar action produces a **single text tag** that gets injected into the terminal stdin at the cursor (as `{ type: 'input', data: '<tag> ' }`). Tags are human-readable text, not magic — users can edit, delete, or combine them.

| Button | Behavior | Tag format |
| --- | --- | --- |
| 🎯 Pick | Hover overlay → click element → walk fiber to nearest named component | `[component: <Button> @ src/components/Button.tsx:42] ` |
| 🔲 DOM | Hover overlay → click element → serialize the DOM node + nearest source | `[element: <button class="cta primary" id="submit"> @ src/components/Button.tsx:48] ` |
| 📍 Route | No click; uses `location.pathname` + best-effort router lookup | `[route: /dashboard/settings] ` (optionally appended with file path) |
| 📷 Screenshot | Hides panel, captures viewport via html2canvas, sends to bridge | `[screenshot: .claude-code-devtool/screenshots/2026-05-18-143022.png] ` |

## Fiber walking

React attaches a fiber to every host DOM node under a key like `__reactFiber$<random>` (React 17+). Picker logic:

1. Click target → find the fiber on the DOM node (scan keys for `__reactFiber$` prefix).
2. Walk `fiber.return` upward until `typeof fiber.type === 'function'` or `'object'` (function/class component).
3. Component name: `type.displayName || type.name`.
4. Source: `fiber._debugSource` (set by `@babel/plugin-transform-react-jsx-source` or SWC's equivalent — Vite enables this in dev by default).
5. If `_debugSource` is missing: degrade gracefully to component-name-only tag, show a one-time toast: "Source info unavailable — make sure dev mode is on."

For DOM mode, we skip the upward walk: we capture the clicked element's tag/classes/id directly, plus the source location of the closest enclosing named component (so Claude has a file to open).

## Route detection (best-effort)

- Always: `window.location.pathname` is the canonical part of the tag.
- Enrichment: if React Router is detected (look for a `<Routes>` fiber, or `window.__reactRouterVersion`), surface the matched route's element source location. Otherwise skip.
- Other routers (TanStack, Next App Router) are explicitly out of scope for v1.

## Screenshot mechanism

1. User clicks 📷.
2. Panel sets `display: none` on its own root, waits one animation frame.
3. `html2canvas(document.body)` captures the viewport (we'll evaluate `dom-to-image-more` vs `html2canvas` during impl — both are viable).
4. Panel re-shows itself.
5. Convert canvas to PNG base64.
6. Send `{ type: 'screenshot', png: '<base64>', meta: { width, height } }` over WS.
7. Bridge writes the file to `<cwd>/.claude-code-devtool/screenshots/<ISO-timestamp>.png`.
8. Bridge replies `{ type: 'screenshot-saved', path: '.claude-code-devtool/screenshots/...' }`.
9. Panel injects the tag.

The bridge prunes screenshots older than 7 days on startup. The CLI banner suggests adding `.claude-code-devtool/` to `.gitignore`.

## Bridge server

Process lifecycle:

1. Parse argv.
2. Print banner: bridge URL, cwd, gitignore suggestion.
3. Start HTTP server on chosen port (default 7777). Try `port`, `port+1`, …, `port+4`; if all in use, error out with `--port` hint.
4. Endpoints:
   - `GET /health` → `{ ok: true, cwd, claudeVersion, sessionId }`
   - `WebSocket /ws`
5. **On first WS client connect**: spawn `claude` via `node-pty` with `cwd = process.cwd()`, `env = process.env`, plus `--dangerously-skip-permissions` if `--yolo`. Any args after `--` are forwarded to claude.
6. Stream PTY stdout → all connected clients. Forward client `input` → PTY stdin.
7. **On WS disconnect**: keep PTY alive. Reconnects replay scrollback (last 5000 lines, ring-buffered).
8. **On second concurrent client**: reject with WS close code `4001` + reason `"another tab is already connected"`.
9. **On PTY exit**: emit `{ type: 'exit', code }` to clients, then await a `restart` signal or CLI shutdown.
10. **On SIGINT/SIGTERM**: kill PTY, close server, exit.

## WebSocket protocol

```ts
// Client → Server
type ClientMsg =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'screenshot'; png: string; meta: { width: number; height: number } }
  | { type: 'restart' }                                   // spawn fresh PTY after exit

// Server → Client
type ServerMsg =
  | { type: 'hello'; sessionId: string; cwd: string; cols: number; rows: number }
  | { type: 'output'; data: string }                      // raw PTY bytes (ANSI included)
  | { type: 'screenshot-saved'; path: string }
  | { type: 'error'; message: string }
  | { type: 'exit'; code: number }
```

`sessionId` changes whenever the PTY restarts; the panel uses it to detect "this is a fresh session" and render a divider.

## CLI flags

```
npx claude-code-react-devtool [options] [-- ...claude args]

  --port <n>        WebSocket port (default 7777, auto-retries +1..+4)
  --host <addr>     Bind address (default 127.0.0.1)
  --cwd <path>      Working directory for claude (default cwd)
  --yolo            Pass --dangerously-skip-permissions to claude
  --no-banner       Skip startup banner
  -h, --help        Show help
```

Anything after `--` is forwarded verbatim to the `claude` CLI.

## Error handling

**Panel side:**

- First-connect failure: banner inside the panel — "Bridge not running. Did you start `npx claude-code-react-devtool`?" with a retry button.
- Mid-session drop: status pill turns yellow, exponential backoff (1s, 2s, 4s, …, capped at 10s). Scrollback stays visible.
- `sessionId` change after reconnect: render an inline divider in the terminal ("─── session restarted ───").
- Pick mode interaction with native page clicks: Esc cancels; clicking on the panel cancels; ignore `event.button !== 0`.
- z-index conflicts: panel uses `2147483000`; users can override via CSS.
- `_debugSource` missing: degrade gracefully; one-time toast.

**Bridge side:**

- `node-pty` native binary missing: print actionable platform-specific install hint, exit 1.
- `claude` not on PATH: print install link, exit 1.
- Port in use after 5 retries: print `--port` hint, exit 1.
- Screenshot write failure: reply with `{ type: 'error', message }`; no tag injected.
- PTY exit: reflected to clients; restart on explicit `{ type: 'restart' }`.

## Testing

- **Bridge (Vitest)**: WS message routing, port retry, screenshot write path, session id continuity, single-client policy, SIGINT cleanup. Mock `node-pty` with a stub that echoes input.
- **Fiber walker (Vitest + @testing-library/react)**: render fixture components, walk synthetic fiber trees, assert expected tag output. Test `_debugSource`-missing degradation.
- **Picker reducer (Vitest)**: pure state machine — idle → picking → resolved → idle.
- **WS protocol (Vitest)**: encoder/decoder, type guards.
- **End-to-end (Playwright)**: spin up a fixture Vite app with `<ClaudeCodeDevTool />`, start the bridge against a mock PTY (echo stub), drive each toolbar action, assert the right tag appears in the terminal buffer.
- **Manual smoke test** (documented in `CONTRIBUTING.md`): real `claude` against a real React app, walk through every toolbar action, verify permission prompts surface inside the terminal.
- **TDD discipline**: each unit (fiber walker, picker reducer, WS protocol, bridge state machine, screenshot module) gets tests written first.

## Out of scope (v1)

- Multi-tab support
- Production builds (dev-only convention)
- Mobile / touch
- Image paste through clipboard (only the screenshot button)
- Authoring custom slash commands inside the panel (use `~/.claude/commands/`)
- Non-React-Router router adapters

## Open questions

None blocking. The `html2canvas` vs `dom-to-image-more` choice is an implementation detail to resolve during build.
