import { isServerMsg, type ClientMsg, type ServerMsg } from '../shared/protocol'

export type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

type EventMap = {
  status: Status
  hello: Extract<ServerMsg, { type: 'hello' }>
  output: Extract<ServerMsg, { type: 'output' }>
  'screenshot-saved': Extract<ServerMsg, { type: 'screenshot-saved' }>
  error: Extract<ServerMsg, { type: 'error' }>
  exit: Extract<ServerMsg, { type: 'exit' }>
}

export interface BridgeClientOpts {
  reconnectBaseMs?: number
  reconnectMaxMs?: number
}

export class BridgeClient {
  private ws: WebSocket | null = null
  private queue: string[] = []
  private subs: { [K in keyof EventMap]?: Set<(v: EventMap[K]) => void> } = {}
  private status: Status = 'idle'
  private explicitlyClosed = false
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private url: string, private opts: BridgeClientOpts = {}) {}

  on<K extends keyof EventMap>(ev: K, cb: (v: EventMap[K]) => void): () => void {
    if (!this.subs[ev]) {
      (this.subs as Record<string, Set<unknown>>)[ev] = new Set()
    }
    const set = this.subs[ev] as Set<(v: EventMap[K]) => void>
    set.add(cb)
    return () => set.delete(cb)
  }

  private emit<K extends keyof EventMap>(ev: K, v: EventMap[K]) {
    this.subs[ev]?.forEach((cb) => (cb as (v: EventMap[K]) => void)(v))
  }

  private setStatus(s: Status) {
    if (this.status === s) return
    this.status = s
    this.emit('status', s)
  }

  connect() {
    this.explicitlyClosed = false
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.attempt = 0
      this.setStatus('connected')
      for (const m of this.queue) ws.send(m)
      this.queue = []
    }
    ws.onmessage = (e) => {
      let parsed: unknown
      try { parsed = JSON.parse(typeof e.data === 'string' ? e.data : String(e.data)) } catch { return }
      if (!isServerMsg(parsed)) return
      this.emit(parsed.type, parsed as any)
    }
    ws.onclose = () => {
      this.ws = null
      if (this.explicitlyClosed) { this.setStatus('closed'); return }
      const base = this.opts.reconnectBaseMs ?? 1000
      const max = this.opts.reconnectMaxMs ?? 10_000
      const delay = Math.min(base * 2 ** this.attempt, max)
      this.attempt++
      this.setStatus('reconnecting')
      this.timer = setTimeout(() => this.connect(), delay)
    }
    ws.onerror = () => { /* close will follow */ }
  }

  send(msg: ClientMsg) {
    const data = JSON.stringify(msg)
    if (this.ws && this.ws.readyState === 1) this.ws.send(data)
    else this.queue.push(data)
  }

  close() {
    this.explicitlyClosed = true
    if (this.timer) clearTimeout(this.timer)
    this.ws?.close()
    this.setStatus('closed')
  }

  getStatus(): Status { return this.status }
}
