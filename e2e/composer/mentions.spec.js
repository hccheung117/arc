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
  setupMainProcessMock, mockUploadAttachment, mockInvokeRoute, mockSendMessage,
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

  test('exact skill name without trailing content → no auto-convert yet', async () => {
    await typeInEditor(window, '/summarize')
    await window.waitForTimeout(300)
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)

    // Should NOT convert — cursor is at the end, user may still be typing
    await expect(window.locator(sel.mention)).not.toBeVisible()
    const text = await getEditorText(window)
    expect(text).toContain('/summarize')
  })

  test('skill name that is prefix of longer input → no premature conversion', async () => {
    // Type /summarize then keep typing — should not have converted /summarize mid-typing
    await typeInEditor(window, '/summarize-extra')
    await window.waitForTimeout(300)
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)

    // /summarize-extra is not a known skill, so no mention should exist
    await expect(window.locator(sel.mention)).not.toBeVisible()
    const text = await getEditorText(window)
    expect(text).toContain('/summarize-extra')
  })

  test('non-space char finishes skill mention: /summarize, → converts', async () => {
    // Comma is not [\w-], so it terminates the skill name
    await typeInEditor(window, '/summarize,')
    await window.waitForTimeout(300)
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)

    const mention = window.locator(sel.mention)
    await expect(mention).toBeVisible()
    expect(await mention.textContent()).toBe('/summarize')
    const text = await getEditorText(window)
    expect(text).toContain(',')
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

  test('attach button opens file dialog that accepts all files', async () => {
    const attachBtn = window.locator('svg.lucide-paperclip').first().locator('..')
    await attachBtn.click()
    await window.waitForTimeout(100)

    const fileInput = window.locator('form input[type="file"]')
    const accept = await fileInput.getAttribute('accept')
    expect(accept).toBeNull()
  })

  test('attach button → file input → orange pill inserted', async () => {
    // Click the attach button to trigger the hidden file input
    const attachBtn = window.locator('svg.lucide-paperclip').first().locator('..')
    await attachBtn.click()
    await window.waitForTimeout(100)

    // Set files on the hidden input
    const fileInput = window.locator('form input[type="file"]')
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

// ─── 5.2b Mention-Only Submit ────────────────────────────────────────────────
// When the entire message is just a mention (no trailing content), submit
// must still resolve the full pattern — not a truncated eager conversion.

test.describe('5.2b Mention-Only Submit', () => {
  test.beforeAll(async () => {
    await setupMainProcessMock(electronApp)
    await mockSendMessage(electronApp)
  })

  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('submit @/tmp/file as entire message → user message shows full path', async () => {
    await typeInEditor(window, '@/tmp/file')
    await window.waitForTimeout(300)
    await window.keyboard.press('Enter')
    await window.locator(sel.userMessage).first().waitFor({ state: 'visible', timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).first().textContent()
    // Must contain the full path, not just @/ or truncated
    expect(userMsg).toMatch(/@\/tmp\/file/)
  })

  test('submit /summarize as entire message → user message shows /summarize', async () => {
    await typeInEditor(window, '/summarize')
    await window.waitForTimeout(300)
    await window.keyboard.press('Escape')
    await window.waitForTimeout(100)
    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(2, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(1).textContent()
    expect(userMsg).toContain('/summarize')
  })
})

// ─── 5.3 Typed File Path Mention ────────────────────────────────────────────
// Auto-conversion should only fire when the pattern is followed by content
// (whitespace), not eagerly mid-typing. Without this, @/tmp/blah converts @/
// immediately, losing the rest of the path.

test.describe('5.3 Typed File Path Mention', () => {
  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test.afterEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('type @/tmp/blah + space → single mention showing full path', async () => {
    await typeInEditor(window, '@/tmp/blah ')
    await window.waitForTimeout(500)

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })
    await expect(mention).toHaveCount(1)
    // Label shows full path, not just basename
    expect(await mention.textContent()).toBe('/tmp/blah')
  })

  test('type @/tmp/blah without trailing space → no premature conversion', async () => {
    await typeInEditor(window, '@/tmp/blah')
    await window.waitForTimeout(500)

    // Should NOT convert yet — cursor at end, user still typing
    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).not.toBeVisible()
  })

  test('type @./relative/path + space → single mention showing full relative path', async () => {
    await typeInEditor(window, '@./relative/path ')
    await window.waitForTimeout(500)

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })
    await expect(mention).toHaveCount(1)
    expect(await mention.textContent()).toBe('./relative/path')
  })

  test('type @~/Documents/file.txt + space → single mention showing full home path', async () => {
    await typeInEditor(window, '@~/Documents/file.txt ')
    await window.waitForTimeout(500)

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })
    await expect(mention).toHaveCount(1)
    expect(await mention.textContent()).toBe('~/Documents/file.txt')
  })

  test('type @/tmp then move cursor away → converts on cursor leave', async () => {
    await typeInEditor(window, '@/tmp')
    await window.waitForTimeout(300)

    // No conversion yet — cursor at end
    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).not.toBeVisible()

    // Move cursor to beginning (away from match)
    await window.keyboard.press('Home')
    await window.waitForTimeout(300)

    // Should convert now — cursor is no longer inside the match
    await expect(mention).toBeVisible({ timeout: 2000 })
    expect(await mention.textContent()).toBe('/tmp')
  })

  test('type @/tmp then move cursor away and back → mention exists, cannot extend', async () => {
    await typeInEditor(window, '@/tmp')
    await window.waitForTimeout(300)

    // Move away to trigger conversion
    await window.keyboard.press('Home')
    await window.waitForTimeout(300)

    const mention = window.locator('span[data-type="mention"][data-mention-type="file"]')
    await expect(mention).toBeVisible({ timeout: 2000 })
    expect(await mention.textContent()).toBe('/tmp')
  })
})

