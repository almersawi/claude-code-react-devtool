# claude-code-react-devtool

In-app Claude Code panel for React dev mode. Drop a `<ClaudeCodeDevTool />` into your `App.tsx`, run `npx claude-code-react-devtool` in another terminal, and you get a docked panel at the bottom of your page with the real `claude` CLI inside — plus one-click context for the component you picked, the route you're on, and screenshots.

## Install

```bash
npm i -D claude-code-react-devtool
```

## Use

In your app entry:

```tsx
import { ClaudeCodeDevTool } from 'claude-code-react-devtool'

function App() {
  return (
    <>
      <YourApp />
      {import.meta.env.DEV && <ClaudeCodeDevTool defaultOpen />}
    </>
  )
}
```

Then in another terminal, from your project root:

```bash
npx claude-code-react-devtool
```

Open your app in the browser. The panel is docked at the bottom; drag the top edge to resize, click × to collapse to a small launcher pill at the bottom-right.

## What's in the panel

- **Pick Component** — click any element on the page → the tag `[component: <Name key="..." prop="..."> @ src/path.tsx:line — "visible text"]` is injected into Claude's input. Disambiguates between multiple instances of the same component using props, React key, and the picked element's visible text.
- **Screenshot** — captures the viewport (panel hidden), saves to `.claude-code-devtool/screenshots/`, and injects the path. Claude reads the PNG via its `Read` tool.
- **Route auto-injection** — every prompt you submit is automatically tagged with `[route: /current/path]`. Slash commands (`/clear`, `/help`, etc.) and empty submissions pass through clean.

The first time the bridge runs, it copies a small skill to `~/.claude/skills/claude-code-react-devtool/SKILL.md`. That skill tells Claude to treat the tags as authoritative context — open the referenced file immediately, read the screenshot, use the route as ambient context — instead of asking "which component did you mean?". It's idempotent: subsequent runs won't overwrite your edits.

## CLI flags

```
npx claude-code-react-devtool [options] [-- ...claude args]

  --port <n>                        WebSocket port (default 7777, retries +1..+4)
  --host <addr>                     Bind address (default 127.0.0.1)
  --cwd <path>                      Working directory for claude (default cwd)
  --yolo
  --dangerously-skip-permissions    Skip all permission prompts in claude
  --no-banner                       Skip startup banner
  -h, --help                        Show help
```

Anything after `--` is forwarded verbatim to the `claude` CLI.

## Component props

```tsx
<ClaudeCodeDevTool
  port={7777}              // WebSocket port (default 7777)
  host="127.0.0.1"         // WebSocket host
  defaultOpen={false}      // start expanded vs. collapsed launcher pill
  hotkey="Ctrl+`"          // toggle panel visibility
  autoInjectRoute={true}   // append [route: /path] on every prompt (default true)
/>
```

## .gitignore

Add to your project's `.gitignore`:

```
.claude-code-devtool/
```

## How it works

```
┌─ Your React app ─────────────────────────────────────────┐
│  <ClaudeCodeDevTool />                                   │
│   ├ floating bottom-docked panel                         │
│   ├ xterm.js terminal                                    │
│   └ WebSocket client (singleton per host:port)           │
└────────────────┬─────────────────────────────────────────┘
                 │ ws://127.0.0.1:7777/ws
                 ▼
┌─ npx claude-code-react-devtool (Node bridge) ────────────┐
│  HTTP + WS server  ◄──►  node-pty  ◄──►  claude CLI      │
│  - multi-client broadcast (page reloads stay clean)      │
│  - keeps PTY alive across WS disconnects                 │
│  - scrollback ring replays on (re)connect                │
│  - prunes screenshots > 7 days on startup                │
└──────────────────────────────────────────────────────────┘
```

The PTY makes `claude` think it's running in a real terminal, so all your `~/.claude` config — skills, hooks, MCP servers, plugins, slash commands, permission prompts — works exactly as it does on the command line.

## Troubleshooting

- **`posix_spawnp failed.`** — node-pty's `darwin-arm64` prebuild is missing or the bundled `spawn-helper` lost its executable bit during extraction. Run `chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper`, or `npm rebuild node-pty` to build from source.
- **WS status stuck on `connecting`** — the bridge process isn't listening on the expected port. Check the terminal where you ran `npx claude-code-react-devtool` (it auto-retries 7777..7781 if 7777 is busy and prints the chosen port).
- **Component tag has no `@ path:line`** — your bundler isn't emitting JSX source info. Vite's React plugin does this in dev by default; if you're on a custom Babel/SWC setup, enable `@babel/plugin-transform-react-jsx-source` (or its SWC equivalent).

## Limitations

- Dev-mode only. The component renders nothing in production.
- Source locations (`@ path:line`) depend on the bundler emitting JSX source info — works on Vite + `@vitejs/plugin-react` in dev.
- React Router enrichment of route tags is best-effort; framework-specific routers (Next App Router, TanStack Router) are not yet integrated — the URL path is always included.
- macOS `darwin-arm64` users may need `npm rebuild node-pty` on first install (upstream node-pty doesn't ship that prebuild as of 1.1.0).

## License

MIT.
