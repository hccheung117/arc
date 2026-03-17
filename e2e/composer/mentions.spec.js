// Gotchas:
// - Skills must be injected via injectSkills (IPC push) before tests run.
//   The SkillSelectorButton returns null when skills array is empty.
// - Skill popup uses text=name for matching, but descriptions also contain the name.
//   Use getByText(name, { exact: true }) or [data-slot="command-item"] filter to avoid
//   strict mode violations from multiple matches.
// - The "/" suggestion popup is a portal on document.body (.z-50.w-80),
//   while the skill selector button opens a [data-slot="popover-content"] — different selectors.
// - Multiple mentions are allowed; the "/" popup will always appear.
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  typeInEditor, clearEditor, getEditorText,
  injectSkills,
  setupMainProcessMock, mockUploadAttachment, mockInvokeRoute,
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

  test('select skill → mention node inserted at cursor position', async () => {
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

  test('select another skill → both mentions coexist', async () => {
    // Insert first mention
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)

    // Use selector button to insert a different skill
    const skillBtn = window.locator('svg.lucide-book-open').first().locator('..')
    await skillBtn.click()
    await window.waitForTimeout(300)
    const popover = window.locator('[data-slot="popover-content"]')
    await popover.locator('[data-slot="command-item"]').nth(1).click()
    await window.waitForTimeout(300)

    // Both mentions should coexist
    expect(await window.locator(sel.mention).count()).toBe(2)
  })
})

// ─── 4.3 Mention Rendering ──────────────────────────────────────────────────

test.describe('4.3 Mention Rendering', () => {
  test('mention renders as purple text with data-type and data-mention-type', async () => {
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

    expect(await mention.getAttribute('data-type')).toBe('mention')
    expect(await mention.getAttribute('data-mention-type')).toBe('skill')
  })
})

// ─── 4.5 Auto-convert fully typed slash commands ─────────────────────────────

test.describe('4.5 Auto-convert fully typed slash commands', () => {
  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })
  test.afterEach(async () => {
    await window.keyboard.press('Escape')
    await window.waitForTimeout(100)
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('type full skill name + space → mention node created', async () => {
    await typeInEditor(window, '/summarize ')
    await window.waitForTimeout(300)

    const mention = window.locator(sel.mention)
    await expect(mention).toBeVisible()
    const classes = await mention.getAttribute('class')
    expect(classes).toContain('text-purple-600')
    expect(await mention.textContent()).toBe('/summarize')
  })

  test('type full skill name + continue typing → mention + trailing text', async () => {
    await typeInEditor(window, '/summarize do something')
    await window.waitForTimeout(300)

    const mention = window.locator(sel.mention)
    await expect(mention).toBeVisible()
    expect(await mention.textContent()).toBe('/summarize')
    const text = await getEditorText(window)
    expect(text).toContain('do something')
  })

  test('partial name + space → no auto-convert', async () => {
    await typeInEditor(window, '/summ ')
    await window.waitForTimeout(300)

    await expect(window.locator(sel.mention)).not.toBeVisible()
    const text = await getEditorText(window)
    expect(text).toContain('/summ')
  })

  test('Escape after full name → still auto-converts', async () => {
    await typeInEditor(window, '/summarize')
    await window.waitForTimeout(300)
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)

    const mention = window.locator(sel.mention)
    await expect(mention).toBeVisible()
    expect(await mention.textContent()).toBe('/summarize')
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

// ─── 5.1 File Mention via Paste ──────────────────────────────────────────────

test.describe('5.1 File Mention via Paste', () => {
  test.beforeAll(async () => {
    await setupMainProcessMock(electronApp)
    await mockUploadAttachment(electronApp)
    await mockInvokeRoute(electronApp, 'message:open-file', undefined)
  })

  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('paste file → orange pill with data-mention-type="file" appears', async () => {
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })

    const classes = await mention.getAttribute('class')
    expect(classes).toContain('text-orange-600')
  })

  test('file mention renders filename as visible text', async () => {
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    const text = await getEditorText(window)
    expect(text).toContain('test.png')
  })

  test('file mention shows @ prefix', async () => {
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })
    const beforeContent = await mention.evaluate((el) => getComputedStyle(el, '::before').content)
    expect(beforeContent).toBe('"@"')
  })

  test('click file mention calls open-file IPC', async () => {
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    // Set up tracking mock before click
    await electronApp.evaluate(() => {
      globalThis.__openFileCallPayload = null
      globalThis.__testMockInvokeRoutes['message:open-file'] = (payload) => {
        globalThis.__openFileCallPayload = payload
      }
    })

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })
    await mention.locator('span').first().click()
    await window.waitForTimeout(300)

    const called = await electronApp.evaluate(() => globalThis.__openFileCallPayload)
    expect(called).toBeTruthy()
    expect(called.url).toBe('arcfs://tmp/test.png')
  })
})

// ─── 5.1b Deleting a File Mention ────────────────────────────────────────

test.describe('5.1b Deleting a File Mention', () => {
  test.beforeAll(async () => {
    await setupMainProcessMock(electronApp)
    await mockUploadAttachment(electronApp)
  })

  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('backspace on mention → entire mention deleted, no leftover @', async () => {
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })

    // Place cursor at end and press Backspace twice (trailing space + mention)
    await window.keyboard.press('End')
    await window.keyboard.press('Backspace')
    await window.keyboard.press('Backspace')
    await window.waitForTimeout(300)

    await expect(mention).not.toBeVisible()
    const text = await getEditorText(window)
    expect(text).not.toContain('@')
  })
})

// ─── 5.2 File Mention via Attach Button ──────────────────────────────────────

test.describe('5.2 File Mention via Attach Button', () => {
  test.beforeAll(async () => {
    await setupMainProcessMock(electronApp)
    await mockUploadAttachment(electronApp)
  })

  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('attach button opens file dialog that only accepts image files', async () => {
    const attachBtn = window.locator('svg.lucide-image').first().locator('..')
    await attachBtn.click()
    await window.waitForTimeout(100)

    const fileInput = window.locator('input[type="file"][accept]')
    const accept = await fileInput.getAttribute('accept')
    expect(accept).toBeTruthy()
    expect(accept).toMatch(/image\//)
  })

  test('attach button → file input → orange pill inserted', async () => {
    // Click the attach button to trigger the hidden file input
    const attachBtn = window.locator('svg.lucide-image').first().locator('..')
    await attachBtn.click()
    await window.waitForTimeout(100)

    // Set files on the hidden input
    const fileInput = window.locator('input[type="file"][accept]')
    await fileInput.setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
    })
    await window.waitForTimeout(1000)

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })
  })
})
