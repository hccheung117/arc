import { BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

let nextId = 1
let tmpPath = null
const windows = new Map()

export const setTmpPath = (p) => { tmpPath = p }

const getWindow = (id) => {
  const entry = windows.get(Number(id))
  if (!entry || entry.win.isDestroyed()) {
    windows.delete(Number(id))
    return null
  }
  return entry
}

const open = async (args) => {
  const [url] = args
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: { sandbox: true },
  })

  const id = nextId++
  win.webContents.debugger.attach('1.3')
  win.on('closed', () => windows.delete(id))
  windows.set(id, { id, win })

  if (url) await win.webContents.loadURL(url)
  return { windowId: id }
}

const withWindow = (fn) => async (args) => {
  if (!args[0]) return { error: 'Missing required argument: id' }
  const entry = getWindow(args[0])
  if (!entry) return { error: `Window not found: ${args[0]}` }
  return fn(entry, args.slice(1))
}

const cdpSend = (entry, method, params = {}) =>
  entry.win.webContents.debugger.sendCommand(method, params)

const evalInWindow = async (entry, expression) => {
  const { result, exceptionDetails } = await cdpSend(entry, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (exceptionDetails) return { error: exceptionDetails.text }
  return result.value ?? result.description ?? result.type
}

const sel = (s) => JSON.stringify(s)

const screenshot = withWindow(async (entry, args) => {
  const { data } = await cdpSend(entry, 'Page.captureScreenshot', { format: 'png' })
  const file = args[0] || path.join(tmpPath, `browser-screenshot-${entry.id}-${Date.now()}.png`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, Buffer.from(data, 'base64'))
  return { path: file }
})

const pdf = withWindow(async (entry, args) => {
  const { data } = await cdpSend(entry, 'Page.printToPDF')
  const file = args[0] || path.join(tmpPath, `browser-pdf-${Date.now()}.pdf`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, Buffer.from(data, 'base64'))
  return { path: file }
})

const html = withWindow((entry) =>
  evalInWindow(entry, 'document.documentElement.outerHTML'))

const query = withWindow((entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: selector' }
  return evalInWindow(entry, `document.querySelector(${sel(args[0])})?.outerHTML ?? 'No match'`)
})

const queryAll = withWindow((entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: selector' }
  return evalInWindow(entry, `(() => {
    const els = [...document.querySelectorAll(${sel(args[0])})];
    const limited = els.slice(0, 50).map(e => e.outerHTML);
    if (els.length > 50) limited.push('... and ' + (els.length - 50) + ' more');
    return limited;
  })()`)
})

const text = withWindow((entry, args) =>
  evalInWindow(entry, `document.querySelector(${sel(args[0] || 'body')})?.innerText ?? 'No match'`))

const attrs = withWindow((entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: selector' }
  return evalInWindow(entry, `(() => {
    const el = document.querySelector(${sel(args[0])});
    return el ? Object.fromEntries([...el.attributes].map(a => [a.name, a.value])) : null;
  })()`)
})

const box = withWindow((entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: selector' }
  return evalInWindow(entry, `(() => {
    const el = document.querySelector(${sel(args[0])});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  })()`)
})

const styles = withWindow((entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: selector' }
  const [s, ...props] = args
  return evalInWindow(entry, `(() => {
    const el = document.querySelector(${sel(s)});
    if (!el) return null;
    const cs = getComputedStyle(el);
    const keys = ${props.length ? JSON.stringify(props) : '[...cs]'};
    return Object.fromEntries(keys.map(p => [p, cs.getPropertyValue(p)]));
  })()`)
})

const evalCmd = withWindow((entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: expression' }
  return evalInWindow(entry, args.join(' '))
})

const click = withWindow((entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: selector' }
  return evalInWindow(entry, `(() => {
    const el = document.querySelector(${sel(args[0])});
    if (!el) return 'No match';
    el.click();
    return true;
  })()`)
})

const type = withWindow(async (entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: selector' }
  if (!args[1]) return { error: 'Missing required argument: text' }
  await evalInWindow(entry, `document.querySelector(${sel(args[0])})?.focus()`)
  await cdpSend(entry, 'Input.insertText', { text: args.slice(1).join(' ') })
  return { ok: true }
})

const select = withWindow((entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: selector' }
  if (!args[1]) return { error: 'Missing required argument: value' }
  return evalInWindow(entry, `(() => {
    const el = document.querySelector(${sel(args[0])});
    if (!el) return 'No match';
    el.value = ${sel(args[1])};
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`)
})

const url = withWindow(async ({ win }) => win.webContents.getURL())

const title = withWindow(async ({ win }) => win.webContents.getTitle())

const cookies = withWindow(async (entry) => {
  await cdpSend(entry, 'Network.enable')
  return (await cdpSend(entry, 'Network.getCookies')).cookies
})

const storage = withWindow((entry, args) => {
  const t = args[0] || 'local'
  return evalInWindow(entry, `Object.fromEntries(
    Object.keys(${t}Storage).map(k => [k, ${t}Storage.getItem(k)])
  )`)
})

const consoleListen = withWindow(async (entry, args) => {
  const ms = parseInt(args[0] || '2000')
  const messages = []
  await cdpSend(entry, 'Runtime.enable')
  const handler = (_, method, params) => {
    if (method === 'Runtime.consoleAPICalled') {
      messages.push({
        type: params.type,
        text: params.args.map(x => x.value ?? x.description ?? x.type).join(' '),
      })
    }
  }
  entry.win.webContents.debugger.on('message', handler)
  await new Promise(r => setTimeout(r, ms))
  entry.win.webContents.debugger.removeListener('message', handler)
  return messages
})

const network = withWindow(async (entry, args) => {
  const ms = parseInt(args[0] || '3000')
  const requests = []
  await cdpSend(entry, 'Network.enable')
  const handler = (_, method, params) => {
    if (method === 'Network.requestWillBeSent') {
      requests.push({ method: params.request.method, url: params.request.url })
    }
  }
  entry.win.webContents.debugger.on('message', handler)
  await new Promise(r => setTimeout(r, ms))
  entry.win.webContents.debugger.removeListener('message', handler)
  return requests
})

const cdp = withWindow(async (entry, args) => {
  if (!args[0]) return { error: 'Missing required argument: method' }
  let params = {}
  if (args[1]) {
    try { params = JSON.parse(args.slice(1).join(' ')) }
    catch (e) { return { error: `Invalid JSON: ${e.message}` } }
  }
  return cdpSend(entry, args[0], params)
})

const close = async (args) => {
  const entry = getWindow(args[0])
  if (!entry) return { error: `Window not found: ${args[0]}` }
  entry.win.close()
  windows.delete(Number(args[0]))
  return { closed: Number(args[0]) }
}

const list = async () =>
  [...windows.entries()]
    .filter(([, { win }]) => !win.isDestroyed())
    .map(([id, { win }]) => ({
      id,
      url: win.webContents.getURL(),
      title: win.webContents.getTitle(),
    }))

const navigate = withWindow(async ({ win }, args) => {
  if (!args[0]) return { error: 'Missing required argument: url' }
  await win.webContents.loadURL(args[0])
  return { url: args[0] }
})

const back = withWindow(async ({ win }) => {
  win.webContents.goBack()
  return { ok: true }
})

const forward = withWindow(async ({ win }) => {
  win.webContents.goForward()
  return { ok: true }
})

const reload = withWindow(async ({ win }) => {
  win.webContents.reload()
  return { ok: true }
})

const commands = { open, close, list, navigate, back, forward, reload, screenshot, pdf, html, query, 'query-all': queryAll, text, attrs, box, styles, eval: evalCmd, click, type, select, url, title, cookies, storage, console: consoleListen, network, cdp }

export const execute = async (command, args = []) => {
  const handler = commands[command]
  if (!handler) return { error: `Unknown command: ${command}` }
  return handler(args)
}

export const _reset = () => {
  for (const [, { win }] of windows) {
    if (!win.isDestroyed()) win.close()
  }
  windows.clear()
  nextId = 1
  tmpPath = null
}
