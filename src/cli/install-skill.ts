import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const SKILL_REL_DEST = '.claude/skills/claude-code-react-devtool/SKILL.md'

export interface InstallSkillResult {
  status: 'installed' | 'already-present' | 'skipped'
  path: string
  reason?: string
}

/**
 * Copies the bundled `skills/SKILL.md` into the user's
 * `~/.claude/skills/claude-code-react-devtool/SKILL.md` on first run.
 *
 * Idempotent: never overwrites an existing file, so users can hand-edit the
 * skill and it won't be clobbered on subsequent CLI launches.
 */
export async function installSkillIfMissing(opts?: { sourceDir?: string }): Promise<InstallSkillResult> {
  const dest = join(homedir(), SKILL_REL_DEST)

  try {
    await access(dest)
    return { status: 'already-present', path: dest }
  } catch { /* not present → install */ }

  const sourceDir = opts?.sourceDir ?? join(__dirname, '..', '..', 'skills')
  const src = join(sourceDir, 'SKILL.md')

  let content: string
  try {
    content = await readFile(src, 'utf8')
  } catch (e) {
    return { status: 'skipped', path: dest, reason: `bundled skill not found at ${src}: ${(e as Error).message}` }
  }

  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, content, 'utf8')
  return { status: 'installed', path: dest }
}
