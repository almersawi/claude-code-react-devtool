import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/component/index.ts' },
    outDir: 'dist/component',
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
  },
  {
    entry: { index: 'src/cli/index.ts' },
    outDir: 'dist/cli',
    format: ['cjs'],
    sourcemap: true,
    target: 'node20',
    external: ['node-pty'],
  },
])
