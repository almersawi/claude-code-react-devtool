import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import WebSocket from 'ws'
import { createBridgeServer, type BridgeServer } from '../../../src/cli/server'
import { createPtySession } from '../../../src/cli/pty'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function fakeSpawn() {
  let onData: (d: string) => void = () => {}
  let onExit: (e: { exitCode: number }) => void = () => {}
  const written: string[] = []
  return {
    spawn: () => ({
      onData: (cb: any) => { onData = cb },
      onExit: (cb: any) => { onExit = cb },
      write: (d: string) => { written.push(d) },
      resize: () => {},
      kill: () => onExit({ exitCode: 0 }),
      pid: 1,
    }),
    emit: (d: string) => onData(d),
    exit: (code: number) => onExit({ exitCode: code }),
    written,
  }
}

async function connect(port: number): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function nextMessage<T = any>(ws: WebSocket): Promise<T> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw.toString())))
  })
}

/** Connect and return a WebSocket that buffers ALL messages received from the
 *  moment the socket is created (before 'open' fires), so no frames are lost
 *  due to the async gap between open and attaching listeners. */
async function connectBuffered(port: number): Promise<{ ws: WebSocket; take(): Promise<any> }> {
  const queue: any[] = []
  const waiters: Array<(v: any) => void> = []

  function enqueue(msg: any) {
    if (waiters.length) {
      waiters.shift()!(msg)
    } else {
      queue.push(msg)
    }
  }

  function take(): Promise<any> {
    if (queue.length) return Promise.resolve(queue.shift())
    return new Promise((resolve) => waiters.push(resolve))
  }

  const ws = await new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    // Attach message listener BEFORE resolving so no frames are missed.
    ws.on('message', (raw) => enqueue(JSON.parse(raw.toString())))
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })

  return { ws, take }
}

describe('createBridgeServer', () => {
  let server: BridgeServer
  let f: ReturnType<typeof fakeSpawn>
  let cwd: string

  beforeEach(async () => {
    cwd = mkdtempSync(join(tmpdir(), 'ccdt-'))
    f = fakeSpawn()
    const pty = createPtySession({
      spawn: f.spawn, command: 'claude', args: [], cwd, env: {}, cols: 80, rows: 24,
    })
    server = await createBridgeServer({ host: '127.0.0.1', port: 0, pty, cwd })
  })

  afterEach(async () => { await server.close() })

  it('sends a hello message to a new client', async () => {
    const ws = await connect(server.port)
    const msg = await nextMessage(ws)
    expect(msg.type).toBe('hello')
    expect(msg.cwd).toBe(cwd)
    expect(typeof msg.sessionId).toBe('string')
    ws.close()
  })

  it('forwards PTY output to clients', async () => {
    const ws = await connect(server.port)
    await nextMessage(ws) // hello
    f.emit('hi there')
    const msg = await nextMessage(ws)
    expect(msg).toEqual({ type: 'output', data: 'hi there' })
    ws.close()
  })

  it('routes client input to PTY', async () => {
    const ws = await connect(server.port)
    await nextMessage(ws) // hello
    ws.send(JSON.stringify({ type: 'input', data: 'ls\n' }))
    await new Promise((r) => setTimeout(r, 30))
    expect(f.written).toContain('ls\n')
    ws.close()
  })

  it('accepts multiple concurrent clients and broadcasts pty output to all', async () => {
    const a = await connect(server.port)
    await nextMessage(a) // hello on a
    const b = await connect(server.port)
    await nextMessage(b) // hello on b
    expect(a.readyState).toBe(WebSocket.OPEN)
    expect(b.readyState).toBe(WebSocket.OPEN)
    f.emit('hi all')
    const [msgA, msgB] = await Promise.all([nextMessage(a), nextMessage(b)])
    expect(msgA).toEqual({ type: 'output', data: 'hi all' })
    expect(msgB).toEqual({ type: 'output', data: 'hi all' })
    a.close()
    b.close()
  })

  it('accepts a fresh client after the previous one disconnects', async () => {
    const { ws: a, take: takeA } = await connectBuffered(server.port)
    await takeA() // hello on a
    a.close()
    await new Promise((r) => setTimeout(r, 50))
    const { ws: b, take } = await connectBuffered(server.port)
    const msg = await take()
    expect(msg.type).toBe('hello')
    b.close()
  }, 10_000)

  it('GET /health returns ok', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/health`)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.cwd).toBe(cwd)
  })

  it('sends hello before replayed pty output', async () => {
    // Emit PTY output BEFORE the client connects. The next client will receive
    // it as scrollback replay — and that replay must come AFTER the hello.
    f.emit('pre-connect output\n')
    // Use connectBuffered so the message listener is registered before the
    // WebSocket 'open' promise resolves, ensuring no frames are missed even
    // when the server sends hello + replay in the same event-loop tick.
    const { ws, take } = await connectBuffered(server.port)
    const first = await take()
    expect(first.type).toBe('hello')
    const second = await take()
    expect(second).toEqual({ type: 'output', data: 'pre-connect output\n' })
    ws.close()
  })
})
