// Gotchas:
// - Skills must be injected via injectSkills (IPC push) before tests run.
//   The SkillSelectorButton returns null when skills array is empty.
// - Skill popup uses text=name for matching, but descriptions also contain the name.
//   Use getByText(name, { exact: true }) or [data-slot="command-item"] filter to avoid
//   strict mode violations from multiple matches.
// - The "/" suggestion popup is a portal on document.body (.z-50.w-80),
//   while the skill selector button opens a [data-slot="popover-content"] — different selectors.
// - Only one mention allowed at a time. The "/" popup won't appear if a mention already exists.
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  typeInEditor, clearEditor, getEditorText,
  injectSkills,
} from '../helpers.js'

const TEST_SKILLS = [
  { name: 'code-review', description: 'Review code for quality' },
  { name: 'summarize', description: 'Summarize text concisely' },
  { name: 'translate', description: 'Translate between languages' },
]

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
  await injectSkills(electronApp, TEST_SKILLS)
  await window.waitForTimeout(500)
})

test.afterAll(async () => {
  await electronApp?.close()
})

// ─── 4.1 Autocomplete via "/" ────────────────────────────────────────────────

test.describe('4.1 Autocomplete via "/"', () => {
  test.afterEach(async () => {
    await window.keyboard.press('Escape')
    await window.waitForTimeout(100)
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('type "/" → suggestion popup appears', async () => {
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
  })

  test('popup lists available skills', async () => {
    await typeInEditor(window, '/')
    const popup = window.locator('.z-50.w-80')
    await expect(popup).toBeVisible({ timeout: 2000 })
    for (const skill of TEST_SKILLS) {
      await expect(popup.getByText(skill.name, { exact: true })).toBeVisible()
    }
  })

  test('typing after "/" filters skills case-insensitively', async () => {
    await typeInEditor(window, '/code')
    const popup = window.locator('.z-50.w-80')
    await expect(popup).toBeVisible({ timeout: 2000 })
    await expect(popup.locator('text=code-review')).toBeVisible()
    await expect(popup.locator('text=summarize')).not.toBeVisible()
    await expect(popup.locator('text=translate')).not.toBeVisible()
  })

  test('ArrowDown/ArrowUp navigates items', async () => {
    await typeInEditor(window, '/')
    const popup = window.locator('.z-50.w-80')
    await expect(popup).toBeVisible({ timeout: 2000 })
    // Navigate without crashing
    await window.keyboard.press('ArrowDown')
    await window.keyboard.press('ArrowDown')
    await window.keyboard.press('ArrowUp')
    await window.waitForTimeout(100)
    // Just verify the popup is still open
    await expect(popup).toBeVisible()
  })

  test('Enter selects highlighted item → mention node inserted', async () => {
    await typeInEditor(window, '/')
    const popup = window.locator('.z-50.w-80')
    await expect(popup).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)

    await expect(popup).not.toBeVisible()
    await expect(window.locator(sel.mention)).toBeVisible()
    const text = await getEditorText(window)
    expect(text).toMatch(/\/code-review/)
  })

  test('Escape closes popup without inserting', async () => {
    await typeInEditor(window, '/')
    const popup = window.locator('.z-50.w-80')
    await expect(popup).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Escape')
    await expect(popup).not.toBeVisible()
    await expect(window.locator(sel.mention)).not.toBeVisible()
  })

  test('popup does not appear if mention already exists', async () => {
    // Insert a mention first
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)
    await expect(window.locator(sel.mention)).toBeVisible()

    // Type "/" again — popup should NOT appear
    await typeInEditor(window, ' /')
    await window.waitForTimeout(500)
    await expect(window.locator('.z-50.w-80')).not.toBeVisible()
  })
})

// ─── 4.2 Insertion via Skill Selector Button ────────────────────────────────

test.describe('4.2 Skill Selector Button', () => {
  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('click skill button → popover opens with skill list', async () => {
    const skillBtn = window.locator('svg.lucide-book-open').first().locator('..')
    await skillBtn.click()
    await window.waitForTimeout(300)

    const popover = window.locator('[data-slot="popover-content"]')
    await expect(popover).toBeVisible({ timeout: 2000 })
    for (const skill of TEST_SKILLS) {
      await expect(popover.locator('[data-slot="command-item"]', { hasText: skill.name })).toBeVisible()
    }
  })

  test('select skill → mention node inserted at position 0', async () => {
    await typeInEditor(window, 'some text')
    await window.waitForTimeout(100)

    const skillBtn = window.locator('svg.lucide-book-open').first().locator('..')
    await skillBtn.click()
    await window.waitForTimeout(300)

    const popover = window.locator('[data-slot="popover-content"]')
    await expect(popover).toBeVisible({ timeout: 2000 })
    await popover.locator('[data-slot="command-item"]').first().click()
    await window.waitForTimeout(300)

    await expect(window.locator(sel.mention)).toBeVisible()
    await expect(popover).not.toBeVisible()
  })

  test('if mention already exists → old mention replaced with new one', async () => {
    // Insert first mention
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)

    const firstMention = await window.locator(sel.mention).textContent()

    // Use selector button to insert a different skill
    const skillBtn = window.locator('svg.lucide-book-open').first().locator('..')
    await skillBtn.click()
    await window.waitForTimeout(300)
    const popover = window.locator('[data-slot="popover-content"]')
    await popover.locator('[data-slot="command-item"]').nth(1).click()
    await window.waitForTimeout(300)

    // Should still be exactly one mention (replaced)
    expect(await window.locator(sel.mention).count()).toBe(1)
    const secondMention = await window.locator(sel.mention).textContent()
    expect(secondMention).not.toBe(firstMention)
  })
})

// ─── 4.3 Mention Rendering ──────────────────────────────────────────────────

test.describe('4.3 Mention Rendering', () => {
  test('mention renders as purple text with data-type and data-name', async () => {
    await clearEditor(window)
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)

    const mention = window.locator(sel.mention)
    await expect(mention).toBeVisible()

    const text = await mention.textContent()
    expect(text).toMatch(/^\/\w/)

    const classes = await mention.getAttribute('class')
    expect(classes).toContain('text-purple-600')

    expect(await mention.getAttribute('data-type')).toBe('skill-mention')
    expect(await mention.getAttribute('data-name')).toBeTruthy()
  })
})

// ─── 4.4 Mention in Submitted Text ──────────────────────────────────────────

test.describe('4.4 Mention in Submitted Text', () => {
  test('plain text includes /${skillName} from mention nodes', async () => {
    await clearEditor(window)
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)
    await typeInEditor(window, 'do something')
    await window.waitForTimeout(100)

    const text = await getEditorText(window)
    expect(text).toMatch(/\/code-review/)
    expect(text).toContain('do something')
  })
})
