import { push } from '../router.js'
import { getSettings } from '../services/settings.js'

export const pushSettings = async () => {
  const { assignments } = await getSettings()
  push('settings:listen', { assignmentKeys: Object.keys(assignments) })
}
