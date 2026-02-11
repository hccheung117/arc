import { useState, useEffect } from 'react'

/**
 * Fetch data and re-fetch when the active profile changes.
 *
 * Subscribes to profile installed/uninstalled and settings activated events.
 * Fetcher is called immediately on mount and again on each event.
 */
export function useProfileReactive(fetcher) {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    const fetch = () => fetcher().then(setData)
    fetch()
    const unsub1 = window.arc.profiles.onInstalled(fetch)
    const unsub2 = window.arc.profiles.onUninstalled(fetch)
    const unsub3 = window.arc.settings.onActivated(fetch)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [fetcher])

  return data
}
