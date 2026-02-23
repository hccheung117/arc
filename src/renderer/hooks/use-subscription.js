import { useEffect, useState } from "react"

export function useSubscription(route, initialValue) {
  const [data, setData] = useState(initialValue)

  useEffect(() => window.api.on(route, setData), [route])

  return data
}