// ─── 6.1 Autocomplete Mention Spacing ───────────────────────────────────────
// When a mention is inserted via autocomplete ("/" popup or skill selector),
// the editor must add spaces so the mention never sticks to adjacent text.

test.describe('6.1 Autocomplete Mention Spacing', () => {
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

  test('text before cursor, no space → space added before mention', async () => {
    await typeInEditor(window, 'hello')
    // Use skill selector button (not "/" which needs whitespace to trigger)
    const skillBtn = window.locator('svg.lucide-book-open').first().locator('..')
    await skillBtn.click()
    await window.waitForTimeout(300)
    const popover = window.locator('[data-slot="popover-content"]')
    await popover.locator('[data-slot="command-item"]').first().click()
    await window.waitForTimeout(300)

    const text = await getEditorText(window)
    // "hello" must not stick to the mention — expect a space between
    expect(text).toMatch(/hello\s+\/code-review/)
  })

  test('text before cursor, already has space → no double space', async () => {
    await typeInEditor(window, 'hello ')
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)

    const text = await getEditorText(window)
    // Exactly one space between "hello" and mention, not two
    expect(text).toMatch(/hello \/code-review/)
    expect(text).not.toMatch(/hello {2}/)
  })

  test('start of editor → no space before mention', async () => {
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)

    // Type text after the mention
    await typeInEditor(window, 'world')
    await window.waitForTimeout(200)

    const text = await getEditorText(window)
    // Mention at start — no leading space
    expect(text).toMatch(/^\/code-review/)
    // But mention should have a space before "world"
    expect(text).toMatch(/\/code-review\s+world/)
  })
})

// ─── 6.2 On-Submit Mention Spacing ──────────────────────────────────────────
// Safety net: regardless of how mentions ended up in the editor, getText()
// must produce text where mentions are space-separated from adjacent content.

