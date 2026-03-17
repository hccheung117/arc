// Gotchas:
// - switchToPromptMode toggles (Drama button). If already in prompt mode, it goes to chat.
// - clickCancel returns to chat mode from prompt/edit modes. It no-ops if Cancel isn't visible.
// - Drafts are per-mode per-session. Chat and prompt mode each have their own draft.
//   Edit modes (edit:user, edit:ai) reset on entry.
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  typeInEditor, clearEditor, getEditorText,
  switchToPromptMode, clickCancel,
} from '../helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
})

test.afterAll(async () => {
  await electronApp?.close()
})

// ─── 2.3 Draft Persistence Per Mode ──────────────────────────────────────────

test.describe('2.3 Draft Persistence Per Mode', () => {
  test('type in chat mode, switch to prompt mode, switch back → chat draft preserved', async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)

    // Type in chat mode
    await typeInEditor(window, 'My chat draft')
    await window.waitForTimeout(200)
    expect(await getEditorText(window)).toContain('My chat draft')

    // Switch to prompt mode
    await switchToPromptMode(window)
    await window.waitForTimeout(300)

    // Editor should NOT contain chat draft
    expect(await getEditorText(window)).not.toContain('My chat draft')

    // Type in prompt mode
    await typeInEditor(window, 'My prompt draft')
    await window.waitForTimeout(200)

    // Cancel back to chat
    await clickCancel(window)
    await window.waitForTimeout(300)

    // Chat draft should be preserved
    expect(await getEditorText(window)).toContain('My chat draft')
  })

  test('prompt mode draft persists across chat→prompt→chat→prompt', async () => {
    // Switch to prompt mode
    await switchToPromptMode(window)
    await window.waitForTimeout(300)
    await clearEditor(window)
    await typeInEditor(window, 'Persistent prompt')
    await window.waitForTimeout(200)

    // Cancel to chat
    await clickCancel(window)
    await window.waitForTimeout(300)

    // Switch back to prompt
    await switchToPromptMode(window)
    await window.waitForTimeout(300)

    // Prompt draft should be preserved
    expect(await getEditorText(window)).toContain('Persistent prompt')

    // Clean up
    await clickCancel(window)
    await window.waitForTimeout(300)
    await clearEditor(window)
  })
})
