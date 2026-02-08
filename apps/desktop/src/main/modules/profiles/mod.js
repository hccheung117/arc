/**
 * Profiles Module
 *
 * Pure repository for profile packages.
 * No concept of "active" profile — that belongs to settings.
 */

import { defineModule } from '@main/kernel/module'
import * as biz from './business'

export default defineModule({
  capabilities: ['jsonFile', 'archive', 'glob', 'binaryFile', 'logger'],
  depends: ['ai'],
  provides: (deps, caps, emit) => {
    const ctx = { ...caps, ai: deps.ai }

    return {
      install: async (input) => {
        ctx.logger.info(`Install request: ${input.filePath}`)
        const result = await biz.installProfile(ctx, input.filePath)
        emit('installed', result)
        return result
      },

      uninstall: async (input) => {
        await biz.uninstallProfile(ctx, input.profileId)
        emit('uninstalled', input.profileId)
      },

      list: () => biz.listProfiles(ctx),

      read: (input) =>
        biz.readProfile(ctx, input.profileId),

      readSettings: (input) =>
        biz.readProfileSettings(ctx, input.profileId),

      syncModels: (input) =>
        biz.syncModels(ctx, input.profileId),

      clearModelsCache: () => biz.clearModelsCache(ctx),

      listModels: () => biz.listModels(ctx),

      getProviderConfig: (input) =>
        biz.getProviderConfig(ctx, input.profileId, input.providerId),

      getStreamConfig: (input) =>
        biz.getStreamConfig(ctx, input.profileId, input.providerId, input.modelId),
    }
  },
  emits: ['installed', 'uninstalled'],
  paths: ['profiles/', 'app/cache/'],
})
