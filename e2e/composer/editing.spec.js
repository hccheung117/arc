// Gotchas:
// - Edit mode is triggered via IPC push (message:edit:start), not via UI interaction.
//   Real flow: right-click → native context menu → main pushes message:edit:start.
//   Tests use triggerEditMode() which pushes directly via webContents.send.
// - The message ID in triggerEditMode doesn't need to match a real message —
//   composerActions.setMode just stores it as an override. But pre-filling the editor
//   with the original message text won't work without a real message in the session.
// - Edit guard test is a contract test (verifies STATUS_FLAGS shape),
//   not a live streaming test — would require mocking session:send at the main process level.
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  typeInEditor, clearEditor, getEditorText,
  clickCancel, triggerEditMode,
  setupMainProcessMock, mockInvokeRouteHandler, sendMessage,
} from '../helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
})

test.afterAll(async () => {
  await electronApp?.close()
})

// ─── 3.1 Edit User Message ──────────────────────────────────────────────────

test.describe('3.1 Edit User Message', () => {
  test('trigger edit:user → header shows USER MESSAGE', async () => {
    await triggerEditMode(electronApp, 'user', 'test-user-msg')
    await window.waitForTimeout(500)

    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await expect(window.locator(sel.modeHeader).locator('span', { hasText: 'USER MESSAGE' })).toBeVisible()
  })

  test('toolbar shows Skill, Attach buttons (same as chat)', async () => {
    const footer = window.locator(sel.footer)
    await expect(footer.locator('svg.lucide-book-open').first()).toBeVisible()
    await expect(footer.locator('svg.lucide-image').first()).toBeVisible()
  })

  test('cancel → returns to chat mode without changes', async () => {
    await clickCancel(window)
    await window.waitForTimeout(300)
    await expect(window.locator(sel.modeHeader)).not.toBeVisible()
  })
})

// ─── 3.2 Edit AI Message ────────────────────────────────────────────────────

test.describe('3.2 Edit AI Message', () => {
  test('trigger edit:ai → header shows AI MESSAGE', async () => {
    await triggerEditMode(electronApp, 'assistant', 'test-ai-msg')
    await window.waitForTimeout(500)

    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await expect(window.locator(sel.modeHeader).locator('span', { hasText: 'AI MESSAGE' })).toBeVisible()
  })

  test('only Mic tool available (no Skill, Attach, Model)', async () => {
    const footer = window.locator(sel.footer)
    await expect(footer.locator('svg.lucide-book-open')).not.toBeVisible()
    await expect(footer.locator('svg.lucide-image')).not.toBeVisible()
  })

  test('cancel → returns to chat mode', async () => {
    await clickCancel(window)
    await window.waitForTimeout(300)
    await expect(window.locator(sel.modeHeader)).not.toBeVisible()
  })
})

// ─── 3.3 Edit Guards ────────────────────────────────────────────────────────

test.describe('3.3 Edit Guards', () => {
  test('edit mode is enterable when not streaming', async () => {
    await triggerEditMode(electronApp, 'user', 'test-user-msg')
    await window.waitForTimeout(500)
    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await clickCancel(window)
    await window.waitForTimeout(300)
  })
})

// ─── 3.4 Edit preserves linebreaks ──────────────────────────────────────────

test.describe('3.4 Edit preserves linebreaks', () => {
  const MULTI_LINE_REPLY = 'Line one.\n\nLine two.\n\nLine three.'
  const MSG_ID = 'mock-ai-linebreak-test'

  test.beforeAll(async () => {
    await setupMainProcessMock(electronApp)
    // Mock session:send with a fixed message ID and multi-line reply
    const escapedReply = JSON.stringify(MULTI_LINE_REPLY)
    await mockInvokeRouteHandler(electronApp, 'session:send', `
      const { sessionId, messages } = payload
      const BW = globalThis.__testBrowserWindow
      const win = BW.getAllWindows()[0]
      const push = (event) => {
        if (win && !win.isDestroyed()) win.webContents.send('ipc:push:session:state:feed', event)
      }
      push({ type: 'snapshot', sessionId, messages: messages || [], branches: {}, prompt: null, status: 'ready' })

      const id = ${JSON.stringify(MSG_ID)}
      const assistantMessage = { id, role: 'assistant', parts: [{ type: 'text', text: ${escapedReply} }] }

      setTimeout(() => push({ type: 'status', sessionId, status: 'streaming' }), 10)
      setTimeout(() => push({ type: 'tip', sessionId, message: assistantMessage }), 30)
      setTimeout(() => push({
        type: 'snapshot', sessionId,
        messages: [...(messages || []), assistantMessage],
        branches: {}, prompt: null, status: 'ready',
      }), 50)

      return { ok: true }
    `)
    // Send a message to get the multi-line AI reply into the session
    await sendMessage(window, 'test')
  })

  test('editor text preserves linebreaks when editing AI message', async () => {
    await triggerEditMode(electronApp, 'assistant', MSG_ID)
    await window.waitForTimeout(500)

    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await expect(window.locator(sel.modeHeader).locator('span', { hasText: 'AI MESSAGE' })).toBeVisible()

    const editorText = await getEditorText(window)
    // The editor should preserve the 3 separate lines
    const lines = editorText.split('\n').filter(l => l.trim() !== '')
    expect(lines.length).toBeGreaterThanOrEqual(3)
    expect(editorText).toContain('Line one.')
    expect(editorText).toContain('Line two.')
    expect(editorText).toContain('Line three.')
  })
})
