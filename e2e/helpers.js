// Gotchas:
// - window.api is frozen by contextBridge (non-writable, non-configurable).
//   Cannot mock IPC at the renderer level. Use setupMainProcessMock() instead,
//   which intercepts ipc:stream / ipc:invoke handlers in the main process.
// - injectSettings() must include ALL required fields ({ assignmentKeys, favorites }).
//   Omitting fields crashes components that read them (e.g. ModelSelectorButton.favorites.some).
// - pushToRenderer() replaces the entire subscription cache entry — not a merge.
// - Drag simulation requires native dispatchEvent; Playwright mouse.move/down/up
//   doesn't reliably trigger React onMouseDown on opacity-0 handles.
// - Measure editor height on the .overflow-y-auto wrapper, not the contenteditable.
//   maxHeight is set on the EditorContent parent; the contenteditable child overflows.
import { _electron as electron } from '@playwright/test'

const DEV_SERVER = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'

// --- App Lifecycle ---

export async function launchApp() {
  try {
    await fetch(DEV_SERVER)
  } catch {
    throw new Error(`Vite dev server not reachable at ${DEV_SERVER}. Run "npm start" first.`)
  }

  const electronApp = await electron.launch({
    args: ['.'],
    env: { ...process.env, MAIN_WINDOW_VITE_DEV_SERVER_URL: DEV_SERVER },
  })

  const window = await electronApp.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Wait for the composer editor to be ready
  await window.locator(sel.editor).waitFor({ state: 'visible' })

  return { electronApp, window }
}

// --- Selectors ---

export const sel = {
  editor: '[data-slot="input-group-control"]',
  contenteditable: '[contenteditable="true"]',
  submitBtn: 'button[aria-label="Submit"]',
  stopBtn: 'button[aria-label="Stop"]',
  // PromptInputHeader uses data-align="block-end" + order-first CSS
  modeHeader: '[data-slot="input-group-addon"].order-first',
  footer: '[data-slot="input-group-addon"]:not(.order-first)',
  lockBtn: 'button[aria-label="Lock composer height"]',
  unlockBtn: 'button[aria-label="Unlock composer height"]',
  resizeHandle: '.cursor-row-resize',
  mention: 'span[data-type="mention"]',
  userMessage: '.is-user',
  assistantMessage: '.is-assistant',
  dialog: '[role="dialog"]',
  promptInput: 'input[placeholder="Prompt name"]',
  form: 'form:has([contenteditable])',
}

// --- Editor Utilities ---

export async function typeInEditor(window, text) {
  await window.locator(sel.contenteditable).focus()
  await window.keyboard.type(text)
}

export async function clearEditor(window) {
  await window.locator(sel.contenteditable).focus()
  await window.keyboard.press('Meta+A')
  await window.keyboard.press('Backspace')
}

export async function getEditorText(window) {
  return window.locator(sel.contenteditable).evaluate((el) => {
    return el.innerText.trim()
  })
}

export async function getEditorPlaceholder(window) {
  return window.locator(sel.editor).evaluate((el) => {
    const p = el.querySelector('.is-editor-empty')
    if (p) return getComputedStyle(p, '::before').content.replace(/^"|"$/g, '')
    return ''
  })
}

// --- Mode Switching ---

export async function switchToPromptMode(window) {
  await window.locator('.lucide-drama').locator('..').click()
}

export async function clickCancel(window) {
  const cancelBtn = window.locator('button', { hasText: 'Cancel' })
  if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await cancelBtn.click()
  }
}

// --- IPC Push Helpers (main → renderer) ---

export async function pushToRenderer(electronApp, route, data) {
  await electronApp.evaluate(({ BrowserWindow }, { route, data }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send(`ipc:push:${route}`, data)
    }
  }, { route, data })
}

export async function injectSkills(electronApp, skills) {
  await pushToRenderer(electronApp, 'skills:feed', skills)
}

export async function injectSettings(electronApp, overrides) {
  // settings:feed expects { assignmentKeys: [...], favorites: [...] }
  // Always include all required fields to avoid crashes
  await pushToRenderer(electronApp, 'settings:feed', {
    assignmentKeys: [],
    favorites: [],
    ...overrides,
  })
}

export async function triggerEditMode(electronApp, role, messageId) {
  await pushToRenderer(electronApp, 'message:edit:start', { id: messageId, role })
}

// --- Main Process IPC Mock ---
// window.api is frozen by contextBridge, so we mock at the main process level
// by intercepting ipc:stream and ipc:invoke handlers

