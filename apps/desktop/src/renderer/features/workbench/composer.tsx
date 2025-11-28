import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Textarea } from '@renderer/components/ui/textarea'
import { ImagePlus, Send, X } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createId } from '@paralleldrive/cuid2'
import type { AttachmentInput } from '@arc-types/arc-api'

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

/** Local attachment state for preview */
interface ComposerAttachment {
  id: string
  file: File
  preview: string // data: URL for immediate display
  mimeType: string
}

interface ComposerProps {
  onSend?: (message: string, attachments?: AttachmentInput[]) => void | Promise<void>
  isStreaming?: boolean
}

/** Accepted image MIME types */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export function Composer({ onSend, isStreaming }: ComposerProps) {
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight)
    const maxHeight = lineHeight * 8
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
  }, [message])

  /** Convert File to ComposerAttachment with data URL preview */
  const fileToAttachment = useCallback((file: File): Promise<ComposerAttachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          id: createId(),
          file,
          preview: reader.result as string,
          mimeType: file.type,
        })
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  /** Add files as attachments */
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type))
      if (imageFiles.length === 0) return

      const newAttachments = await Promise.all(imageFiles.map(fileToAttachment))
      setAttachments((prev) => [...prev, ...newAttachments])
    },
    [fileToAttachment],
  )

  /** Remove an attachment by ID */
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  /** Handle file input change */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
      e.target.value = '' // Reset to allow re-selecting same file
    }
  }

  /** Handle paste events for images */
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const imageFiles: File[] = []

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      addFiles(imageFiles)
    }
  }

  /** Handle drag events */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files)
    }
  }

  /** Convert attachments to IPC-ready format */
  const toAttachmentInputs = async (): Promise<AttachmentInput[]> => {
    return Promise.all(
      attachments.map(async (att) => {
        // Extract base64 data from data URL
        const base64 = att.preview.split(',')[1]
        return {
          type: 'image' as const,
          data: base64,
          mimeType: att.mimeType,
          name: att.file.name,
        }
      }),
    )
  }

  const handleSend = async () => {
    const hasContent = message.trim() || attachments.length > 0
    if (!hasContent || !onSend || isStreaming) return

    const messageToSend = message.trim()
    const attachmentInputs = attachments.length > 0 ? await toAttachmentInputs() : undefined

    await onSend(messageToSend, attachmentInputs)
    // Only clear input AFTER successful send
    setMessage('')
    setAttachments([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = (message.trim() || attachments.length > 0) && !isStreaming

  return (
    <Card
      className={`mx-4 mb-4 p-3 border transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-sidebar-border'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="space-y-2">
        {/* Attachment Thumbnails */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {attachments.map((att) => (
              <div key={att.id} className="relative group">
                <img
                  src={att.preview}
                  alt="Attachment preview"
                  className="h-16 w-16 object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

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
          onPaste={handlePaste}
          placeholder="Enter here, press ↵ to send"
          className="min-h-0 resize-none border-0 p-0 text-body focus-visible:ring-0 focus-visible:ring-offset-0 outline-none shadow-none"
          rows={1}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSend}
            disabled={!canSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
