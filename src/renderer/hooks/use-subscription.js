import { useEffect, useState } from "react"

const cache = new Map()

export function useSubscription(route, initialValue) {
  const [data, setData] = useState(() => cache.get(route) ?? initialValue)

  useEffect(() => window.api.on(route, (val) => {
    cache.set(route, val)
    setData(val)
  }), [route])

  return data
}
