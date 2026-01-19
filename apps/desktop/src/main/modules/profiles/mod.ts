import { defineModule } from '@main/kernel/module'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  getActiveProfile,
  getProviderConfig,
} from '@main/lib/profile/operations'

export default defineModule({
  capabilities: ['jsonFile', 'archive', 'logger'] as const,
  depends: [] as const,
  provides: () => ({
    install: installProfile,
    uninstall: uninstallProfile,
    activate: activateProfile,
    list: listProfiles,
    getActiveId: getActiveProfileId,
    getActive: getActiveProfile,
    getProviderConfig,
  }),
  emits: ['installed', 'uninstalled', 'activated'] as const,
  paths: ['profiles/'],
})
