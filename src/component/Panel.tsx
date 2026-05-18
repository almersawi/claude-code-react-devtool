import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Status } from './ws-client'

const LAYOUT_KEY = 'ccdt:layout'
const DEFAULT_HEIGHT = 360
const MIN_HEIGHT = 140

interface Layout { height: number }
const DEFAULT_LAYOUT: Layout = { height: DEFAULT_HEIGHT }

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
  route?: string
  onClose?: () => void
  children: ReactNode
}

export function Panel({ status, cwd, route, onClose, children }: PanelProps) {
  const [height, setHeight] = useState(() => loadLayout().height)
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null)

  useEffect(() => { saveLayout({ height }) }, [height])

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    resizeRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dy = resizeRef.current.startY - ev.clientY
      const maxH = Math.floor(window.innerHeight * 0.92)
      const next = Math.max(MIN_HEIGHT, Math.min(maxH, resizeRef.current.startH + dy))
      setHeight(next)
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div data-ccdt-ignore style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, height,
      zIndex: 2147483000,
      background: '#000000', color: '#e2e8f0',
      borderTop: '1px solid #1e293b',
      boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.35)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}>
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 6,
          cursor: 'ns-resize', zIndex: 1,
        }}
        aria-hidden
      />
      <div style={{
        padding: '8px 12px', background: '#000000',
        borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', gap: 8,
        userSelect: 'none', fontSize: 12, position: 'relative',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: 4, background: STATUS_COLORS[status], display: 'inline-block',
        }} />
        <span>{status}</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span style={{ opacity: 0.95, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} title={cwd}>
          {route ?? cwd}
        </span>
        <div style={{ flex: 1 }} />
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close Claude devtool"
            style={{
              background: 'transparent', color: '#94a3b8', border: 'none',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 6px',
            }}
          >
            ×
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
