import { useState, useEffect } from 'react'
import { Zap, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EchoResponse, PongEvent } from '../../types/arc-api'

/**
 * IPCDemo - Verification component for M1/M2 milestones
 *
 * Demonstrates the 3 canonical IPC patterns via window.arc:
 * - Rule 1: One-Way (log)
 * - Rule 2: Two-Way (echo)
 * - Rule 3: Push (ping/pong)
 */
export function IPCDemo() {
  const [logMessage, setLogMessage] = useState('Hello from renderer!')
  const [echoInput, setEchoInput] = useState('')
  const [echoResponse, setEchoResponse] = useState<EchoResponse | null>(null)
  const [echoLoading, setEchoLoading] = useState(false)
  const [pongEvent, setPongEvent] = useState<PongEvent | null>(null)
  const [pingPending, setPingPending] = useState(false)

  useEffect(() => {
    const unsubscribe = window.arc.onPong((event) => {
      setPongEvent(event)
      setPingPending(false)
    })
    return unsubscribe
  }, [])

  function handleLog() {
    window.arc.log(logMessage)
  }

  async function handleEcho() {
    if (!echoInput.trim()) return
    setEchoLoading(true)
    try {
      const result = await window.arc.echo(echoInput)
      setEchoResponse(result)
    } finally {
      setEchoLoading(false)
    }
  }

  function handlePing() {
    setPingPending(true)
    setPongEvent(null)
    window.arc.ping()
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-title font-semibold">IPC Demo (M1/M2)</h1>
        <p className="text-muted-foreground text-body">
          Testing <code className="text-meta bg-muted px-1 rounded">window.arc</code> API patterns
        </p>
      </div>

      {/* Rule 1: One-Way */}
      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-primary" />
          <span className="text-label font-medium">Rule 1: One-Way</span>
          <span className="text-meta text-muted-foreground">(Renderer → Main)</span>
        </div>
        <p className="text-meta text-muted-foreground">
          Fire-and-forget. Check the terminal for output.
        </p>
        <div className="flex gap-2">
          <Input
            value={logMessage}
            onChange={(e) => setLogMessage(e.target.value)}
            placeholder="Message to log"
          />
          <Button onClick={handleLog}>Log</Button>
        </div>
      </div>

      {/* Rule 2: Two-Way */}
      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <span className="text-label font-medium">Rule 2: Two-Way</span>
          <span className="text-meta text-muted-foreground">(Request/Response)</span>
        </div>
        <p className="text-meta text-muted-foreground">
          Send a message, receive a transformed response.
        </p>
        <div className="flex gap-2">
          <Input
            value={echoInput}
            onChange={(e) => setEchoInput(e.target.value)}
            placeholder="Text to echo"
            onKeyDown={(e) => e.key === 'Enter' && handleEcho()}
          />
          <Button onClick={handleEcho} disabled={echoLoading || !echoInput.trim()}>
            {echoLoading ? 'Sending...' : 'Echo'}
          </Button>
        </div>
        {echoResponse && (
          <div className="rounded-lg bg-muted p-4 space-y-1">
            <p className="text-body font-medium">{echoResponse.uppercased}</p>
            <p className="text-meta text-muted-foreground">
              Original: {echoResponse.original} | Timestamp: {echoResponse.timestamp}
            </p>
          </div>
        )}
      </div>

      {/* Rule 3: Push */}
      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ArrowLeft className="h-5 w-5 text-primary" />
          <span className="text-label font-medium">Rule 3: Push</span>
          <span className="text-meta text-muted-foreground">(Main → Renderer)</span>
        </div>
        <p className="text-meta text-muted-foreground">
          Trigger ping, wait ~1s for pong event from main process.
        </p>
        <Button onClick={handlePing} disabled={pingPending}>
          {pingPending ? 'Waiting for pong...' : 'Ping'}
        </Button>
        {pongEvent && (
          <div className="rounded-lg bg-muted p-4 space-y-1">
            <p className="text-body font-medium">{pongEvent.message}</p>
            <p className="text-meta text-muted-foreground">
              Latency: {pongEvent.receivedAt - pongEvent.sentAt}ms
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
