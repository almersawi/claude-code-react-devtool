import { useEffect, useMemo, useRef, useState } from 'react'
import { Panel } from './Panel'
import { Toolbar, type PickerMode } from './Toolbar'
import { Terminal, type TerminalHandle } from './Terminal'
import { PickerOverlay } from './picker/PickerOverlay'
import { findComponentForNode } from './picker/fiber'
import { componentTag, elementTag, screenshotTag } from './picker/tags'
import { BridgeClient, type Status } from './ws-client'
import { captureViewportBase64 } from './screenshot'

export interface ClaudeCodeDevToolProps {
  port?: number
  host?: string
  defaultOpen?: boolean
  hotkey?: string
}

function isProduction(): boolean {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return true
  } catch { /* ignore */ }
  return false
}

export function ClaudeCodeDevTool(props: ClaudeCodeDevToolProps = {}) {
  if (isProduction()) return null
  const port = props.port ?? 7777
  const host = props.host ?? '127.0.0.1'
  const url = `ws://${host}:${port}/ws`

  const client = useMemo(() => new BridgeClient(url, { reconnectBaseMs: 1000 }), [url])
  const [status, setStatus] = useState<Status>('idle')
  const [cwd, setCwd] = useState<string>('…')
  const [pickerActive, setPickerActive] = useState<PickerMode>('none')
  const [open, setOpen] = useState(props.defaultOpen ?? false)
  const panelRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<TerminalHandle>(null)

  useEffect(() => {
    const off1 = client.on('status', setStatus)
    const off2 = client.on('hello', (m) => setCwd(m.cwd))
    client.connect()
    return () => { off1(); off2(); client.close() }
  }, [client])

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
    if (pickerActive === 'component') {
      const info = findComponentForNode(el)
      if (info) inject(componentTag(info))
    } else if (pickerActive === 'dom') {
      const tag = el.tagName.toLowerCase()
      const id = el.id || null
      const classes = el.className && typeof el.className === 'string'
        ? el.className.split(/\s+/).filter(Boolean) : []
      const component = findComponentForNode(el)
      inject(elementTag({ tag, id, classes, component }))
    }
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

  if (!open) {
    return (
      <button data-ccdt-ignore onClick={() => setOpen(true)} style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 2147483000,
        width: 40, height: 40, borderRadius: 20, border: 'none',
        background: '#0284c7', color: 'white', fontSize: 18, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>⚙</button>
    )
  }

  return (
    <>
      <div ref={panelRef}>
        <Panel status={status} cwd={cwd}>
          <Toolbar
            onInject={inject}
            onScreenshotRequest={handleScreenshot}
            pickerActive={pickerActive}
            setPickerActive={setPickerActive}
          />
          <Terminal ref={termRef} client={client} />
        </Panel>
      </div>
      {pickerActive !== 'none' && (
        <PickerOverlay onPick={handlePick} onCancel={() => setPickerActive('none')} />
      )}
    </>
  )
}
