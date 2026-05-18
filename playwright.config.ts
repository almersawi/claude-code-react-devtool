import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5174' },
  webServer: {
    command: 'npm run dev --prefix tests/e2e/fixture',
    port: 5174,
    reuseExistingServer: false,
  },
})
