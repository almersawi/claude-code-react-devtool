import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BridgeClient } from '../../../src/component/ws-client'

class FakeWS {
  static instances: FakeWS[] = []
  url: string
  readyState = 0
  onopen: (() => void) | null = null
  onclose: ((e: { code: number; reason: string }) => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  constructor(url: string) {
    this.url = url
    FakeWS.instances.push(this)
  }
  send(d: string) { this.sent.push(d) }
  close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '' }) }
  _open() { this.readyState = 1; this.onopen?.() }
  _msg(o: unknown) { this.onmessage?.({ data: JSON.stringify(o) }) }
  _close(code = 1006) { this.readyState = 3; this.onclose?.({ code, reason: '' }) }
}

beforeEach(() => {
  FakeWS.instances.length = 0
  vi.stubGlobal('WebSocket', FakeWS as any)
})

describe('BridgeClient', () => {
  it('connects and surfaces hello message', () => {
    const client = new BridgeClient('ws://x/ws', { reconnectBaseMs: 1 })
    const got: any[] = []
    client.on('hello', (m) => got.push(m))
    client.connect()
    FakeWS.instances[0]!._open()
    FakeWS.instances[0]!._msg({ type: 'hello', sessionId: 's', cwd: '/c', cols: 80, rows: 24 })
    expect(got).toHaveLength(1)
    expect(got[0].sessionId).toBe('s')
  })

  it('queues input and flushes on open', () => {
    const client = new BridgeClient('ws://x/ws', { reconnectBaseMs: 1 })
    client.connect()
    client.send({ type: 'input', data: 'ls\n' })
    FakeWS.instances[0]!._open()
    expect(FakeWS.instances[0]!.sent).toEqual([JSON.stringify({ type: 'input', data: 'ls\n' })])
  })

  it('reconnects with backoff on unexpected close', async () => {
    vi.useFakeTimers()
    const client = new BridgeClient('ws://x/ws', { reconnectBaseMs: 10 })
    client.connect()
    FakeWS.instances[0]!._open()
    FakeWS.instances[0]!._close(1006)
    expect(FakeWS.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(10)
    expect(FakeWS.instances).toHaveLength(2)
    vi.useRealTimers()
  })

  it('does not reconnect after explicit close', async () => {
    vi.useFakeTimers()
    const client = new BridgeClient('ws://x/ws', { reconnectBaseMs: 5 })
    client.connect()
    FakeWS.instances[0]!._open()
    client.close()
    await vi.advanceTimersByTimeAsync(50)
    expect(FakeWS.instances).toHaveLength(1)
    vi.useRealTimers()
  })

  it('emits status changes', () => {
    const client = new BridgeClient('ws://x/ws', { reconnectBaseMs: 1 })
    const statuses: string[] = []
    client.on('status', (s) => statuses.push(s))
    client.connect()
    FakeWS.instances[0]!._open()
    FakeWS.instances[0]!._close(1006)
    expect(statuses).toEqual(['connecting', 'connected', 'reconnecting'])
  })
})
