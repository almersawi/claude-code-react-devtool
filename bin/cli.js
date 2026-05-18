#!/usr/bin/env node
import('../dist/cli/index.cjs').catch((e) => {
  process.stderr.write(`${e && e.message ? e.message : e}\n`)
  process.exit(1)
})
