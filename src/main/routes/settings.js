import { register, push } from '../router.js'
import { getSettings, setFavorite } from '../services/settings.js'

register('settings:set-favorite', async ({ provider, model }) => {
  await setFavorite(provider, model)
  await pushSettings()
})

export const pushSettings = async () => {
  const { assignments, favorites } = await getSettings()
  push('settings:feed', { assignmentKeys: Object.keys(assignments), favorites })
}
