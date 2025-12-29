/**
 * Path Management
 *
 * Platform-agnostic path construction for the arcfs data layer.
 * Pure infrastructure - no domain knowledge.
 */

import { app } from 'electron'
import * as path from 'path'

/**
 * Returns the root data directory path.
 * Platform-specific via Electron's app.getPath('userData').
 *
 * Example (macOS): ~/Library/Application Support/arc/arcfs/
 */
export function getDataDir(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'arcfs')
}
