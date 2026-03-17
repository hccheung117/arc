// Gotchas:
// - The resize handle has opacity-0 when unlocked. Playwright mouse.move/down/up
//   doesn't reliably trigger React's onMouseDown on it. Use dispatchEvent with native
//   MouseEvent instead (see dragHandle helper).
// - Measure height on the .overflow-y-auto wrapper, NOT [contenteditable].
//   maxHeight is set on the EditorContent parent; the contenteditable child overflows it.
// - Drag direction: downward (positive deltaY) shrinks, upward (negative) expands.
//   The formula is: nextCap = startCap + (startY - clientY).
// - The lock button also lives inside the opacity-0 handle. Use { force: true } to click it
//   when unlocked.
// - 5.3 Lock/Unlock tests depend on 5.2 leaving the editor locked. Run in order.
import { test, expect } from '@playwright/test'
import {
  launchApp, sel,
  typeInEditor, clearEditor,
} from '../helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
})

test.afterAll(async () => {
  await electronApp?.close()
})

async function getEditorHeight(window) {
  // maxHeight is on the EditorContent wrapper (parent of contenteditable)
  return window.locator(sel.contenteditable).evaluate((el) =>
    el.closest('.overflow-y-auto')?.getBoundingClientRect().height ?? el.getBoundingClientRect().height
  )
}

// Simulate drag on the resize handle using dispatchEvent (more reliable than Playwright mouse)
async function dragHandle(window, deltaY) {
  await window.evaluate((dy) => {
    return new Promise((resolve) => {
      const handle = document.querySelector('.cursor-row-resize')
      if (!handle) return resolve()
      const rect = handle.getBoundingClientRect()
      const cx = rect.x + rect.width / 2
      const cy = rect.y + rect.height / 2

      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: cx, clientY: cy, bubbles: true }))
      setTimeout(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy + dy, bubbles: true }))
      }, 50)
      setTimeout(() => {
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        resolve()
      }, 100)
    })
  }, deltaY)
  await window.waitForTimeout(200)
}

// ─── 5.1 Auto-grow ──────────────────────────────────────────────────────────

test.describe('5.1 Auto-grow', () => {
  test('editor height increases as content grows', async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)
    const initialHeight = await getEditorHeight(window)

    for (let i = 0; i < 5; i++) {
      await typeInEditor(window, `Line ${i + 1}`)
      await window.keyboard.press('Shift+Enter')
    }
    await window.waitForTimeout(200)

    expect(await getEditorHeight(window)).toBeGreaterThan(initialHeight)
  })

  test('editor height decreases when content is deleted', async () => {
    const beforeDelete = await getEditorHeight(window)
    await clearEditor(window)
    await window.waitForTimeout(200)
    expect(await getEditorHeight(window)).toBeLessThan(beforeDelete)
  })
})

// ─── 5.2 Resize Handle ──────────────────────────────────────────────────────

test.describe('5.2 Resize Handle', () => {
  test.beforeAll(async () => {
    await clearEditor(window)
    for (let i = 0; i < 5; i++) {
      await typeInEditor(window, `Line ${i + 1}`)
      await window.keyboard.press('Shift+Enter')
    }
    await window.waitForTimeout(200)
  })

  test('handle exists in DOM', async () => {
    expect(await window.locator(sel.resizeHandle).count()).toBeGreaterThan(0)
  })

  test('drag downward → editor shrinks, height is locked', async () => {
    const before = await getEditorHeight(window)
    // Drag down (positive deltaY) → cap decreases → editor shrinks
    await dragHandle(window, 60)
    const after = await getEditorHeight(window)
    expect(after).toBeLessThan(before)
    await expect(window.locator(sel.unlockBtn)).toBeVisible({ timeout: 2000 })
  })

  test('drag upward → editor expands', async () => {
    const before = await getEditorHeight(window)
    // Drag up (negative deltaY) → cap increases → editor expands
    await dragHandle(window, -80)
    const after = await getEditorHeight(window)
    expect(after).toBeGreaterThan(before)
  })
})

// ─── 5.3 Lock / Unlock ──────────────────────────────────────────────────────

test.describe('5.3 Lock / Unlock', () => {
  test('lock icon visible when height is locked (from previous drag)', async () => {
    await expect(window.locator(sel.unlockBtn)).toBeVisible()
  })

  test('click unlock → returns to auto-grow', async () => {
    await window.locator(sel.unlockBtn).click()
    await window.waitForTimeout(200)
    // Now the lock button should exist (may have opacity-0)
    expect(await window.locator(sel.lockBtn).count()).toBeGreaterThan(0)
  })

  test('click lock when unlocked → locks to current height', async () => {
    await window.locator(sel.lockBtn).click({ force: true })
    await window.waitForTimeout(200)
    await expect(window.locator(sel.unlockBtn)).toBeVisible()
  })

  test('handle always visible when locked (no opacity-0)', async () => {
    const hasOpacity0 = await window.locator(sel.resizeHandle).first().evaluate((el) => {
      return el.classList.contains('opacity-0')
    })
    expect(hasOpacity0).toBe(false)

    // Clean up: unlock
    await window.locator(sel.unlockBtn).click()
    await window.waitForTimeout(200)
  })
})

// ─── 5.4 Scroll Into View ───────────────────────────────────────────────────

test.describe('5.4 Scroll Into View', () => {
  test('cursor stays visible when typing at bottom of locked editor', async () => {
    await clearEditor(window)
    await window.waitForTimeout(100)

    for (let i = 0; i < 15; i++) {
      await typeInEditor(window, `Line ${i + 1}`)
      await window.keyboard.press('Shift+Enter')
    }
    await window.waitForTimeout(200)

    // Lock at a small height by dragging down
    await dragHandle(window, 150)

    // Type more at the bottom
    await typeInEditor(window, 'This should be visible')
    await window.waitForTimeout(300)

    // Editor should have scrolled to cursor
    const isNearBottom = await window.locator(sel.contenteditable).evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 50
    })
    expect(isNearBottom).toBe(true)

    // Clean up
    if (await window.locator(sel.unlockBtn).isVisible().catch(() => false)) {
      await window.locator(sel.unlockBtn).click()
    }
    await clearEditor(window)
  })
})
