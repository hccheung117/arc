// Gotchas:
// - injectSettings must include { favorites: [] } or ModelSelectorButton crashes
//   ("Cannot read properties of undefined (reading 'some')").
// - PromptInputHeader uses data-align="block-end" + order-first CSS, not "block-start".
//   Use sel.modeHeader (.order-first) to target it.
// - switchToPromptMode toggles — calling it twice goes back to chat.
// - Refine mock goes through setupMainProcessMock (main process intercept),
//   not page.evaluate (window.api is frozen).
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  typeInEditor, clearEditor, getEditorText, getEditorPlaceholder,
  switchToPromptMode, clickCancel,
  setupMainProcessMock, mockSendMessage, mockRefine, mockPromoteCalls, mockSavePrompt,
  injectSettings, triggerEditMode, sendMessage,
} from '../helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
})

test.afterAll(async () => {
  await electronApp?.close()
})

// ─── 1.1 Chat Mode (default) ────────────────────────────────────────────────

test.describe('1.1 Chat Mode', () => {
  test('no header rendered', async () => {
    await expect(window.locator(sel.modeHeader)).not.toBeVisible()
  })

  test('placeholder shows "How can I help you today?"', async () => {
    const text = await getEditorPlaceholder(window)
    expect(text).toBe('How can I help you today?')
  })

  test('toolbar shows Skill and Attach buttons', async () => {
    const footer = window.locator(sel.footer)
    await expect(footer.locator('svg.lucide-book-open').first()).toBeVisible()
    await expect(footer.locator('svg.lucide-image').first()).toBeVisible()
  })

  test('submit button shows with aria-label "Submit"', async () => {
    await expect(window.locator(sel.submitBtn)).toBeVisible()
  })

  test('dark shadow on composer form', async () => {
    const form = window.locator(sel.form)
    const classes = await form.getAttribute('class')
    expect(classes).toContain('rgba(0,0,0,0.3)')
  })
})

// ─── 1.2 Edit:User Mode ─────────────────────────────────────────────────────

test.describe('1.2 Edit:User Mode', () => {
  test('header visible with "USER MESSAGE"', async () => {
    await triggerEditMode(electronApp, 'user', 'test-user-msg')
    await window.waitForTimeout(500)

    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await expect(window.locator(sel.modeHeader).locator('span', { hasText: 'USER MESSAGE' })).toBeVisible()
  })

  test('cancel button visible', async () => {
    await expect(window.locator('button', { hasText: 'Cancel' })).toBeVisible()
  })

  test('toolbar shows Skill, Attach buttons (same as chat)', async () => {
    const footer = window.locator(sel.footer)
    await expect(footer.locator('svg.lucide-book-open').first()).toBeVisible()
    await expect(footer.locator('svg.lucide-image').first()).toBeVisible()
  })

  test('cancel → returns to chat mode', async () => {
    await clickCancel(window)
    await window.waitForTimeout(300)
    await expect(window.locator(sel.modeHeader)).not.toBeVisible()
  })
})

// ─── 1.3 Edit:AI Mode ───────────────────────────────────────────────────────

