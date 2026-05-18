# claude-code-react-devtool

**Stop typing file paths. Point at what you mean.**

Claude Code is great in the terminal — but every time you want it to change something visible in your React app, you're translating from the browser back to the file system in your head. "Which file is this button in again? `Header.tsx`? `Nav.tsx`? Let me grep..." Then you type the path, type a vague description, hit enter, hope Claude inferred the right component out of four with the same name.

This devtool collapses that loop. **Open your app, click the thing, type what you want.** Claude already has the file, the line, the props, the route, and (if you want) a screenshot.

---

## What it does

It drops a docked panel into the bottom of your React app in dev mode. Inside the panel is a real `claude` session — same skills, same hooks, same MCP servers, same permission prompts as your normal terminal. The difference is what gets handed to Claude every time you talk to it.

### Before

You see a broken button on `/dashboard`. You switch to your terminal:

```
> the secondary button on the dashboard looks wrong, can you fix it?
> oh wait, it's in src/pages/Dashboard.tsx around line 80 i think
> actually maybe src/components/ui/Button.tsx? let me check
```

Three turns wasted on coordinates.

### After

You see the broken button. You click **Pick Component**, click the button, type `make this match the primary style`. What Claude actually receives:

```
make this match the primary style [component: <SecondaryButton variant="ghost" disabled={false}> @ src/components/ui/SecondaryButton.tsx:42 — "Cancel"] [route: /dashboard]
```

It opens the file, sees the variant, reads the styling around line 42, and changes it. One turn.

---

## The three things that make it work

### 1. Point-and-tag, not point-and-describe

The **Pick Component** button enters a hover-highlight mode like browser devtools. Click anything on the page and the panel injects a structured tag with everything that uniquely identifies that instance — the component name, its file and line, its React `key`, its primitive props, and the visible text of what you clicked. When there are eight `<MetricTile>` instances on a page, Claude knows which one because the tag includes `label="P95 LATENCY"` and the text `"412 ms"`. No more "which one did you mean?"

### 2. Your URL is part of every prompt

You don't tell Claude where you are; the tool does. Every prompt is automatically suffixed with `[route: /current/path]`. Navigate to a new page and the next prompt carries the new context for free. Slash commands (`/clear`, `/init`, `/help`) pass through clean — Claude doesn't see noise.

### 3. Screenshots become first-class context

Click **Screenshot** and the panel hides itself, captures the viewport, writes a PNG into your project, and injects a reference. Now you can say things like "why does this look wrong" instead of describing a layout in three sentences. Claude reads the PNG and you keep typing.

---

## Same Claude. Same setup. Same trust boundaries.

This isn't a re-implementation of Claude Code or a custom UI on top of the API. It's the actual `claude` CLI running inside a PTY, piped to an `xterm.js` terminal in your page. That means:

- Your skills, hooks, MCP servers, plugins, and `~/.claude` configuration all work unchanged.
- Permission prompts ("allow Claude to edit X?") show up exactly the same way and you confirm them the same way.
- Slash commands work. Custom commands work. `/clear` works. `--resume` works.
- When you want the no-prompts mode, run with `--dangerously-skip-permissions` (or its shorter alias `--yolo`). The startup banner tells you when you're in that mode so you don't forget.

On first launch the bridge installs a small skill into `~/.claude/skills/` that teaches Claude how to use the injected tags — open the referenced file immediately, treat the screenshot as visual context, never echo the tags back as a question. It's idempotent: hand-edit the skill and subsequent launches won't overwrite it.

---

## Try it

```bash
npm i -D claude-code-react-devtool
```

In your `App.tsx`:

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

In another terminal, from your project root:

```bash
npx claude-code-react-devtool
```

Open your app. Click a thing. Type. Done.

Add `.claude-code-devtool/` to your `.gitignore`.

---

## Component API

```tsx
<ClaudeCodeDevTool
  port={7777}              // bridge port (default 7777)
  host="127.0.0.1"         // bridge host
  defaultOpen={false}      // start expanded, or as a collapsed launcher pill
  hotkey="Ctrl+`"          // keyboard shortcut to toggle the panel
  autoInjectRoute={true}   // suffix every prompt with [route: /path] (default true)
/>
```

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

Anything after `--` is forwarded to the `claude` CLI.

---

## Architecture, in one diagram

```
┌─ Your React app (any dev server, any router) ────────────┐
│  <ClaudeCodeDevTool />                                   │
│   ├─ bottom-docked floating panel, draggable height      │
│   ├─ xterm.js terminal (real Claude Code TUI)            │
│   └─ singleton WebSocket per (host, port)                │
└────────────────┬─────────────────────────────────────────┘
                 │  ws://127.0.0.1:7777/ws
                 ▼
┌─ npx claude-code-react-devtool (Node bridge) ────────────┐
│  HTTP + WS server ◄──► node-pty ◄──► claude CLI          │
│  · multi-client broadcast (page reloads stay clean)      │
│  · PTY survives WS disconnects (scrollback replays)      │
│  · auto-installs the SKILL.md on first run               │
│  · screenshots saved to .claude-code-devtool/            │
└──────────────────────────────────────────────────────────┘
```

Nothing fancy: a PTY, a WebSocket, and one focused React component. The intelligence is the tag content, not the wiring.

---

## Troubleshooting

- **`posix_spawnp failed.`** — node-pty 1.1.0 ships a `darwin-arm64` prebuild but npm sometimes drops the executable bit on `spawn-helper` during install. Run `chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper`, or `npm rebuild node-pty` to rebuild from source.
- **Status stuck on `connecting`** — the bridge process isn't listening on the expected port. Check the terminal where you ran `npx claude-code-react-devtool` (it auto-retries 7777..7781 and prints the chosen port).
- **Component tag has no `@ path:line`** — your bundler isn't emitting JSX source info. Vite's React plugin enables this in dev by default; for custom Babel/SWC setups, enable `@babel/plugin-transform-react-jsx-source` or its SWC equivalent.

---

## Limitations (honest)

- Dev-mode only. The component renders nothing in production builds.
- Source locations depend on the bundler emitting JSX source info — universal on Vite + `@vitejs/plugin-react` in dev, ymmv elsewhere.
- Route enrichment is best-effort; the URL path is always included, but mapping that path back to a specific page-component file is router-specific and not yet implemented.
- macOS arm64 users may need `npm rebuild node-pty` on first install (upstream prebuild metadata issue, not ours).

---

## License

MIT. Use it however you want.
