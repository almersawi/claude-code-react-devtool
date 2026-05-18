export interface PtyProc {
  onData(cb: (data: string) => void): void
  onExit(cb: (e: { exitCode: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
  pid: number
}

export type PtySpawn = (
  command: string,
  args: string[],
  opts: { cwd: string; env: Record<string, string>; cols: number; rows: number },
) => PtyProc

export interface PtySession {
  onOutput(cb: (data: string) => void): () => void
  onExit(cb: (code: number) => void): () => void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

export interface CreatePtySessionOpts {
  spawn: PtySpawn
  command: string
  args: string[]
  cwd: string
  env: Record<string, string | undefined>
  cols: number
  rows: number
  maxLines?: number
}

const DEFAULT_MAX_LINES = 5000

export function createPtySession(opts: CreatePtySessionOpts): PtySession {
  const maxLines = opts.maxLines ?? DEFAULT_MAX_LINES
  const cleanEnv: Record<string, string> = {}
  for (const [k, v] of Object.entries(opts.env)) {
    if (typeof v === 'string') cleanEnv[k] = v
  }
  const proc = opts.spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env: cleanEnv,
    cols: opts.cols,
    rows: opts.rows,
  })

  const ring: string[] = []
  let buf = ''
  const outputSubs = new Set<(d: string) => void>()
  const exitSubs = new Set<(c: number) => void>()

  proc.onData((data) => {
    buf += data
    let idx: number
    while ((idx = buf.indexOf('\n')) !== -1) {
      ring.push(buf.slice(0, idx + 1))
      buf = buf.slice(idx + 1)
      if (ring.length > maxLines) ring.shift()
    }
    for (const cb of outputSubs) cb(data)
  })

  proc.onExit((e) => {
    for (const cb of exitSubs) cb(e.exitCode)
  })

  return {
    onOutput(cb) {
      const replay = ring.join('') + buf
      if (replay.length) cb(replay)
      outputSubs.add(cb)
      return () => outputSubs.delete(cb)
    },
    onExit(cb) {
      exitSubs.add(cb)
      return () => exitSubs.delete(cb)
    },
    write(data) { proc.write(data) },
    resize(cols, rows) { proc.resize(cols, rows) },
    kill() { proc.kill() },
  }
}
