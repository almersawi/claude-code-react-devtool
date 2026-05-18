import { mkdir, writeFile, readdir, stat, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const SCREENSHOTS_SUBDIR = '.claude-code-devtool/screenshots'

export interface SaveScreenshotOpts {
  cwd: string
  base64: string
  timestamp: Date
}

export async function saveScreenshot(opts: SaveScreenshotOpts): Promise<string> {
  if (!opts.base64) throw new Error('screenshot base64 is empty')
  const stamp = opts.timestamp.toISOString().replace(/:/g, '-').replace(/\..+$/, 'Z')
  const rel = `${SCREENSHOTS_SUBDIR}/${stamp}.png`
  const abs = join(opts.cwd, rel)
  const dir = join(opts.cwd, SCREENSHOTS_SUBDIR)
  await mkdir(dir, { recursive: true })
  await writeFile(abs, Buffer.from(opts.base64, 'base64'))
  return rel
}

export interface PruneOpts {
  cwd: string
  maxAgeDays: number
}

export async function pruneOldScreenshots(opts: PruneOpts): Promise<number> {
  const dir = join(opts.cwd, SCREENSHOTS_SUBDIR)
  if (!existsSync(dir)) return 0
  const cutoff = Date.now() - opts.maxAgeDays * 24 * 60 * 60 * 1000
  const files = await readdir(dir)
  let deleted = 0
  for (const f of files) {
    const abs = join(dir, f)
    try {
      const s = await stat(abs)
      if (s.mtimeMs < cutoff) {
        await unlink(abs)
        deleted++
      }
    } catch { /* ignore */ }
  }
  return deleted
}
