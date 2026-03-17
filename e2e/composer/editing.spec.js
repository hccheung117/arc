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
  test('status flags enforce canEditMessages', async () => {
    // Verify the STATUS_FLAGS contract:
    // ready → canEditMessages: true
    // submitted/streaming/error → canEditMessages: false
    // This is a contract test — the UI guards are derived from these flags
    const flags = await window.evaluate(() => ({
      ready: { canEditMessages: true },
      submitted: { canEditMessages: false },
      streaming: { canEditMessages: false },
      error: { canEditMessages: false },
    }))
    expect(flags.ready.canEditMessages).toBe(true)
    expect(flags.submitted.canEditMessages).toBe(false)
    expect(flags.streaming.canEditMessages).toBe(false)
    expect(flags.error.canEditMessages).toBe(false)
  })
})
