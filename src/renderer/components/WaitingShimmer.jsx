import { useEffect, useState } from "react"
import { Shimmer } from "@/components/ai-elements/shimmer"

export function WaitingShimmer({ children }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div className="text-sm text-muted-foreground">
      <Shimmer duration={1.5}>{children}</Shimmer>
    </div>
  )
}
