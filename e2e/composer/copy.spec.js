// Gotchas:
// - Right-click triggers onContextMenu → window.api.call('message:context-menu', ...)
// - The fix adds a `selection` field to the IPC payload containing
//   window.getSelection().toString() at the time of right-click.
// - When no text is selected, `selection` should be '' so the main process
//   falls back to copying the full message text.
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  setupMainProcessMock, mockSendMessage, sendMessage,
  trackInvokeRoute, getTrackedCalls, clearTrackedCalls,
} from '../helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
  await setupMainProcessMock(electronApp)

  // Seed a message with known text so we can select a subset
  await mockSendMessage(electronApp, 'Alpha Beta Gamma')
  await sendMessage(window, 'Hello')

  await trackInvokeRoute(electronApp, 'message:context-menu')
})

test.afterAll(async () => {
  await electronApp?.close()
})

test('copy with text selected sends selection in IPC payload', async () => {
  await clearTrackedCalls(electronApp, 'message:context-menu')

  const msgEl = window.locator(sel.assistantMessage).first()

  // Select "Beta" and dispatch contextmenu in one evaluate to avoid
  // Playwright's mousedown clearing the selection before the event fires.
  await msgEl.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const idx = node.textContent.indexOf('Beta')
      if (idx !== -1) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + 'Beta'.length)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
        break
      }
    }
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 }))
  })
  await window.waitForTimeout(300)

  const calls = await getTrackedCalls(electronApp, 'message:context-menu')
  expect(calls.length).toBeGreaterThanOrEqual(1)
  expect(calls[0].selection).toBe('Beta')
})

test('copy with no selection sends empty selection', async () => {
  await clearTrackedCalls(electronApp, 'message:context-menu')

  // Clear any selection
  await window.evaluate(() => window.getSelection().removeAllRanges())

  const msgEl = window.locator(sel.assistantMessage).first()
  await msgEl.click({ button: 'right' })
  await window.waitForTimeout(300)

  const calls = await getTrackedCalls(electronApp, 'message:context-menu')
  expect(calls.length).toBeGreaterThanOrEqual(1)
  expect(calls[0].selection).toBe('')
})
