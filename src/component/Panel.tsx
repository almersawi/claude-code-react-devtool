import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Status } from './ws-client'

const LAYOUT_KEY = 'ccdt:layout'

interface Layout { x: number; y: number; w: number; h: number }

const DEFAULT_LAYOUT: Layout = { x: 24, y: 24, w: 640, h: 400 }

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_LAYOUT
}

function saveLayout(l: Layout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)) } catch { /* ignore */ }
}

const STATUS_COLORS: Record<Status, string> = {
  idle: '#64748b', connecting: '#eab308', connected: '#22c55e',
  reconnecting: '#eab308', closed: '#ef4444',
}

export interface PanelProps {
  status: Status
  cwd: string
  children: ReactNode
}

export function Panel({ status, cwd, children }: PanelProps) {
  const [layout, setLayout] = useState<Layout>(() => loadLayout())
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  useEffect(() => { saveLayout(layout) }, [layout])

  function onHeaderMouseDown(e: React.MouseEvent) {
    dragRef.current = { dx: e.clientX - layout.x, dy: e.clientY - layout.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setLayout((l) => ({ ...l, x: ev.clientX - dragRef.current!.dx, y: ev.clientY - dragRef.current!.dy }))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div data-ccdt-ignore style={{
      position: 'fixed', left: layout.x, top: layout.y, width: layout.w, height: layout.h,
      zIndex: 2147483000, background: '#0f172a', color: '#e2e8f0',
      border: '1px solid #1e293b', borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}>
      <div onMouseDown={onHeaderMouseDown} style={{
        cursor: 'move', padding: '6px 10px', background: '#1e293b',
        display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none', fontSize: 12,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: 4, background: STATUS_COLORS[status], display: 'inline-block',
        }} />
        <span>{status}</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span style={{ opacity: 0.8 }}>{cwd}</span>
      </div>
      {children}
    </div>
  )
}
