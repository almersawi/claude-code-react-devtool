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
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal({ client }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      theme: { background: '#0f172a' },
    })
    termRef.current = term
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    const unsubOutput = client.on('output', (m) => term.write(m.data))
    const unsubHello = client.on('hello', (_m) => {
      client.send({ type: 'resize', cols: term.cols, rows: term.rows })
    })
    const onData = term.onData((d) => client.send({ type: 'input', data: d }))

    const onResize = () => {
      fit.fit()
      client.send({ type: 'resize', cols: term.cols, rows: term.rows })
    }
    window.addEventListener('resize', onResize)

    return () => {
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
