import { app } from 'electron'
import path from 'node:path'

export const resolve = (...segments) =>
  path.join(app.getPath('userData'), 'arcfs', ...segments)