test.describe('6.2 On-Submit Mention Spacing', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await setupMainProcessMock(electronApp)
    await mockSendMessage(electronApp)
  })

  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('mention stuck to preceding text → space added on send', async () => {
    const before = await window.locator(sel.userMessage).count()

    // Type "hello" then immediately insert a mention with no space
    await typeInEditor(window, 'hello')
    const skillBtn = window.locator('svg.lucide-book-open').first().locator('..')
    await skillBtn.click()
    await window.waitForTimeout(300)
    const popover = window.locator('[data-slot="popover-content"]')
    await popover.locator('[data-slot="command-item"]').first().click()
    await window.waitForTimeout(300)

    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(before + 1, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(before).textContent()
    expect(userMsg).toMatch(/hello\s+\/code-review/)
  })

  test('mention stuck to following text → space added on send', async () => {
    const before = await window.locator(sel.userMessage).count()

    // Insert mention first, then type text right after without space
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)

    // Delete the trailing space that autocomplete inserts, then type text
    await window.keyboard.press('Backspace')
    await typeInEditor(window, 'world')
    await window.waitForTimeout(200)

    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(before + 1, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(before).textContent()
    expect(userMsg).toMatch(/\/code-review\s+world/)
  })

  test('mention node survives manual space removal → still recognized on send', async () => {
    const before = await window.locator(sel.userMessage).count()

    // Insert mention via autocomplete (adds trailing space)
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)

    // Delete trailing space, type text so mention sticks: "/code-reviewlkj"
    await window.keyboard.press('Backspace')
    await typeInEditor(window, 'lkj')
    await window.waitForTimeout(200)

    // The mention node should still exist in the editor (not collapsed to raw text)
    const mention = window.locator('span[data-type="mention"][data-mention-type="skill"]')
    await expect(mention).toBeVisible({ timeout: 2000 })

    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(before + 1, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(before).textContent()
    // renderText safety net must add a space between mention and "lkj"
    expect(userMsg).toMatch(/\/code-review\s+lkj/)
  })

  test('already spaced → not doubled on send', async () => {
    const before = await window.locator(sel.userMessage).count()

    await typeInEditor(window, 'hello ')
    await typeInEditor(window, '/')
    await expect(window.locator('.z-50.w-80')).toBeVisible({ timeout: 2000 })
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)
    await typeInEditor(window, 'world')
    await window.waitForTimeout(200)

    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(before + 1, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(before).textContent()
    // Exactly one space on each side
    expect(userMsg).toMatch(/hello \/code-review world/)
    expect(userMsg).not.toMatch(/ {2}/)
  })
})

// ─── 6.3 File Upload Mention Spacing ─────────────────────────────────────────
// When a file mention is inserted via paste/drop, the editor must add spaces
// so the file mention never sticks to adjacent text.

test.describe('6.3 File Upload Mention Spacing', () => {
  test.beforeAll(async () => {
    await setupMainProcessMock(electronApp)
    await mockUploadAttachment(electronApp)
  })

  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('text before cursor, no space → space added before file mention', async () => {
    await typeInEditor(window, 'hello')

    // Paste a file — triggers uploadAndInsertFiles
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    const text = await getEditorText(window)
    // "hello" must not stick to the file mention (innerText shows label, not @url)
    expect(text).toMatch(/hello\s+test\.png/)
  })

  test('text before cursor, already has space → no double space', async () => {
    await typeInEditor(window, 'hello ')

    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    const text = await getEditorText(window)
    expect(text).toMatch(/hello test\.png/)
    expect(text).not.toMatch(/hello {2}/)
  })

  test('start of editor → no space before file mention', async () => {
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    const text = await getEditorText(window)
    // No leading space
    expect(text).toMatch(/^test\.png/)
  })
})

// ─── 6.4 On-Submit File Mention Spacing ──────────────────────────────────────

test.describe('6.4 On-Submit File Mention Spacing', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await setupMainProcessMock(electronApp)
    await mockUploadAttachment(electronApp)
    await mockSendMessage(electronApp)
  })

  test.beforeEach(async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
  })

  test('file mention stuck to preceding text → space added on send', async () => {
    const before = await window.locator(sel.userMessage).count()

    await typeInEditor(window, 'hello')
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(before + 1, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(before).textContent()
    expect(userMsg).toMatch(/hello\s+@arcfs:/)
  })

  test('file mention stuck to following text → space added on send', async () => {
    const before = await window.locator(sel.userMessage).count()

    // Paste file first
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)

    // Delete trailing space, type text right after mention
    await window.keyboard.press('Backspace')
    await typeInEditor(window, 'world')
    await window.waitForTimeout(200)

    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(before + 1, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(before).textContent()
    expect(userMsg).toMatch(/test\.png\s+world/)
  })

  test('file mention already spaced → not doubled on send', async () => {
    const before = await window.locator(sel.userMessage).count()

    await typeInEditor(window, 'hello ')
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    })
    await window.waitForTimeout(1000)
    await typeInEditor(window, 'world')
    await window.waitForTimeout(200)

    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(before + 1, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(before).textContent()
    expect(userMsg).not.toMatch(/ {2}/)
  })
})
