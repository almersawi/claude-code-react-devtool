import { useEffect, useState } from 'react'

export interface PickerOverlayProps {
  onPick: (el: Element) => void
  onCancel: () => void
}

export function PickerOverlay({ onPick, onCancel }: PickerOverlayProps) {
  const [hover, setHover] = useState<DOMRect | null>(null)

  useEffect(() => {
    function inIgnored(el: Element | null): boolean {
      let cur = el
      while (cur) {
        if (cur instanceof HTMLElement && cur.hasAttribute('data-ccdt-ignore')) return true
        cur = cur.parentElement
      }
      return false
    }

    function onMove(e: MouseEvent) {
      const t = e.target as Element | null
      if (!t || inIgnored(t)) { setHover(null); return }
      setHover(t.getBoundingClientRect())
    }

    function onClick(e: MouseEvent) {
      if (e.button !== 0) return
      const t = e.target as Element | null
      e.preventDefault()
      e.stopPropagation()
      if (!t || inIgnored(t)) { onCancel(); return }
      onPick(t)
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }

    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onPick, onCancel])

  return (
    <div data-ccdt-ignore style={{
      position: 'fixed', inset: 0, zIndex: 2147482999,
      cursor: 'crosshair', pointerEvents: 'none',
    }}>
      {hover && (
        <div style={{
          position: 'fixed',
          left: hover.left, top: hover.top, width: hover.width, height: hover.height,
          outline: '2px solid #38bdf8', background: 'rgba(56, 189, 248, 0.1)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}
