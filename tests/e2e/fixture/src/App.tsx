import { ClaudeCodeDevTool } from 'claude-code-react-devtool'

export function Button({ children }: { children: string }) {
  return (
    <button data-testid="big-btn" style={{
      position: 'fixed', bottom: 16, right: 80, padding: '8px 16px',
    }}>{children}</button>
  )
}

export function App() {
  return (
    <div>
      <h1>Fixture</h1>
      <Button>Hello</Button>
      <ClaudeCodeDevTool port={8765} defaultOpen />
    </div>
  )
}
