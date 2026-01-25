/**
 * Profiles Module
 *
 * Profile lifecycle, provider configuration, and model discovery.
 * Depends on AI module for model fetching.
 */

import { defineModule } from '@main/kernel/module'
import type jsonFileAdapter from './json-file'
import type archiveAdapter from './archive'
import type globAdapter from './glob'
import type binaryFileAdapter from './binary-file'
import type loggerAdapter from './logger'
import * as biz from './business'

type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
  archive: ReturnType<typeof archiveAdapter.factory>
  glob: ReturnType<typeof globAdapter.factory>
  binaryFile: ReturnType<typeof binaryFileAdapter.factory>
  logger: ReturnType<typeof loggerAdapter.factory>
}

export default defineModule({
  capabilities: ['jsonFile', 'archive', 'glob', 'binaryFile', 'logger'] as const,
  depends: ['ai', 'settings'] as const,
  provides: (deps, caps: Caps, emit) => {
    const { jsonFile, archive, glob, binaryFile, logger } = caps
    const ai = deps.ai as biz.AiDep
    const settings = deps.settings as biz.SettingsDep

    return {
      install: async (input: { filePath: string }) => {
        logger.info(`Install request: ${input.filePath}`)
        const result = await biz.installProfile(jsonFile, archive, binaryFile, input.filePath)

        await biz.activateProfile(settings, jsonFile, glob, binaryFile, result.id)
        await biz.syncModels(settings, jsonFile, binaryFile, glob, ai, logger)
        await biz.mergeFavoriteModels(settings, jsonFile, binaryFile)

        emit('installed', result)
        emit('activated', result.id)

        return result
      },

      uninstall: async (input: { profileId: string }) => {
        await biz.uninstallProfile(settings, binaryFile, input.profileId)
        await biz.syncModels(settings, jsonFile, binaryFile, glob, ai, logger)
        emit('uninstalled', input.profileId)
      },

      activate: async (input: { profileId: string | null }) => {
        await biz.activateProfile(settings, jsonFile, glob, binaryFile, input.profileId)
        await biz.syncModels(settings, jsonFile, binaryFile, glob, ai, logger)
        await biz.mergeFavoriteModels(settings, jsonFile, binaryFile)
        emit('activated', input.profileId)
      },

      list: () => biz.listProfiles(jsonFile, glob, binaryFile),

      getActiveId: () => settings.getActiveProfile(),

      getActive: () => biz.getActiveProfile(settings, jsonFile, binaryFile),

      getActiveDetails: async () => {
        const profile = await biz.getActiveProfile(settings, jsonFile, binaryFile)
        if (!profile) return null
        return {
          id: profile.id,
          name: profile.name,
          modelAssignments: profile.modelAssignments,
        }
      },

      getProviderConfig: (input: { providerId: string }) =>
        biz.getProviderConfig(settings, jsonFile, binaryFile, input.providerId),

      listModels: () => biz.listModels(jsonFile),

      lookupModelProvider: (input: { modelId: string }) =>
        biz.lookupModelProvider(jsonFile, input.modelId),
    }
  },
  emits: ['installed', 'uninstalled', 'activated'] as const,
  paths: ['profiles/', 'app/cache/'],
})