test.describe('1.3 Edit:AI Mode', () => {
  test('header visible with "AI MESSAGE"', async () => {
    await triggerEditMode(electronApp, 'assistant', 'test-ai-msg')
    await window.waitForTimeout(500)

    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await expect(window.locator(sel.modeHeader).locator('span', { hasText: 'AI MESSAGE' })).toBeVisible()
  })

  test('cancel button visible', async () => {
    await expect(window.locator('button', { hasText: 'Cancel' })).toBeVisible()
  })

  test('toolbar does NOT show Skill or Attach buttons', async () => {
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

// ─── 1.4 Prompt Mode ────────────────────────────────────────────────────────

test.describe('1.4 Prompt Mode', () => {
  test('header visible with "SYSTEM PROMPT"', async () => {
    await switchToPromptMode(window)
    await window.waitForTimeout(300)

    await expect(window.locator(sel.modeHeader)).toBeVisible({ timeout: 3000 })
    await expect(window.locator(sel.modeHeader).locator('span', { hasText: 'SYSTEM PROMPT' })).toBeVisible()
  })

  test('Promote and Cancel actions visible', async () => {
    await expect(window.locator('button', { hasText: 'Promote' })).toBeVisible()
    await expect(window.locator('button', { hasText: 'Cancel' })).toBeVisible()
  })

  test('Refine button hidden when refine-prompt assignment absent', async () => {
    // Ensure no refine assignment
    await injectSettings(electronApp, { assignmentKeys: [] })
    await window.waitForTimeout(300)
    await expect(window.locator('button', { hasText: 'Refine' })).not.toBeVisible()
  })

  test('Refine button visible when refine-prompt assignment present', async () => {
    await injectSettings(electronApp, { assignmentKeys: ['refine-prompt'] })
    await window.waitForTimeout(300)
    await expect(window.locator('button', { hasText: 'Refine' })).toBeVisible()
    // Clean up
    await injectSettings(electronApp, { assignmentKeys: [] })
    await window.waitForTimeout(300)
  })

  test('placeholder shows "How would you like me to behave?"', async () => {
    const text = await getEditorPlaceholder(window)
    expect(text).toBe('How would you like me to behave?')
  })

  test('toolbar does NOT show Skill or Attach buttons', async () => {
    const footer = window.locator(sel.footer)
    await expect(footer.locator('svg.lucide-book-open')).not.toBeVisible()
    await expect(footer.locator('svg.lucide-image')).not.toBeVisible()
  })

  test('red shadow on composer form', async () => {
    const form = window.locator(sel.form)
    const classes = await form.getAttribute('class')
    expect(classes).toContain('rgba(255,0,0,0.3)')
  })

  test.afterAll(async () => {
    await clickCancel(window)
    await window.waitForTimeout(300)
  })
})

// ─── 1.5 Refine ─────────────────────────────────────────────────────────────

test.describe('1.5 Refine', () => {
  test('click Refine → button changes to Stop, streaming text appears, finish restores', async () => {
    await switchToPromptMode(window)
    await window.waitForTimeout(300)
    await injectSettings(electronApp, { assignmentKeys: ['refine-prompt'] })
    await window.waitForTimeout(300)

    // Set up mock for refine
    await setupMainProcessMock(electronApp)
    await mockRefine(electronApp, 'This is the refined version.')

    await typeInEditor(window, 'Original prompt text')
    await window.waitForTimeout(200)

    const refineBtn = window.locator('button', { hasText: 'Refine' })
    await refineBtn.click()

    // Button should show Stop while refining
    await expect(window.locator('button', { hasText: 'Stop' })).toBeVisible({ timeout: 2000 })

    // Wait for streaming to complete
    await window.waitForTimeout(300)

    // After finish, refined text should be in the editor
    const text = await getEditorText(window)
    expect(text).toContain('refined')

    // Clean up
    await injectSettings(electronApp, { assignmentKeys: [] })
    await clickCancel(window)
    await window.waitForTimeout(300)
  })
})

// ─── 1.6 Promote ────────────────────────────────────────────────────────────

test.describe('1.6 Promote', () => {
  test('click Promote → dialog opens, Save disabled until name, Enter saves', async () => {
    await switchToPromptMode(window)
    await window.waitForTimeout(300)

    await setupMainProcessMock(electronApp)
    await mockPromoteCalls(electronApp)

    await typeInEditor(window, 'System prompt content')
    await window.waitForTimeout(200)

    // Click Promote
    await window.locator('button', { hasText: 'Promote' }).click()
    await expect(window.locator(sel.dialog)).toBeVisible({ timeout: 2000 })
    await expect(window.locator(sel.promptInput)).toBeVisible()

    // Save button disabled when empty
    const saveBtn = window.locator(sel.dialog).locator('button', { hasText: 'Save' })
    await expect(saveBtn).toBeDisabled()

    // Fill name → Save enabled
    await window.locator(sel.promptInput).fill('my-prompt')
    await expect(saveBtn).toBeEnabled()

    // Enter triggers save → dialog closes
    await window.locator(sel.promptInput).fill('test-prompt')
    await window.locator(sel.promptInput).press('Enter')
    await expect(window.locator(sel.dialog)).not.toBeVisible({ timeout: 3000 })

    // Should return to chat mode (no mode header)
    await expect(window.locator(sel.modeHeader)).not.toBeVisible()
  })
})

// ─── 1.7 Status Guards ──────────────────────────────────────────────────────

test.describe('1.7 Status Guards', () => {
  test('submit disabled when empty and not streaming', async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
    await expect(window.locator(sel.submitBtn)).toBeDisabled()
  })

  test('submit enabled when content present', async () => {
    await typeInEditor(window, 'Some content')
    await window.waitForTimeout(100)
    await expect(window.locator(sel.submitBtn)).toBeEnabled()
    await clearEditor(window)
  })
})
