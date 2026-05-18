import { test, expect } from '@playwright/test'
import { startMockBridge } from './mock-bridge'

test('pick component injects a component tag', async ({ page }) => {
  const bridge = startMockBridge(8765)
  try {
    await page.goto('/')
    // wait for the panel + ws hello
    await page.waitForSelector('text=connected')
    await page.getByRole('button', { name: /pick/i }).click()
    await page.getByTestId('big-btn').click()
    await expect.poll(() => bridge.received.join(''), { timeout: 10000 }).toContain('[component: <Button>')
  } finally {
    await bridge.close()
  }
})

test('route button injects pathname tag', async ({ page }) => {
  const bridge = startMockBridge(8765)
  try {
    await page.goto('/some/path')
    await page.waitForSelector('text=connected')
    await page.getByRole('button', { name: /route/i }).click()
    await expect.poll(() => bridge.received.join(''), { timeout: 10000 }).toContain('[route: /some/path]')
  } finally {
    await bridge.close()
  }
})