export async function setupMainProcessMock(electronApp) {
  await electronApp.evaluate(({ ipcMain, BrowserWindow }) => {
    if (globalThis.__testMocksInstalled) return
    globalThis.__testBrowserWindow = BrowserWindow

    // --- Stream mocks (assist:refine-prompt) ---
    const origStreamListeners = [...ipcMain.rawListeners('ipc:stream')]
    ipcMain.removeAllListeners('ipc:stream')

    const mockStreamRoutes = {}
    globalThis.__testMockStreamRoutes = mockStreamRoutes

    ipcMain.on('ipc:stream', (event, route, payload) => {
      if (mockStreamRoutes[route]) {
        const { requestId } = payload
        const channel = `ipc:stream:${requestId}`
        const send = (chunk) => {
          if (!event.sender.isDestroyed()) event.sender.send(channel, chunk)
        }
        Promise.resolve().then(() => mockStreamRoutes[route]({ send, requestId, ...payload }))
          .catch((e) => send({ type: 'error', errorText: e.message ?? 'Unexpected error' }))
        return
      }
      // Forward to original handlers
      for (const fn of origStreamListeners) fn(event, route, payload)
    })

    // --- Invoke mocks (prompt:commit, session:save-prompt, etc.) ---
    // Store original handle function by wrapping
    const mockInvokeRoutes = {}
    globalThis.__testMockInvokeRoutes = mockInvokeRoutes

    // We can't easily get the original handler, so we re-register
    // The original handler calls dispatch() which calls routes[route](payload)
    // We intercept by removing and re-adding
    ipcMain.removeHandler('ipc:invoke')
    ipcMain.handle('ipc:invoke', async (event, route, payload) => {
      if (mockInvokeRoutes[route]) return mockInvokeRoutes[route](payload)
      // Call original dispatch — we stored original listeners
      // Since we can't access the module, we'll use the router's ipc:invoke mechanism
      // The original handler was: (_, route, payload) => dispatch(route, payload)
      // We need access to dispatch... Let's try dynamic import
      try {
        const router = await import('./src/main/router.js')
        return router.dispatch(route, payload)
      } catch {
        // Fallback: try require
        try {
          const router = require('./src/main/router.js')
          return router.dispatch(route, payload)
        } catch {
          throw new Error(`No mock and cannot dispatch route: ${route}`)
        }
      }
    })

    globalThis.__testMocksInstalled = true
  })
}

export async function mockStreamRoute(electronApp, route, handlerBody) {
  await electronApp.evaluate(({}, { route, handlerBody }) => {
    if (!globalThis.__testMockStreamRoutes) return
    globalThis.__testMockStreamRoutes[route] = new Function('params', handlerBody)
  }, { route, handlerBody })
}

export async function mockInvokeRoute(electronApp, route, result) {
  await electronApp.evaluate(({}, { route, result }) => {
    if (!globalThis.__testMockInvokeRoutes) return
    globalThis.__testMockInvokeRoutes[route] = () => result
  }, { route, result })
}

export async function mockInvokeRouteHandler(electronApp, route, handlerBody) {
  await electronApp.evaluate(({}, { route, handlerBody }) => {
    if (!globalThis.__testMockInvokeRoutes) return
    globalThis.__testMockInvokeRoutes[route] = new Function('payload', handlerBody)
  }, { route, handlerBody })
}

// Convenience: mock message:upload-attachment
export async function mockUploadAttachment(electronApp, result = { url: 'arcfs://tmp/test.png', filename: 'test.png', mediaType: 'image/png' }) {
  await mockInvokeRoute(electronApp, 'message:upload-attachment', result)
}

// Convenience: mock session:send to return a canned AI response.
// session:send is now an invoke route (not a stream). The mock pushes
// session:state:feed events to simulate streaming.
export async function mockSendMessage(electronApp, aiReply = 'Hello from AI!') {
  const escapedReply = JSON.stringify(aiReply)
  await mockInvokeRouteHandler(electronApp, 'session:send', `
    const { sessionId, messages } = payload
    const BW = globalThis.__testBrowserWindow
    const win = BW.getAllWindows()[0]
    const push = (event) => {
      if (win && !win.isDestroyed()) win.webContents.send('ipc:push:session:state:feed', event)
    }

    // Push user messages immediately (mimics patchBranches in real route)
    push({ type: 'snapshot', sessionId, messages: messages || [], branches: {}, prompt: null, status: 'ready' })

    const id = 'mock-assistant-' + Date.now()
    const assistantMessage = { id, role: 'assistant', parts: [{ type: 'text', text: ${escapedReply} }] }

    setTimeout(() => push({ type: 'status', sessionId, status: 'streaming' }), 10)
    setTimeout(() => push({ type: 'tip', sessionId, message: assistantMessage }), 30)
    setTimeout(() => push({
      type: 'snapshot',
      sessionId,
      messages: [...(messages || []), assistantMessage],
      branches: {},
      prompt: null,
      status: 'ready',
    }), 50)

    return { ok: true }
  `)
}

