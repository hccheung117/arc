'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ImagePlus, Sparkles, Send } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface ComposerProps {
  onSend?: (message: string) => void | Promise<void>
  disabled?: boolean
}

export function Composer({ onSend, disabled = false }: ComposerProps) {
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
    if (!message.trim() || disabled || !onSend) return

    const messageToSend = message.trim()
    setMessage('')

    await onSend(messageToSend)
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
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter here, press ↵ to send"
          className="min-h-0 resize-none border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none shadow-none"
          rows={1}
          disabled={disabled}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={disabled}>
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={disabled}>
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSend}
            disabled={disabled || !message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
