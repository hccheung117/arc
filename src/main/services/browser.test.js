import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockDebugger = { attach: vi.fn(), sendCommand: vi.fn(), on: vi.fn(), removeListener: vi.fn() }
const mockWebContents = {
  debugger: mockDebugger,
  getURL: vi.fn(() => 'about:blank'),
  getTitle: vi.fn(() => ''),
  loadURL: vi.fn(),
}
const mockWindow = {
  webContents: mockWebContents,
  close: vi.fn(),
  isDestroyed: vi.fn(() => false),
  on: vi.fn(),
}

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockWindow),
}))

vi.mock('node:fs/promises', () => ({
  default: { mkdir: vi.fn(), writeFile: vi.fn() },
}))

const { execute, setTmpPath, _reset } = await import('./browser.js')

beforeEach(() => {
  _reset()
  vi.clearAllMocks()
})

describe('unknown command', () => {
  test('returns error for unknown command', async () => {
    const result = await execute('bogus', [])
    expect(result).toEqual({ error: 'Unknown command: bogus' })
  })
})

describe('open', () => {
  test('creates window and returns id', async () => {
    const result = await execute('open', [])
    expect(result).toEqual({ windowId: 1 })
    expect(mockWebContents.loadURL).not.toHaveBeenCalled()
  })

  test('navigates to url when provided', async () => {
    const result = await execute('open', ['https://example.com'])
    expect(result).toEqual({ windowId: 1 })
    expect(mockWebContents.loadURL).toHaveBeenCalledWith('https://example.com')
  })
})

describe('list', () => {
  test('returns empty array when no windows', async () => {
    const result = await execute('list', [])
    expect(result).toEqual([])
  })

  test('returns open windows', async () => {
    await execute('open', [])
    const result = await execute('list', [])
    expect(result).toEqual([{ id: 1, url: 'about:blank', title: '' }])
  })
})

describe('close', () => {
  test('closes window and removes from map', async () => {
    await execute('open', [])
    const result = await execute('close', ['1'])
    expect(result).toEqual({ closed: 1 })
    expect(mockWindow.close).toHaveBeenCalled()
    expect(await execute('list', [])).toEqual([])
  })

  test('returns error for unknown window', async () => {
    const result = await execute('close', ['99'])
    expect(result).toEqual({ error: 'Window not found: 99' })
  })
})

describe('navigate', () => {
  test('navigates window to url', async () => {
    await execute('open', [])
    await execute('navigate', ['1', 'https://example.com'])
    expect(mockWebContents.loadURL).toHaveBeenCalledWith('https://example.com')
  })

  test('returns error for missing url', async () => {
    await execute('open', [])
    const result = await execute('navigate', ['1'])
    expect(result).toEqual({ error: 'Missing required argument: url' })
  })
})

describe('back/forward/reload', () => {
  test('calls goBack', async () => {
    mockWebContents.goBack = vi.fn()
    await execute('open', [])
    await execute('back', ['1'])
    expect(mockWebContents.goBack).toHaveBeenCalled()
  })

  test('calls goForward', async () => {
    mockWebContents.goForward = vi.fn()
    await execute('open', [])
    await execute('forward', ['1'])
    expect(mockWebContents.goForward).toHaveBeenCalled()
  })

  test('calls reload', async () => {
    mockWebContents.reload = vi.fn()
    await execute('open', [])
    await execute('reload', ['1'])
    expect(mockWebContents.reload).toHaveBeenCalled()
  })
})

describe('screenshot', () => {
  test('captures and writes PNG', async () => {
    setTmpPath('/tmp/test-session')
    mockDebugger.sendCommand.mockResolvedValueOnce({ data: 'base64png' })
    await execute('open', [])
    const result = await execute('screenshot', ['1'])
    expect(mockDebugger.sendCommand).toHaveBeenCalledWith('Page.captureScreenshot', { format: 'png' })
    expect(result).toHaveProperty('path')
  })
})

describe('pdf', () => {
  test('captures and writes PDF', async () => {
    setTmpPath('/tmp/test-session')
    mockDebugger.sendCommand.mockResolvedValueOnce({ data: 'base64pdf' })
    await execute('open', [])
    const result = await execute('pdf', ['1'])
    expect(mockDebugger.sendCommand).toHaveBeenCalledWith('Page.printToPDF', {})
    expect(result).toHaveProperty('path')
  })
})

