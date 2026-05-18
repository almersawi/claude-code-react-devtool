# claude-code-react-devtool

In-app Claude Code panel for React. Click a component, type what you want, hit enter — Claude already has the file, line, props, route, and (optionally) a screenshot.

## Install

```bash
npm i -D claude-code-react-devtool
```

In `App.tsx`:

```tsx
import { ClaudeCodeDevTool } from 'claude-code-react-devtool'

export default function App() {
  return (
    <>
      <YourApp />
      {import.meta.env.DEV && <ClaudeCodeDevTool defaultOpen />}
    </>
  )
}
```

Add `.claude-code-devtool/` to your `.gitignore`.

## Run

In another terminal, from your project root:

```bash
npx claude-code-react-devtool
```

Skip all permission prompts:

```bash
npx claude-code-react-devtool --dangerously-skip-permissions
```

Open your app. The panel docks at the bottom. Click **Pick Component** → click an element → type your prompt.

## License

MIT.
