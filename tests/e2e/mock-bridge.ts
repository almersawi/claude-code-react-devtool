import { WebSocketServer } from 'ws'
import { randomUUID } from 'node:crypto'

export function startMockBridge(port: number) {
  const wss = new WebSocketServer({ port })
  const received: string[] = []
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello', sessionId: randomUUID(), cwd: '/mock', cols: 80, rows: 24 }))
    ws.on('message', (raw) => {
      try {
        const m = JSON.parse(raw.toString())
        if (m.type === 'input') received.push(m.data)
      } catch { /* ignore */ }
    })
  })
  return { received, close: () => new Promise<void>((r) => wss.close(() => r())) }
}