describe('eval', () => {
  test('evaluates expression', async () => {
    mockDebugger.sendCommand.mockResolvedValueOnce({
      result: { value: 'hello', type: 'string' },
    })
    await execute('open', [])
    const result = await execute('eval', ['1', 'document.title'])
    expect(mockDebugger.sendCommand).toHaveBeenCalledWith('Runtime.evaluate', {
      expression: 'document.title',
      returnByValue: true,
      awaitPromise: true,
    })
    expect(result).toBe('hello')
  })

  test('returns error on exception', async () => {
    mockDebugger.sendCommand.mockResolvedValueOnce({
      result: {},
      exceptionDetails: { text: 'ReferenceError' },
    })
    await execute('open', [])
    const result = await execute('eval', ['1', 'badVar'])
    expect(result).toEqual({ error: 'ReferenceError' })
  })
})

describe('query', () => {
  test('returns element outerHTML', async () => {
    mockDebugger.sendCommand.mockResolvedValueOnce({
      result: { value: '<div>hi</div>', type: 'string' },
    })
    await execute('open', [])
    const result = await execute('query', ['1', '.test'])
    expect(result).toBe('<div>hi</div>')
  })
})

describe('query-all', () => {
  test('returns matching elements', async () => {
    mockDebugger.sendCommand.mockResolvedValueOnce({
      result: { value: ['<li>a</li>', '<li>b</li>'], type: 'object' },
    })
    await execute('open', [])
    const result = await execute('query-all', ['1', 'li'])
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('styles', () => {
  test('returns computed styles for specific props', async () => {
    mockDebugger.sendCommand.mockResolvedValueOnce({
      result: { value: { display: 'flex', width: '100px' }, type: 'object' },
    })
    await execute('open', [])
    const result = await execute('styles', ['1', '.panel', 'display', 'width'])
    expect(result).toEqual({ display: 'flex', width: '100px' })
  })
})

describe('html', () => {
  test('returns full page HTML', async () => {
    mockDebugger.sendCommand.mockResolvedValueOnce({
      result: { value: '<html></html>', type: 'string' },
    })
    await execute('open', [])
    const result = await execute('html', ['1'])
    expect(typeof result).toBe('string')
  })
})

describe('click', () => {
  test('clicks element via eval', async () => {
    mockDebugger.sendCommand.mockResolvedValueOnce({
      result: { value: true, type: 'boolean' },
    })
    await execute('open', [])
    const result = await execute('click', ['1', 'button.submit'])
    expect(result).toBe(true)
  })
})

describe('type', () => {
  test('focuses and types text', async () => {
    mockDebugger.sendCommand
      .mockResolvedValueOnce({ result: { value: true } })
      .mockResolvedValueOnce({})
    await execute('open', [])
    const result = await execute('type', ['1', 'input.name', 'hello'])
    expect(mockDebugger.sendCommand).toHaveBeenCalledWith('Input.insertText', { text: 'hello' })
  })
})

describe('url', () => {
  test('returns current URL', async () => {
    mockWebContents.getURL.mockReturnValue('https://example.com')
    await execute('open', [])
    const result = await execute('url', ['1'])
    expect(result).toBe('https://example.com')
  })
})

describe('cdp (raw)', () => {
  test('sends raw CDP command', async () => {
    mockDebugger.sendCommand.mockResolvedValueOnce({ nodes: [] })
    await execute('open', [])
    const result = await execute('cdp', ['1', 'DOM.getDocument', '{"depth":1}'])
    expect(mockDebugger.sendCommand).toHaveBeenCalledWith('DOM.getDocument', { depth: 1 })
  })
})

describe('console', () => {
  test('collects console messages for duration', async () => {
    await execute('open', [])
    mockDebugger.on.mockImplementation((event, cb) => {
      if (event === 'message') {
        setTimeout(() => cb({}, 'Runtime.consoleAPICalled', {
          type: 'log',
          args: [{ value: 'hello' }],
        }), 10)
      }
    })
    const result = await execute('console', ['1', '50'])
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('network', () => {
  test('collects network requests for duration', async () => {
    await execute('open', [])
    mockDebugger.sendCommand.mockResolvedValueOnce({})
    mockDebugger.on.mockImplementation((event, cb) => {
      if (event === 'message') {
        setTimeout(() => cb({}, 'Network.requestWillBeSent', {
          request: { method: 'GET', url: 'https://example.com' },
        }), 10)
      }
    })
    const result = await execute('network', ['1', '50'])
    expect(Array.isArray(result)).toBe(true)
  })
})
