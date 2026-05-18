import { createServer, type Server as HttpServer } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'
import { saveScreenshot } from './screenshots'
import { isClientMsg, type ServerMsg } from '../shared/protocol'
import type { PtySession } from './pty'

export interface BridgeServer {
  port: number
  close(): Promise<void>
  sessionId: string
}

export interface CreateBridgeOpts {
  host: string
  port: number
  pty: PtySession
  cwd: string
}

export async function createBridgeServer(opts: CreateBridgeOpts): Promise<BridgeServer> {
  const sessionId = randomUUID()
  const cols = 80
  const rows = 24

  const http: HttpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, cwd: opts.cwd, sessionId }))
      return
    }
    res.statusCode = 404
    res.end()
  })

  // Track open sockets so we can destroy them on close
  const openSockets = new Set<Socket>()
  http.on('connection', (socket) => {
    openSockets.add(socket)
    socket.once('close', () => openSockets.delete(socket))
  })

  const wss = new WebSocketServer({ noServer: true })
  let active: WebSocket | null = null
  let unsubOutput: (() => void) | null = null
  let unsubExit: (() => void) | null = null

  function send(ws: WebSocket, msg: ServerMsg) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  http.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws') {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (active) {
        ws.close(4001, 'another tab is already connected')
        return
      }
      active = ws
      // setTimeout (rather than setImmediate) ensures hello is sent after the
      // TCP round-trip completes, so the client's 'open' event and 'message'
      // listeners are both registered before the payload arrives.
      // Subscriptions are established inside the same callback so that any
      // buffered/scrollback output emitted synchronously by onOutput arrives
      // AFTER the hello message, not before.
      setTimeout(() => {
        send(ws, { type: 'hello', sessionId, cwd: opts.cwd, cols, rows })
        unsubOutput = opts.pty.onOutput((data) => send(ws, { type: 'output', data }))
        unsubExit = opts.pty.onExit((code) => send(ws, { type: 'exit', code }))
      }, 0)

      ws.on('message', async (raw) => {
        let parsed: unknown
        try { parsed = JSON.parse(raw.toString()) } catch { return }
        if (!isClientMsg(parsed)) return
        switch (parsed.type) {
          case 'input':   opts.pty.write(parsed.data); break
          case 'resize':  opts.pty.resize(parsed.cols, parsed.rows); break
          case 'restart': /* handled at CLI level */ break
          case 'screenshot':
            try {
              const path = await saveScreenshot({
                cwd: opts.cwd, base64: parsed.png, timestamp: new Date(),
              })
              send(ws, { type: 'screenshot-saved', path })
            } catch (e) {
              send(ws, { type: 'error', message: (e as Error).message })
            }
            break
        }
      })

      ws.on('close', () => {
        if (active === ws) active = null
        unsubOutput?.(); unsubExit?.()
      })
    })
  })

  await new Promise<void>((resolve) => http.listen(opts.port, opts.host, resolve))
  const addr = http.address()
  const port = typeof addr === 'object' && addr ? addr.port : opts.port

  return {
    port,
    sessionId,
    close: () =>
      new Promise<void>((resolve) => {
        if (active) active.terminate()
        for (const socket of openSockets) socket.destroy()
        openSockets.clear()
        wss.close(() => http.close(() => resolve()))
      }),
  }
}
