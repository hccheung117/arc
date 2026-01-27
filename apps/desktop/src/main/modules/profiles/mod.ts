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

type Deps = {
  ai: biz.Ctx['ai']
  settings: biz.Ctx['settings']
}

export default defineModule({
  capabilities: ['jsonFile', 'archive', 'glob', 'binaryFile', 'logger'] as const,
  depends: ['ai', 'settings'] as const,
  provides: (deps, caps: Caps, emit) => {
    const ctx: biz.Ctx = { ...caps, ...(deps as Deps) }

    return {
      install: async (input: { filePath: string }) => {
        ctx.logger.info(`Install request: ${input.filePath}`)
        const result = await biz.installProfile(ctx, input.filePath)

        try {
          await biz.activateProfile(ctx, result.id)
          await biz.syncModels(ctx)
          await biz.mergeFavoriteModels(ctx)
        } catch (error) {
          await biz.uninstallProfile(ctx, result.id).catch(() => {})
          throw error
        }

        emit('installed', result)
        emit('activated', result.id)
        return result
      },

      uninstall: async (input: { profileId: string }) => {
        await biz.uninstallProfile(ctx, input.profileId)
        await biz.syncModels(ctx)
        emit('uninstalled', input.profileId)
      },

      activate: async (input: { profileId: string | null }) => {
        await biz.activateProfile(ctx, input.profileId)
        await biz.syncModels(ctx)
        await biz.mergeFavoriteModels(ctx)
        emit('activated', input.profileId)
      },

      list: () => biz.listProfiles(ctx),

      getActiveId: () => ctx.settings.getActiveProfile(),

      getActive: () => biz.getActiveProfile(ctx),

      getActiveDetails: async () => {
        const profile = await biz.getActiveProfile(ctx)
        if (!profile) return null
        return {
          id: profile.id,
          name: profile.name,
          modelAssignments: profile.modelAssignments,
        }
      },

      getProviderConfig: (input: { providerId: string }) =>
        biz.getProviderConfig(ctx, input.providerId),

      listModels: () => biz.listModels(ctx),

      lookupModelProvider: (input: { modelId: string }) =>
        biz.lookupModelProvider(ctx, input.modelId),

      getStreamConfig: (input: { modelId: string }) =>
        biz.getStreamConfig(ctx, input.modelId),
    }
  },
  emits: ['installed', 'uninstalled', 'activated'] as const,
  paths: ['profiles/', 'app/cache/'],
})
