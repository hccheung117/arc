import { register } from '../router.js'
import { defineChannel } from '../channel.js'
import { getSettings, setFavorite, getTypography, setTypography } from '../services/settings.js'

export const settings = defineChannel('settings:feed', async () => {
  const { assignments, favorites } = await getSettings()
  return { assignmentKeys: Object.keys(assignments), favorites }
})

register('settings:set-favorite', settings.mutate(({ provider, model }) => setFavorite(provider, model)))

export const typography = defineChannel('settings:typography', getTypography)

register('settings:set-typography', typography.mutate((patch) => setTypography(patch)))
