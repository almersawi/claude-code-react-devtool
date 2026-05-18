import { createBridgeServer } from './server'
import { createPtySession, type PtySpawn } from './pty'
import { pruneOldScreenshots, SCREENSHOTS_SUBDIR } from './screenshots'

interface Args {
  port: number
  host: string
  cwd: string
  yolo: boolean
  banner: boolean
  claudeArgs: string[]
  help: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    port: 7777,
    host: '127.0.0.1',
    cwd: process.cwd(),
    yolo: false,
    banner: true,
    claudeArgs: [],
    help: false,
  }
  let passthrough = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (passthrough) { out.claudeArgs.push(a!); continue }
    switch (a) {
      case '--port': {
        const n = Number(argv[++i])
        if (!Number.isFinite(n) || n < 1 || n > 65535) {
          process.stderr.write(`--port must be an integer between 1 and 65535\n`)
          out.help = true
        } else {
          out.port = n
        }
        break
      }
      case '--host':  out.host = String(argv[++i]); break
      case '--cwd':   out.cwd = String(argv[++i]); break
      case '--yolo':  out.yolo = true; break
      case '--no-banner': out.banner = false; break
      case '-h': case '--help': out.help = true; break
      case '--': passthrough = true; break
      default:
        process.stderr.write(`Unknown flag: ${a}\n`)
        out.help = true
    }
  }
  return out
}

function help() {
  process.stdout.write(`Usage: claude-code-react-devtool [options] [-- ...claude args]

Options:
  --port <n>      WebSocket port (default 7777, retries +1..+4)
  --host <addr>   Bind address (default 127.0.0.1)
  --cwd <path>    Working directory for claude (default cwd)
  --yolo          Pass --dangerously-skip-permissions to claude
  --no-banner     Skip startup banner
  -h, --help      Show help
`)
}

async function tryListen(port: number, host: string): Promise<number | null> {
  const net = await import('node:net')
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(null))
    probe.listen(port, host, () => {
      probe.close(() => resolve(port))
    })
  })
}

async function pickPort(base: number, host: string): Promise<number> {
  for (let i = 0; i < 5; i++) {
    const p = await tryListen(base + i, host)
    if (p) return p
  }
  throw new Error(`No free port in range ${base}..${base + 4}. Use --port.`)
}

async function loadSpawn(): Promise<PtySpawn> {
  let nodePty: typeof import('node-pty')
  try {
    nodePty = await import('node-pty')
  } catch (e) {
    process.stderr.write(`Failed to load node-pty. On macOS try: npm rebuild node-pty\n${(e as Error).message}\n`)
    process.exit(1)
  }
  return (command, args, opts) =>
    nodePty.spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      cols: opts.cols,
      rows: opts.rows,
      name: 'xterm-256color',
    })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { help(); return }

  const port = await pickPort(args.port, args.host)
  const spawn = await loadSpawn()
  const claudeArgs = [...args.claudeArgs]
  if (args.yolo) claudeArgs.unshift('--dangerously-skip-permissions')

  const pty = createPtySession({
    spawn,
    command: 'claude',
    args: claudeArgs,
    cwd: args.cwd,
    env: process.env as Record<string, string | undefined>,
    cols: 120,
    rows: 30,
  })

  const server = await createBridgeServer({ host: args.host, port, pty, cwd: args.cwd })
  await pruneOldScreenshots({ cwd: args.cwd, maxAgeDays: 7 })

  if (args.banner) {
    process.stdout.write(`claude-code-react-devtool listening on ws://${args.host}:${port}/ws
cwd: ${args.cwd}
Add this to .gitignore:  ${SCREENSHOTS_SUBDIR.split('/')[0]}/

Press Ctrl+C to stop.
`)
  }

  const shutdown = async () => {
    pty.kill()
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((e) => {
  process.stderr.write(`${(e as Error).message}\n`)
  process.exit(1)
})
