import { push } from '../router.js'
import { getSettings } from '../services/settings.js'

export const pushSettings = async () => {
  const { assignments } = await getSettings()
  push('settings:feed', { assignmentKeys: Object.keys(assignments) })
}
