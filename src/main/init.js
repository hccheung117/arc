// DO NOT DELETE — both main.js (GUI) and cli/bootstrap.js (headless scripts)
// import this as their first module. It must run before any module that calls
// app.getPath('userData'). Route files (session, models, state, message) call
// resolve() at module scope, and ESM imports are hoisted, so this MUST live in
// a separate file imported first. Forge sets the name for packaged/dev builds,
// but CLI scripts run via raw `npx electron` where the default is "Electron"
// — without this, userData resolves to "Electron/" instead of "Arc Desktop/".
import { app } from 'electron'
import pkg from '../../package.json'
app.setName(pkg.productName)
