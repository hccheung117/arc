import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, Search, Star } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@renderer/components/ui/popover'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/lib/utils'
import type { Model } from '@arc-types/models'

interface StoredFavorite {
  providerId: string
  modelId: string
}

// Composite key for efficient Set lookups
function favoriteKey(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`
}

// Accurate text measurement using Canvas API
// Creates canvas once and reuses context for performance
const measureTextWidth = (() => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null

  return (text: string): number => {
    if (!canvas) {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      // Match text-sm: 14px with system font stack from globals.css
      ctx.font = '14px ui-sans-serif, system-ui, sans-serif'
    }
    return ctx!.measureText(text).width
  }
})()

// Buffer for UI chrome - calculated from actual CSS values:
// ScrollArea padding (p-2 × 2): 16px + Item padding (px-2 × 2): 16px +
// Gap (gap-2): 8px + Star icon (h-4 w-4): 16px + Scrollbar: 12px
const UI_CHROME_BUFFER = 68

// Simple fuzzy matching utility
// Returns true if all characters in query appear in text in order
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  let queryIndex = 0
  let textIndex = 0

  while (queryIndex < q.length && textIndex < t.length) {
    if (q[queryIndex] === t[textIndex]) {
      queryIndex++
    }
    textIndex++
  }

  return queryIndex === q.length
}

interface ModelSelectorProps {
  selectedModel: Model | null
  onModelSelect: (model: Model) => void
  models: Model[]
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  models,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Calculate stable dimensions based on the full model list so layout doesn't jump during search/filtering
  const { width: popoverWidth, height: scrollHeight } = useMemo(() => {
    if (models.length === 0) return { width: 380, height: 200 }

    // Measure actual text widths using Canvas API for accuracy
    // This replaces the broken `charCount * 7` estimation that failed for wide/CJK characters
    const longestTextWidth = Math.max(...models.map((m) => measureTextWidth(m.name)), 0)

    // Width: actual measured text + buffer, clamped between 380px and 800px
    const calculatedWidth = Math.max(380, Math.min(800, Math.ceil(longestTextWidth) + UI_CHROME_BUFFER))

    // Height: estimate based on items, headers, and separators
    const providerIds = new Set(models.map((m) => m.provider.id))
    const providerCount = providerIds.size
    // Item ~36px, Header ~30px, Separator ~17px
    const estimatedHeight =
      models.length * 36 + providerCount * 30 + Math.max(0, providerCount - 1) * 17 + 20

    return { width: calculatedWidth, height: estimatedHeight }
  }, [models])

  useEffect(() => {
    window.arc.settings.get<StoredFavorite[]>({ key: 'favorites' }).then((saved) => {
      if (saved && saved.length > 0) {
        const validFavorites = saved.filter(
          (f) =>
            f &&
            typeof f === 'object' &&
            f.providerId &&
            f.modelId &&
            f.providerId !== 'undefined' &&
            f.modelId !== 'undefined'
        )
        if (validFavorites.length > 0) {
          const keys = validFavorites.map((f) => favoriteKey(f.providerId, f.modelId))
          setFavorites(new Set(keys))

          // Only show favorites tab if at least one favorite matches available models
          const hasMatchingFavorites = models.some((m) =>
            keys.includes(favoriteKey(m.provider.id, m.id))
          )
          if (hasMatchingFavorites) {
            setShowFavorites(true)
          }
        }
        if (validFavorites.length !== saved.length) {
          window.arc.settings.set({ key: 'favorites', value: validFavorites })
        }
      }
    })
  }, [models])

  const toggleFavorite = (model: Model) => {
    const key = favoriteKey(model.provider.id, model.id)
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      // Convert Set back to array of objects for storage
      // Split only on the first colon to preserve colons in modelId (e.g., "claude-haiku-4-5:thinking")
      const favoritesArray: StoredFavorite[] = Array.from(next).map((k) => {
        const colonIndex = k.indexOf(':')
        const providerId = k.slice(0, colonIndex)
        const modelId = k.slice(colonIndex + 1)
        return { providerId, modelId }
      })
      window.arc.settings.set({ key: 'favorites', value: favoritesArray })
      return next
    })
  }

  // Filter models based on search query or favorites tab
  const filteredModels = models.filter((model) => {
    const matchesSearch = searchQuery
      ? fuzzyMatch(searchQuery, model.name) ||
        fuzzyMatch(searchQuery, model.provider.name)
      : true

    const key = favoriteKey(model.provider.id, model.id)
    const matchesTab = showFavorites ? favorites.has(key) : true

    return matchesSearch && matchesTab
  })

  const providers = Array.from(
    new Map(filteredModels.map((model) => [model.provider.id, model.provider])).values()
  )

  const groupedModels = providers.map((provider) => ({
    provider,
    models: filteredModels.filter((model) => model.provider.id === provider.id),
  }))

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    // Clear search when closing
    if (!newOpen) {
      setSearchQuery('')
    }
  }

  const handleModelSelect = (model: Model) => {
    onModelSelect(model)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="justify-between gap-2 px-2 -ml-2"
        >
          {selectedModel ? (
            <span className="text-label font-medium">
              {selectedModel.name}
              <span className="ml-2 text-muted-foreground font-normal">
                {selectedModel.provider.name}
              </span>
            </span>
          ) : (
            <span className="text-label font-semibold text-muted-foreground">
              Select Model
            </span>
          )}
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 opacity-50 transition-transform duration-200',
              open && 'rotate-90'
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{
          width: popoverWidth,
          maxWidth: '85vw',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.2)',
        }}
      >
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="flex items-center bg-muted/50 rounded-lg p-1 h-8 shrink-0">
            <button
              onClick={() => setShowFavorites(false)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                !showFavorites
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              All
            </button>
            <button
              onClick={() => setShowFavorites(true)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                showFavorites
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              Favorites
            </button>
          </div>
        </div>

        <ScrollArea
          style={{ height: scrollHeight, maxHeight: '55vh' }}
          className="w-full"
        >
          <div className="p-2">
            {models.length === 0 ? (
              <div className="px-2 py-8 text-center text-label text-muted-foreground">
                No models available. Please configure models in settings.
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="px-2 py-8 text-center text-label text-muted-foreground">
                {searchQuery
                  ? `No models match "${searchQuery}"`
                  : "No favorite models yet. Star models to add them here."}
              </div>
            ) : (
              groupedModels.map((group, groupIndex) => {
                if (group.models.length === 0) return null

                return (
                  <div key={group.provider.id}>
                    {groupIndex > 0 && <Separator className="my-2" />}
                    <div className="px-2 py-1.5 text-meta font-semibold text-muted-foreground">
                      {group.provider.name}
                    </div>
                    <div className="space-y-0.5">
                      {group.models.map((model) => {
                        const isSelected = selectedModel?.id === model.id &&
                          selectedModel?.provider.id === model.provider.id
                        const isFavorite = favorites.has(
                          favoriteKey(model.provider.id, model.id)
                        )

                        return (
                          <div
                            key={`${model.provider.id}:${model.id}`}
                            className={cn(
                              'group relative flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors',
                              isSelected
                                ? 'bg-accent'
                                : 'hover:bg-accent/50'
                            )}
                            onClick={() => handleModelSelect(model)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate" title={model.name}>
                                {model.name}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(model)
                              }}
                              className={cn(
                                'shrink-0 transition-opacity',
                                isFavorite
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              )}
                            >
                              <Star
                                className={cn(
                                  'h-4 w-4',
                                  isFavorite
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-muted-foreground'
                                )}
                              />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
