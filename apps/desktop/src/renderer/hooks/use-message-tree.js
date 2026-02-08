import { useState, useEffect, useCallback, useMemo } from 'react'
import { resolveTree } from '@renderer/lib/message-tree'
import { getMessages } from '@renderer/lib/messages'
import { getBranchSelections, setBranchSelection } from '@renderer/lib/ui-state-db'

/**
 * Manage message tree state with branch selection
 */
export function useMessageTree(threadId) {
  const [allMessages, setAllMessages] = useState([])
  const [branchSelections, setBranchSelections] = useState({})

  // Load messages and branch selections on mount
  useEffect(() => {
    const load = async () => {
      const [{ messages }, selections] = await Promise.all([
        getMessages(threadId),
        getBranchSelections(threadId),
      ])
      setAllMessages(messages)
      setBranchSelections(selections)
    }
    load()
  }, [threadId])

  // Compute display path using domain function
  const { path: displayMessages, branchPoints } = useMemo(
    () => resolveTree(allMessages, branchSelections),
    [allMessages, branchSelections],
  )

  const switchBranch = useCallback(
    (parentId, index) => {
      const key = parentId ?? 'root'
      setBranchSelections((prev) => ({ ...prev, [key]: index }))
      setBranchSelection(threadId, parentId, index)
    },
    [threadId],
  )

  const addMessage = useCallback((message) => {
    setAllMessages((prev) => [...prev, message])
  }, [])

  const setMessages = useCallback((messages) => {
    setAllMessages(messages)
  }, [])

  const reload = useCallback(async () => {
    const { messages } = await getMessages(threadId)
    setAllMessages(messages)
  }, [threadId])

  return {
    allMessages,
    displayMessages,
    branchPoints,
    switchBranch,
    addMessage,
    setMessages,
    reload,
  }
}
