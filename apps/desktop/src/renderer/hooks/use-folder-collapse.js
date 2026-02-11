import { useState, useEffect } from 'react'
import { getFolderCollapsed, setFolderCollapsed } from '@renderer/lib/ui-state-db'

export function useFolderCollapse(folderId) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    getFolderCollapsed(folderId).then(setIsCollapsed)
  }, [folderId])

  const toggle = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    setFolderCollapsed(folderId, next)
  }

  return { isCollapsed, toggle }
}
