import { test, expect } from '@playwright/test'
import { launchApp } from './helpers.js'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

let electronApp, window
let userDataDir
const tmpFiles = []

test.beforeAll(async () => {
  ;({ electronApp, window } = await launchApp())

  // Get the userData path so we can read workspace.json directly
  userDataDir = await electronApp.evaluate(({ app }) => app.getPath('userData'))
})

test.afterAll(async () => {
  await electronApp?.close()
  for (const f of tmpFiles) await fs.rm(f, { force: true })
})

// --- Helpers ---

async function createTempFile(name, content = 'test') {
  const fp = path.join(os.tmpdir(), `arc-e2e-ws-${Date.now()}-${name}`)
  await fs.writeFile(fp, content)
  tmpFiles.push(fp)
  return fp
}

async function readWorkspaceJson() {
  const fp = path.join(userDataDir, 'arcfs', 'workspace.json')
  try { return JSON.parse(await fs.readFile(fp, 'utf-8')) }
  catch { return [] }
}

async function invokeUpload(payload) {
  return window.evaluate(
    (p) => window.api.call('message:upload-attachment', p),
    payload,
  )
}

// --- Tests ---

test.describe('upload → workspace', () => {
  test.describe.configure({ mode: 'serial' })

  test('upload with local path adds it to workspace', async () => {
    const fp = await createTempFile('local.txt')

    await invokeUpload({
      path: fp,
      filename: 'local.txt',
      mediaType: 'text/plain',
    })

    const entries = await readWorkspaceJson()
    expect(entries).toContain(fp)
  })

  test('upload without path (paste) does not add to workspace', async () => {
    const before = await readWorkspaceJson()

    await invokeUpload({
      data: Array.from(Buffer.from('pasted-data')),
      filename: 'pasted.png',
      mediaType: 'image/png',
    })

    const after = await readWorkspaceJson()
    expect(after.length).toBe(before.length)
  })
})
