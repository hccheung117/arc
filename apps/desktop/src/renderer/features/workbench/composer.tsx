import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Textarea } from '@renderer/components/ui/textarea'
import { ImagePlus, Sparkles, Send } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

/*
  UX Decision: Always-Enabled Composer

  This component intentionally does NOT accept a `disabled` prop, differing from traditional
  "lock-safe" UX patterns. The composer remains interactive at all times, allowing users to
  type freely without artificial blocking states.

  Philosophy:
  - User agency over system control: let users decide when to interact
  - Responsive feel: no "waiting" or "locked" visual states
  - Modern chat UX: always ready for the next message
  - Validation happens at send-time, not input-time

  The parent component (workspace) handles edge cases like missing conversation or model.
*/

interface ComposerProps {
  onSend?: (message: string) => void | Promise<void>
  isStreaming?: boolean
}

export function Composer({ onSend, isStreaming }: ComposerProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight)
    const maxHeight = lineHeight * 8
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
  }, [message])

  const handleSend = async () => {
    if (!message.trim() || !onSend || isStreaming) return

    const messageToSend = message.trim()

    await onSend(messageToSend)
    // Only clear input AFTER successful send
    // On error, promise rejects and message is preserved for retry
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className="mx-4 mb-4 p-3 border border-sidebar-border">
      <div className="space-y-2">
        {/**
         * Typography: Composer uses text-body (16px) to match the message display area,
         * providing WYSIWYG consistency. We override the Textarea component's default
         * text-label (15px) because the composer is a content creation tool where
         * visual consistency with messages matters more than compact UI chrome.
         *
         * @see tailwind.config.js - Typography scale definition
         */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter here, press ↵ to send"
          className="min-h-0 resize-none border-0 p-0 text-body focus-visible:ring-0 focus-visible:ring-offset-0 outline-none shadow-none"
          rows={1}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSend}
            disabled={!message.trim() || isStreaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
