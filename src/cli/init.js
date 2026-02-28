// Standalone module so ES import ordering guarantees this runs before
// route imports. routes/session.js calls resolve('sessions') at module
// top-level, which reads app.getPath('userData') — the app name must
// already be set or userData resolves to "Electron/" instead of "arc-desktop/".
import { app } from 'electron'
import pkg from '../../package.json'
app.setName(pkg.productName ?? pkg.name)
