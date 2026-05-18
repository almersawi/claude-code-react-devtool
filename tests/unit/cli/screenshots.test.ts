import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync, existsSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveScreenshot, pruneOldScreenshots, SCREENSHOTS_SUBDIR } from '../../../src/cli/screenshots'

describe('saveScreenshot', () => {
  let cwd: string
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'ccdt-'))
  })

  it('writes a PNG from base64 and returns a relative path', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')
    const rel = await saveScreenshot({ cwd, base64: png, timestamp: new Date('2026-05-18T14:30:22Z') })
    expect(rel).toBe(`${SCREENSHOTS_SUBDIR}/2026-05-18T14-30-22Z.png`)
    const abs = join(cwd, rel)
    expect(existsSync(abs)).toBe(true)
    const written = readFileSync(abs)
    expect(written.slice(0, 4).toString('hex')).toBe('89504e47')
  })

  it('creates the directory if missing', async () => {
    const png = Buffer.from('x').toString('base64')
    const rel = await saveScreenshot({ cwd, base64: png, timestamp: new Date() })
    expect(existsSync(join(cwd, rel))).toBe(true)
  })

  it('rejects when base64 is empty', async () => {
    await expect(saveScreenshot({ cwd, base64: '', timestamp: new Date() }))
      .rejects.toThrow(/empty/i)
  })
})

describe('pruneOldScreenshots', () => {
  let cwd: string
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'ccdt-'))
  })

  it('deletes files older than maxAgeDays', async () => {
    // create dir + two files, age one of them 30 days
    await saveScreenshot({ cwd, base64: Buffer.from('a').toString('base64'), timestamp: new Date() })
    const old = await saveScreenshot({ cwd, base64: Buffer.from('b').toString('base64'), timestamp: new Date(Date.now() + 1) })
    const oldAbs = join(cwd, old)
    const past = (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    utimesSync(oldAbs, past, past)

    const deleted = await pruneOldScreenshots({ cwd, maxAgeDays: 7 })
    expect(deleted).toBe(1)
    expect(existsSync(oldAbs)).toBe(false)
  })

  it('returns 0 when directory does not exist', async () => {
    const deleted = await pruneOldScreenshots({ cwd, maxAgeDays: 7 })
    expect(deleted).toBe(0)
  })
})
