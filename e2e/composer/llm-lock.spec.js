// Gotchas:
// - Right-click on a message triggers React onContextMenu, which calls
//   window.api.call('message:context-menu', ...) via ipc:invoke.
//   trackInvokeRoute intercepts this to verify it was called.
// - mockHangingStream sends start+text but no finish — app stays in streaming
//   status until finishHangingStream or errorHangingStream.
// - Stop button has aria-label="Stop" (from PromptInputSubmit).
//   Submit button has aria-label="Submit". They are mutually exclusive.
// - SubmitOnEnter calls form.requestSubmit() even during streaming because
//   the type="submit" button is gone — the safety guard must be in the handler.
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  typeInEditor, clearEditor,
  switchToPromptMode, clickCancel, triggerEditMode,
  setupMainProcessMock, mockSendMessage, mockSavePrompt,
  sendMessage,
  mockHangingStream, finishHangingStream, errorHangingStream,
  trackInvokeRoute, getTrackedCalls, clearTrackedCalls,
} from '../helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
  await setupMainProcessMock(electronApp)

  // Seed one user+assistant message pair so we have content to right-click
  await mockSendMessage(electronApp, 'AI reply for testing')
  await sendMessage(window, 'Hello')
})

test.afterAll(async () => {
  await electronApp?.close()
})

// ─── A — Streaming: over-blocked actions ────────────────────────────────────

test.describe('A — Context menu and edit mode during streaming', () => {
  test.beforeAll(async () => {
    await trackInvokeRoute(electronApp, 'message:context-menu')
    // Enter streaming state
    await mockHangingStream(electronApp)
    await typeInEditor(window, 'trigger stream')
    await window.keyboard.press('Enter')
    // Wait for streaming assistant message to appear
    await window.locator(sel.assistantMessage).nth(1).waitFor({ state: 'visible', timeout: 5000 })
    await window.waitForTimeout(200)
  })

  test.afterAll(async () => {
    await finishHangingStream(electronApp)
    await window.waitForTimeout(500)
    await clickCancel(window)
    await window.waitForTimeout(300)
  })

  test('A1: right-click on message fires context-menu IPC during streaming', async () => {
    await clearTrackedCalls(electronApp, 'message:context-menu')
    await window.locator(sel.userMessage).first().click({ button: 'right' })
    await window.waitForTimeout(300)

    const calls = await getTrackedCalls(electronApp, 'message:context-menu')
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[0].role).toBe('user')
  })

  test('A2: edit mode enterable during streaming', async () => {
    await triggerEditMode(electronApp, 'user', 'test-user-msg')
    await window.waitForTimeout(500)

    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await expect(
      window.locator(sel.modeHeader).locator('span', { hasText: 'USER MESSAGE' })
    ).toBeVisible()

    await clickCancel(window)
    await window.waitForTimeout(300)
  })

  test('A3: submit button in prompt mode shows Submit (not Stop) during streaming', async () => {
    await switchToPromptMode(window)
    await window.waitForTimeout(300)

    // In prompt mode during streaming, the button should remain Submit
    // Current bug: PromptInputSubmit sees isGenerating=true and shows "Stop"
    await expect(window.locator(sel.submitBtn)).toBeVisible()
    await expect(window.locator(sel.stopBtn)).not.toBeVisible()

    await clickCancel(window)
    await window.waitForTimeout(300)
  })

  test('A4: prompt save works during streaming via button click', async () => {
    await switchToPromptMode(window)
    await window.waitForTimeout(300)
    await trackInvokeRoute(electronApp, 'session:save-prompt')

    await typeInEditor(window, 'My system prompt')
    await window.waitForTimeout(200)

    // Click the submit button — should be Submit in prompt mode, not Stop
    await window.locator(sel.submitBtn).click()
    await window.waitForTimeout(500)

    const calls = await getTrackedCalls(electronApp, 'session:save-prompt')
    expect(calls.length).toBeGreaterThanOrEqual(1)

    await clickCancel(window)
    await window.waitForTimeout(300)
  })

  test('A5: submit button in edit:ai mode shows Submit (not Stop) during streaming', async () => {
    await triggerEditMode(electronApp, 'assistant', 'test-ai-msg')
    await window.waitForTimeout(500)

    await expect(window.locator(sel.submitBtn)).toBeVisible()
    await expect(window.locator(sel.stopBtn)).not.toBeVisible()

    await clickCancel(window)
    await window.waitForTimeout(300)
  })
})

