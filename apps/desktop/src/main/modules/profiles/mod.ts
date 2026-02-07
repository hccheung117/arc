/**
 * Profiles Module
 *
 * Pure repository for profile packages.
 * No concept of "active" profile — that belongs to settings.
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

type Deps = {
  ai: biz.Ctx['ai']
}

export default defineModule({
  capabilities: ['jsonFile', 'archive', 'glob', 'binaryFile', 'logger'] as const,
  depends: ['ai'] as const,
  provides: (deps, caps: Caps, emit) => {
    const ctx: biz.Ctx = { ...caps, ...(deps as Deps) }

    return {
      install: async (input: { filePath: string }) => {
        ctx.logger.info(`Install request: ${input.filePath}`)
        const result = await biz.installProfile(ctx, input.filePath)
        emit('installed', result)
        return result
      },

      uninstall: async (input: { profileId: string }) => {
        await biz.uninstallProfile(ctx, input.profileId)
        emit('uninstalled', input.profileId)
      },

      list: () => biz.listProfiles(ctx),

      read: (input: { profileId: string }) =>
        biz.readProfile(ctx, input.profileId),

      readSettings: (input: { profileId: string }) =>
        biz.readProfileSettings(ctx, input.profileId),

      syncModels: (input: { profileId: string }) =>
        biz.syncModels(ctx, input.profileId),

      clearModelsCache: () => biz.clearModelsCache(ctx),

      listModels: () => biz.listModels(ctx),

      getProviderConfig: (input: { profileId: string; providerId: string }) =>
        biz.getProviderConfig(ctx, input.profileId, input.providerId),

      getStreamConfig: (input: { profileId: string; providerId: string; modelId: string }) =>
        biz.getStreamConfig(ctx, input.profileId, input.providerId, input.modelId),
    }
  },
  emits: ['installed', 'uninstalled'] as const,
  paths: ['profiles/', 'app/cache/'],
})