// Convenience: mock refine
export async function mockRefine(electronApp, refinedText = 'Refined prompt.') {
  const escaped = JSON.stringify(refinedText)
  await mockStreamRoute(electronApp, 'assist:refine-prompt', `
    const { send } = params
    setTimeout(() => send({ type: 'text-delta', delta: ${escaped} }), 50)
    setTimeout(() => send({ type: 'finish' }), 100)
  `)
}

// Convenience: mock invoke routes used by Promote
export async function mockPromoteCalls(electronApp) {
  await mockInvokeRoute(electronApp, 'prompt:commit', undefined)
  await mockInvokeRoute(electronApp, 'session:link-prompt', undefined)
}

// Convenience: mock session:save-prompt
export async function mockSavePrompt(electronApp) {
  await mockInvokeRoute(electronApp, 'session:save-prompt', undefined)
}

// Convenience: mock message:edit-save
export async function mockEditSave(electronApp) {
  await mockInvokeRoute(electronApp, 'message:edit-save', undefined)
}

// --- Streaming control helpers ---

// Mock session:send to enter streaming and stay there (no finish).
// Pushes status + tip events. Stores sessionId/messages on globalThis for finish/error.
export async function mockHangingStream(electronApp) {
  await mockInvokeRouteHandler(electronApp, 'session:send', `
    const { sessionId, messages } = payload
    const BW = globalThis.__testBrowserWindow
    const win = BW.getAllWindows()[0]
    const push = (event) => {
      if (win && !win.isDestroyed()) win.webContents.send('ipc:push:session:state:feed', event)
    }

    // Push user messages immediately
    push({ type: 'snapshot', sessionId, messages: messages || [], branches: {}, prompt: null, status: 'ready' })

    const id = 'mock-assistant-hang-' + Date.now()
    const assistantMessage = { id, role: 'assistant', parts: [{ type: 'text', text: 'Thinking...' }] }

    globalThis.__hangingSessionId = sessionId
    globalThis.__hangingMessages = [...(messages || []), assistantMessage]

    setTimeout(() => {
      push({ type: 'status', sessionId, status: 'streaming' })
      push({ type: 'tip', sessionId, message: assistantMessage })
    }, 10)

    return { ok: true }
  `)
}

// Complete a hanging stream → status returns to ready.
export async function finishHangingStream(electronApp) {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const sessionId = globalThis.__hangingSessionId
    if (!sessionId) return
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send('ipc:push:session:state:feed', {
        type: 'snapshot',
        sessionId,
        messages: globalThis.__hangingMessages ?? [],
        branches: {},
        prompt: null,
        status: 'ready',
      })
    }
    globalThis.__hangingSessionId = null
    globalThis.__hangingMessages = null
  })
}

// Error a hanging stream → status becomes error.
export async function errorHangingStream(electronApp) {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const sessionId = globalThis.__hangingSessionId
    if (!sessionId) return
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send('ipc:push:session:state:feed', {
        type: 'status',
        sessionId,
        status: 'ready',
        error: 'Mock error',
      })
    }
    globalThis.__hangingSessionId = null
    globalThis.__hangingMessages = null
  })
}

// --- IPC call tracking ---

// Install a tracking mock that records all payloads for a given invoke route.
export async function trackInvokeRoute(electronApp, route) {
  await electronApp.evaluate(({}, { route }) => {
    const key = `__trackCalls_${route.replace(/:/g, '_')}`
    globalThis[key] = []
    globalThis.__testMockInvokeRoutes[route] = (payload) => {
      globalThis[key].push(payload)
    }
  }, { route })
}

// Return the array of payloads recorded by trackInvokeRoute.
export async function getTrackedCalls(electronApp, route) {
  return electronApp.evaluate(({}, { route }) => {
    const key = `__trackCalls_${route.replace(/:/g, '_')}`
    return globalThis[key] ?? []
  }, { route })
}

// Reset tracked calls to empty.
export async function clearTrackedCalls(electronApp, route) {
  await electronApp.evaluate(({}, { route }) => {
    const key = `__trackCalls_${route.replace(/:/g, '_')}`
    globalThis[key] = []
  }, { route })
}

// --- Send a message and wait for AI reply ---

export async function sendMessage(window, text) {
  await typeInEditor(window, text)
  await window.keyboard.press('Enter')
  await window.locator(sel.assistantMessage).first().waitFor({ state: 'visible', timeout: 5000 })
}
