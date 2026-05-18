import { useEffect, useRef, useState } from 'react'
import { Panel } from './Panel'
import { Toolbar, type PickerMode } from './Toolbar'
import { Terminal, type TerminalHandle } from './Terminal'
import { PickerOverlay } from './picker/PickerOverlay'
import { findComponentForNode } from './picker/fiber'
import { componentTag, routeTag, screenshotTag } from './picker/tags'
import { detectRoute } from './route'
import { BridgeClient, type Status } from './ws-client'
import { captureViewportBase64 } from './screenshot'

export interface ClaudeCodeDevToolProps {
  port?: number
  host?: string
  defaultOpen?: boolean
  hotkey?: string
  /**
   * When true (default), append `[route: /current/path]` to every user prompt
   * before it reaches the Claude CLI. Slash commands and empty lines are
   * skipped. Set to `false` to disable.
   */
  autoInjectRoute?: boolean
}

function isProduction(): boolean {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return true
  } catch { /* ignore */ }
  return false
}

// One BridgeClient per (host, port) URL. We stash the registry on globalThis so
// that duplicate module loads (Vite HMR retaining an old copy, ESM-vs-CJS dual
// resolution, etc.) all see the SAME client and don't end up creating two
// connections that fight each other under the bridge's "newer wins" policy.
const GLOBAL_KEY = '__ccdt_shared_clients_v1__'
const sharedClients: Map<string, BridgeClient> = (() => {
  const g = globalThis as unknown as Record<string, unknown>
  const existing = g[GLOBAL_KEY] as Map<string, BridgeClient> | undefined
  if (existing) return existing
  const fresh = new Map<string, BridgeClient>()
  g[GLOBAL_KEY] = fresh
  return fresh
})()

function getSharedClient(url: string): BridgeClient {
  let c = sharedClients.get(url)
  if (!c) {
    c = new BridgeClient(url, { reconnectBaseMs: 1000 })
    c.connect()
    sharedClients.set(url, c)
  }
  return c
}

export function ClaudeCodeDevTool(props: ClaudeCodeDevToolProps = {}) {
  if (isProduction()) return null
  const port = props.port ?? 7777
  const host = props.host ?? '127.0.0.1'
  const url = `ws://${host}:${port}/ws`

  const client = getSharedClient(url)
  const [status, setStatus] = useState<Status>(client.getStatus())
  const [cwd, setCwd] = useState<string>('…')
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  )
  const [pickerActive, setPickerActive] = useState<PickerMode>('none')
  const [open, setOpen] = useState(props.defaultOpen ?? false)
  const panelRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<TerminalHandle>(null)

  useEffect(() => {
    const off1 = client.on('status', setStatus)
    const off2 = client.on('hello', (m) => setCwd(m.cwd))
    return () => { off1(); off2() }
  }, [client])

  // Track route changes across popstate AND programmatic pushState/replaceState
  // so the panel header reflects the current page no matter how the host app
  // navigates (React Router, TanStack Router, manual history calls...).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    const origPush = window.history.pushState
    const origReplace = window.history.replaceState
    window.history.pushState = function (...a: Parameters<typeof origPush>) {
      origPush.apply(this, a)
      update()
    }
    window.history.replaceState = function (...a: Parameters<typeof origReplace>) {
      origReplace.apply(this, a)
      update()
    }
    return () => {
      window.removeEventListener('popstate', update)
      window.history.pushState = origPush
      window.history.replaceState = origReplace
    }
  }, [])

  useEffect(() => {
    if (!props.hotkey) return
    const match = props.hotkey.toLowerCase()
    const onKey = (e: KeyboardEvent) => {
      const combo = `${e.ctrlKey ? 'ctrl+' : ''}${e.metaKey ? 'meta+' : ''}${e.key.toLowerCase()}`
      if (combo === match) { e.preventDefault(); setOpen((o) => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.hotkey])

  function inject(tag: string) {
    client.send({ type: 'input', data: tag })
  }

  function handlePick(el: Element) {
    const info = findComponentForNode(el)
    if (info) inject(componentTag(info))
    setPickerActive('none')
  }

  async function handleScreenshot() {
    const off = client.on('screenshot-saved', (m) => {
      inject(screenshotTag(m.path))
      off()
    })
    const cap = await captureViewportBase64({ hide: panelRef.current })
    client.send({ type: 'screenshot', png: cap.png, meta: { width: cap.width, height: cap.height } })
  }

  // Track keystrokes since the last Enter so we can detect slash commands and
  // empty lines, and skip auto-injecting the route on those.
  const lineBufRef = useRef('')
  const autoInjectRoute = props.autoInjectRoute !== false

  function beforeInput(d: string): string {
    if (!autoInjectRoute) return d
    if (d === '\r') {
      const line = lineBufRef.current
      lineBufRef.current = ''
      const trimmed = line.trim()
      if (!trimmed) return d
      if (trimmed.startsWith('/')) return d
      // Append the route as a trailing tag before the Enter so Claude sees it
      // as part of the user message. Trim the trailing space the tag normally
      // carries so it sits flush against the Enter.
      const tag = routeTag(detectRoute()).trimEnd()
      return ` ${tag}\r`
    }
    if (d === '\x7f' || d === '\b') {
      lineBufRef.current = lineBufRef.current.slice(0, -1)
    } else if (d === '\x03' || d === '\x15') {
      // Ctrl-C or Ctrl-U: line aborted/killed
      lineBufRef.current = ''
    } else if (d.length === 1 && d >= ' ') {
      lineBufRef.current += d
    } else if (d.length > 1 && !d.startsWith('\x1b')) {
      // Likely a paste; track printable chars only.
      for (const c of d) if (c >= ' ') lineBufRef.current += c
    }
    return d
  }

  if (!open) {
    return (
      <button
        data-ccdt-ignore
        onClick={() => setOpen(true)}
        aria-label="Open Claude devtool"
        style={{
          position: 'fixed', right: 12, bottom: 12, zIndex: 2147483000,
          height: 32, padding: '0 12px', borderRadius: 16, border: 'none',
          background: '#0f172a', color: '#e2e8f0',
          fontSize: 12, fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontWeight: 500, letterSpacing: 0.2,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: 4,
          background: status === 'connected' ? '#22c55e'
            : status === 'reconnecting' || status === 'connecting' ? '#eab308'
            : '#ef4444',
        }} />
        Claude
      </button>
    )
  }

  return (
    <>
      <div ref={panelRef}>
        <Panel status={status} cwd={cwd} route={pathname} onClose={() => setOpen(false)}>
          <Toolbar
            onScreenshotRequest={handleScreenshot}
            pickerActive={pickerActive}
            setPickerActive={setPickerActive}
          />
          <Terminal ref={termRef} client={client} onBeforeInput={beforeInput} />
        </Panel>
      </div>
      {pickerActive !== 'none' && (
        <PickerOverlay onPick={handlePick} onCancel={() => setPickerActive('none')} />
      )}
    </>
  )
}
