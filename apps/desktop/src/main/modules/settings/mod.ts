/**
 * Settings Module
 *
 * Generic key-value settings with routing:
 * - `provider:*` keys route to profiles module (read-only)
 * - `favorites` key routes to local settings.json
 */

import { defineModule } from '@main/kernel/module'
import type jsonFileAdapter from './json-file'
import { createSettingsOperations } from './business'

type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
}

export default defineModule({
  capabilities: ['jsonFile'] as const,
  depends: ['profiles'] as const,
  provides: (deps, caps: Caps) =>
    createSettingsOperations(caps.jsonFile, deps.profiles as never),
  emits: [] as const,
  paths: ['app/settings.json'],
})
