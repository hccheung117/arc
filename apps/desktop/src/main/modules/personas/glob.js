import { defineCapability } from '@main/kernel/module'

export default defineCapability((glob) => ({
  listUserPersonaNames: () =>
    glob.readdir('app/personas'),

  listProfilePersonaNames: (profileId) =>
    glob.readdir(`profiles/${profileId}/personas`),
}))
