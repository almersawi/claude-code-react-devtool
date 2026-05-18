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

  it('rejects a second concurrent client with code 4001', async () => {
    const a = await connect(server.port)
    await nextMessage(a)
    const b = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    const code = await new Promise<number>((resolve) => {
      b.once('close', (c) => resolve(c))
    })
    expect(code).toBe(4001)
    a.close()
  })

  it('emits exit and accepts a second client after disconnect', async () => {
    const a = await connect(server.port)
    await nextMessage(a)
    a.close()
    await new Promise((r) => setTimeout(r, 30))
    const b = await connect(server.port)
    const msg = await nextMessage(b)
    expect(msg.type).toBe('hello')
    b.close()
  })

  it('GET /health returns ok', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/health`)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.cwd).toBe(cwd)
  })
})
