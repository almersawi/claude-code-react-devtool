import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'claude-code-react-devtool': resolve(__dirname, '../../../dist/component/index.js'),
    },
  },
})
