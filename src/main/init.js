// Must run before any module that calls app.getPath('userData'),
// otherwise userData resolves to "Electron/" instead of "arc-desktop/".
import { app } from 'electron'
import pkg from '../../package.json'
app.setName(pkg.name)
