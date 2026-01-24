import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedGlob = ReturnType<FoundationCapabilities['glob']>

export default defineCapability((glob: ScopedGlob) => ({
  listUserPersonaNames: () =>
    glob.readdir('app/personas'),

  listProfilePersonaNames: (profileId: string) =>
    glob.readdir(`profiles/${profileId}/personas`),
}))