// ─── B — Error state: over-blocked actions ──────────────────────────────────

test.describe('B — Context menu during error state', () => {
  test.beforeAll(async () => {
    // Enter error state: start a stream then error it
    await mockHangingStream(electronApp)
    await typeInEditor(window, 'trigger error')
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)
    await errorHangingStream(electronApp)
    await window.waitForTimeout(500)

    await trackInvokeRoute(electronApp, 'message:context-menu')
  })

  test.afterAll(async () => {
    // Restore to a clean state
    await mockSendMessage(electronApp, 'Recovery message')
    await sendMessage(window, 'recover')
    await window.waitForTimeout(300)
  })

  test('B1: right-click on message fires context-menu IPC after error', async () => {
    await clearTrackedCalls(electronApp, 'message:context-menu')
    await window.locator(sel.userMessage).first().click({ button: 'right' })
    await window.waitForTimeout(300)

    const calls = await getTrackedCalls(electronApp, 'message:context-menu')
    expect(calls.length).toBeGreaterThanOrEqual(1)
  })

  test('B2: edit mode enterable after error', async () => {
    await triggerEditMode(electronApp, 'user', 'test-user-msg')
    await window.waitForTimeout(500)

    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await expect(
      window.locator(sel.modeHeader).locator('span', { hasText: 'USER MESSAGE' })
    ).toBeVisible()

    await clickCancel(window)
    await window.waitForTimeout(300)
  })
})

// ─── C — Stop button ────────────────────────────────────────────────────────

test.describe('C — Stop button behavior', () => {
  test('C1: stop button visible and enabled during streaming', async () => {
    await mockHangingStream(electronApp)
    await typeInEditor(window, 'trigger for stop test')
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)

    const stopBtn = window.locator(sel.stopBtn)
    await expect(stopBtn).toBeVisible({ timeout: 3000 })
    await expect(stopBtn).toBeEnabled()

    await finishHangingStream(electronApp)
    await window.waitForTimeout(500)
  })

  test('C2: submit button returns after stream finishes', async () => {
    await expect(window.locator(sel.submitBtn)).toBeVisible({ timeout: 3000 })
  })
})

// ─── D — Safety guards ─────────────────────────────────────────────────────

test.describe('D — New message blocked during streaming', () => {
  test.beforeAll(async () => {
    await mockHangingStream(electronApp)
    await typeInEditor(window, 'start streaming')
    await window.keyboard.press('Enter')
    await window.waitForTimeout(500)
  })

  test.afterAll(async () => {
    await finishHangingStream(electronApp)
    await window.waitForTimeout(500)
  })

  test('D1: typing and pressing Enter during streaming does NOT send a second message', async () => {
    // Install a counter on the invoke route to detect new session:send calls
    await electronApp.evaluate(() => {
      globalThis.__sendCallCount = 0
      const origHandler = globalThis.__testMockInvokeRoutes['session:send']
      globalThis.__testMockInvokeRoutes['session:send'] = (payload) => {
        globalThis.__sendCallCount++
        if (origHandler) return origHandler(payload)
      }
    })

    // Type and press Enter while streaming
    await typeInEditor(window, 'second message attempt')
    await window.keyboard.press('Enter')
    await window.waitForTimeout(500)

    // The guard should have prevented sending — count stays at 0
    const sendCount = await electronApp.evaluate(() => globalThis.__sendCallCount)
    expect(sendCount).toBe(0)
  })
})
