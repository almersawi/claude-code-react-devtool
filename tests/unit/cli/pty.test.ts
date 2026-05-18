import { describe, it, expect, vi } from 'vitest'
import { createPtySession, type PtySpawn } from '../../../src/cli/pty'

function makeFakePty(): { spawn: PtySpawn; emit: (data: string) => void; written: string[] } {
  const written: string[] = []
  let onData: (d: string) => void = () => {}
  let onExit: (e: { exitCode: number }) => void = () => {}
  const spawn: PtySpawn = () => ({
    onData: (cb) => { onData = cb },
    onExit: (cb) => { onExit = cb },
    write: (d) => { written.push(d) },
    resize: () => {},
    kill: () => { onExit({ exitCode: 0 }) },
    pid: 1,
  })
  return { spawn, emit: (d) => onData(d), written }
}

describe('createPtySession', () => {
  it('forwards output bytes from pty to subscribers', () => {
    const { spawn, emit } = makeFakePty()
    const session = session_with(spawn)
    const received: string[] = []
    session.onOutput((d) => received.push(d))
    emit('hello')
    expect(received).toEqual(['hello'])
  })

  it('replays scrollback to late subscribers', () => {
    const { spawn, emit } = makeFakePty()
    const session = session_with(spawn)
    emit('line-one\n')
    emit('line-two\n')
    const received: string[] = []
    session.onOutput((d) => received.push(d))
    expect(received.join('')).toBe('line-one\nline-two\n')
  })

  it('trims scrollback ring to maxLines', () => {
    const { spawn, emit } = makeFakePty()
    const session = session_with(spawn, { maxLines: 2 })
    emit('a\nb\nc\n')
    const received: string[] = []
    session.onOutput((d) => received.push(d))
    expect(received.join('')).toBe('b\nc\n')
  })

  it('write() forwards to pty stdin', () => {
    const { spawn, written } = makeFakePty()
    const session = session_with(spawn)
    session.write('ls\n')
    expect(written).toEqual(['ls\n'])
  })

  it('emits exit event when pty exits', () => {
    const { spawn } = makeFakePty()
    const session = session_with(spawn)
    let exited: number | undefined
    session.onExit((code) => { exited = code })
    session.kill()
    expect(exited).toBe(0)
  })

  function session_with(spawn: PtySpawn, opts?: { maxLines?: number }) {
    return createPtySession({
      spawn,
      command: 'claude',
      args: [],
      cwd: '/tmp',
      env: {},
      cols: 80,
      rows: 24,
      maxLines: opts?.maxLines,
    })
  }
})
