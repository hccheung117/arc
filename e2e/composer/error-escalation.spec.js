// Tests for the three error escalation bugs:
// - Bug #1: router.js has no .catch() on stream handler promise
// - Bug #3: UI never renders error.message when status === 'error'
//
// These tests FAIL before fixes and PASS after.
// Bug #2 (route-level catches) shares the same symptom as #1 — covered by B1.
//
// Error flow: main sends { type: 'error', errorText } → IpcTransport enqueues
// the chunk → AI SDK processUIMessageStream wraps it: new Error(chunk.errorText)
// → Chat catches it → setStatus({ status: 'error', error }) → ErrorBanner reads
// error.message. So errorText on the wire becomes error.message in React.
//
// B1 note: the mock infrastructure (setupMainProcessMock) must mirror the real
// router's error handling. Both wrap handlers in Promise.resolve().catch() so
// that synchronous throws produce an error chunk instead of crashing silently.
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  typeInEditor,
  setupMainProcessMock, mockSendMessage, mockStreamRoute,
  sendMessage,
  mockHangingStream, errorHangingStream,
} from '../helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
  await setupMainProcessMock(electronApp)
  await mockSendMessage(electronApp, 'Seed reply')
  await sendMessage(window, 'Seed message')
})

test.afterAll(async () => {
  await electronApp?.close()
})

// ─── A — Error banner visibility (Bug #3) ─────────────────────────────────────

test.describe('A — Error banner', () => {
  test.describe.configure({ mode: 'serial' })

  test('A1: error text visible after stream error', async () => {
    // errorHangingStream sends { type: 'error', errorText: 'Mock error' }.
    // The AI SDK converts this to an Error object — ErrorBanner should
    // render error.message ("Mock error") when status === 'error'.
    await mockHangingStream(electronApp)
    await typeInEditor(window, 'trigger error')
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)
    await errorHangingStream(electronApp)
    await window.waitForTimeout(500)

    await expect(window.locator('text=Mock error')).toBeVisible({ timeout: 3000 })
  })

  test('A2: error text disappears after successful retry', async () => {
    // A new successful request resets status to 'ready', clearing the banner.
    await mockSendMessage(electronApp, 'Recovery reply')
    await sendMessage(window, 'retry')

    await expect(window.locator('text=Mock error')).not.toBeVisible({ timeout: 3000 })
  })
})

// ─── B — Pre-stream throw (Bug #1) ────────────────────────────────────────────

test.describe('B — Pre-stream throw', () => {
  test.afterAll(async () => {
    // Restore working mock so app is usable after this block
    await mockSendMessage(electronApp, 'Post-throw recovery')
    await sendMessage(window, 'recover')
    await window.waitForTimeout(300)
  })

  test('B1: handler throw before any chunk does not freeze UI', async () => {
    // Mock session:send to throw before sending any chunk.
    // This simulates modelFor/prepareMessages throwing (Bug #1/#2).
    // Without a catch-all, the throw is unhandled — the renderer never
    // receives a chunk and stays stuck in 'submitted' indefinitely.
    await mockStreamRoute(electronApp, 'session:send', `
      throw new Error('Provider initialization failed')
    `)

    await typeInEditor(window, 'trigger throw')
    await window.keyboard.press('Enter')

    // If stuck in 'submitted': WaitingShimmer shows, submit button hidden.
    // If error is caught: status → 'error', submit button returns.
    await expect(window.locator(sel.submitBtn)).toBeVisible({ timeout: 5000 })
  })
})
