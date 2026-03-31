import { test, expect } from '@playwright/test'
import { launchApp, sel, typeInEditor, clearEditor, setupMainProcessMock, mockSendMessage, mockUploadAttachment, mockInvokeRouteHandler } from './helpers.js'

let electronApp, window

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())
  await setupMainProcessMock(electronApp)
  await mockSendMessage(electronApp)
})

test.afterAll(async () => {
  await electronApp?.close()
})

test.describe('mention spacing', () => {
  test.describe.configure({ mode: 'serial' })

  test('mention adjacent to text gets space-separated on send', async () => {
    // Type text that AutoMention will convert:
    // "check@arcfs://tmp/test.png " → trailing space finishes the mention
    await typeInEditor(window, 'check@arcfs://tmp/test.png ')
    await window.locator(sel.mention).waitFor({ state: 'visible' })

    // Submit
    await window.keyboard.press('Enter')
    await window.locator(sel.userMessage).first().waitFor({ state: 'visible' })

    // Check the user message text has a space before the mention
    const userMsg = await window.locator(sel.userMessage).first().textContent()
    expect(userMsg).toContain('check @')
  })

  test('plain text with @ but no mention node is not altered', async () => {
    await clearEditor(window)
    await typeInEditor(window, 'user@example.com')
    // No mention node should appear
    await expect(window.locator(sel.mention)).toHaveCount(0)

    await window.keyboard.press('Enter')
    // Wait for the second user message
    await expect(window.locator(sel.userMessage)).toHaveCount(2, { timeout: 5000 })

    const userMsg = await window.locator(sel.userMessage).nth(1).textContent()
    expect(userMsg).toContain('user@example.com')
  })
})

test.describe('pasted screenshot', () => {
  test('should not show tmp path in sent message', async () => {
    await mockUploadAttachment(electronApp)
    // Mock session:send to simulate file resolution (tmp → session URL)
    await mockInvokeRouteHandler(electronApp, 'session:send', `
      const { sessionId, messages } = payload
      const BW = globalThis.__testBrowserWindow
      const win = BW.getAllWindows()[0]
      const push = (event) => {
        if (win && !win.isDestroyed()) win.webContents.send('ipc:push:session:state:feed', event)
      }

      // Push user messages immediately
      push({ type: 'snapshot', sessionId, messages: messages || [], branches: {}, prompt: null, status: 'ready' })

      const userMsg = (messages || []).findLast(m => m.role === 'user')
      if (userMsg) {
        const textPart = (userMsg.parts || []).find(p => p.type === 'text')
        const text = textPart?.text || ''
        const tmpRefs = [...text.matchAll(/@arcfs:\\/\\/tmp\\/\\S+/g)]
        if (tmpRefs.length) {
          const fileParts = tmpRefs.map(m => {
            const url = m[0].slice(1)
            const resolved = url.replace('arcfs://tmp/', 'arcfs://sessions/mock/files/')
            const filename = url.split('/').pop()
            return { type: 'file', url: resolved, filename, mediaType: 'image/png' }
          })
          const resolvedText = text.replace(/@arcfs:\\/\\/tmp\\//g, '@arcfs://sessions/mock/files/')
          const textParts = (userMsg.parts || []).filter(p => p.type === 'text').map(p => ({
            ...p, text: resolvedText
          }))
          push({ type: 'patch', sessionId, replaceFiles: { id: userMsg.id, parts: fileParts, textParts } })
        }
      }

      const id = 'mock-assistant-' + Date.now()
      const assistantMessage = { id, role: 'assistant', parts: [{ type: 'text', text: 'Hello!' }] }
      setTimeout(() => push({ type: 'status', sessionId, status: 'streaming' }), 10)
      setTimeout(() => push({ type: 'tip', sessionId, message: assistantMessage }), 30)
      setTimeout(() => push({
        type: 'snapshot', sessionId,
        messages: [...(messages || []), assistantMessage],
        branches: {}, prompt: null, status: 'ready',
      }), 50)

      return { ok: true }
    `)
    await clearEditor(window)

    // Simulate pasting an image via clipboard
    await window.locator(sel.contenteditable).focus()
    await window.locator(sel.contenteditable).evaluate(async (el) => {
      const blob = new Blob([new Uint8Array(8)], { type: 'image/png' })
      const file = new File([blob], 'screenshot.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      const event = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      el.dispatchEvent(event)
    })

    // Wait for mention node to appear (upload resolves → mention inserted)
    await window.locator(sel.mention).waitFor({ state: 'visible', timeout: 5000 })

    // Send the message
    await window.keyboard.press('Enter')
    await expect(window.locator(sel.userMessage)).toHaveCount(3, { timeout: 5000 })

    // The sent message should show resolved session path, not tmp path
    const userMsg = await window.locator(sel.userMessage).last().textContent()
    expect(userMsg).not.toContain('arcfs://tmp/')
  })
})
