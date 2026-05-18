import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import type { BridgeClient } from './ws-client'

export interface TerminalHandle {
  inject: (text: string) => void
  focus: () => void
}

export interface TerminalProps {
  client: BridgeClient
  /** Transform/augment input before it goes to the PTY. Called per onData chunk. */
  onBeforeInput?: (data: string) => string
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal({ client, onBeforeInput }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      theme: { background: '#000000' },
    })
    termRef.current = term
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)

    let disposed = false

    const safeFit = () => {
      if (disposed) return
      // FitAddon throws "Cannot read properties of undefined (reading 'dimensions')"
      // when the container has 0 dimensions or the renderer hasn't initialised yet.
      // Skip silently; the ResizeObserver / hello listener will retry.
      const { clientWidth, clientHeight } = container
      if (clientWidth < 4 || clientHeight < 4) return
      try { fit.fit() } catch { /* renderer not ready */ }
    }

    // Defer initial fit past the current commit so layout has settled.
    const rafId = requestAnimationFrame(safeFit)

    const unsubOutput = client.on('output', (m) => term.write(m.data))
    const unsubHello = client.on('hello', () => {
      safeFit()
      if (term.cols && term.rows) client.send({ type: 'resize', cols: term.cols, rows: term.rows })
    })
    const onData = term.onData((d) => {
      const out = onBeforeInput ? onBeforeInput(d) : d
      if (out) client.send({ type: 'input', data: out })
    })

    const onResize = () => {
      safeFit()
      if (term.cols && term.rows) client.send({ type: 'resize', cols: term.cols, rows: term.rows })
    }
    window.addEventListener('resize', onResize)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    observer?.observe(container)

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      observer?.disconnect()
      window.removeEventListener('resize', onResize)
      unsubOutput(); unsubHello(); onData.dispose()
      term.dispose()
      termRef.current = null
    }
  }, [client])

  useImperativeHandle(ref, () => ({
    inject: (text: string) => {
      client.send({ type: 'input', data: text })
    },
    focus: () => termRef.current?.focus(),
  }), [client])

  return <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
})
