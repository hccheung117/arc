import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Always return false as we want desktop experience even on smaller windows
  return false
}
