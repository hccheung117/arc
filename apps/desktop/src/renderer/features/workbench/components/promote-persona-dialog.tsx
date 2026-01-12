import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

interface PromotePersonaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  systemPrompt: string
}

export function PromotePersonaDialog({
  open,
  onOpenChange,
  systemPrompt,
}: PromotePersonaDialogProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }
    if (trimmedName.length > 50) {
      setError('Name must be 50 characters or less')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await window.arc.personas.create(trimmedName, systemPrompt)
      setName('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create persona')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting && name.trim()) {
      e.preventDefault()
      handleSave()
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('')
      setError(null)
      setIsSubmitting(false)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Persona</DialogTitle>
          <DialogDescription>
            Give this system prompt a name to reuse it later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Persona name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              maxLength={50}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="rounded-md bg-muted p-3 max-h-32 overflow-y-auto">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {systemPrompt || '(empty system prompt)'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
