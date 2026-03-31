import { useSession } from '@/contexts/SessionContext'

export const isLLMBusy = (status) =>
  status === 'streaming'

export function useLLMLock() {
  const { status } = useSession()
  return isLLMBusy(status)
}
