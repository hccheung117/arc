import { useState, useEffect } from 'react'
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

  useEffect(() => {
    window.arc.config.get<string[]>('favorites').then((saved) => {
      if (saved && saved.length > 0) {
        setFavorites(new Set(saved))
        setShowFavorites(true)
      }
    })
  }, [])

  const toggleFavorite = (modelId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        next.delete(modelId)
      } else {
        next.add(modelId)
      }

      window.arc.config.set('favorites', Array.from(next))
      return next
    })
  }

  // Filter models based on search query or favorites tab
  const filteredModels = models.filter((model) => {
    const matchesSearch = searchQuery
      ? fuzzyMatch(searchQuery, model.name) ||
        fuzzyMatch(searchQuery, model.provider.name)
      : true

    const matchesTab = showFavorites ? favorites.has(model.id) : true

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
        className="w-[380px] p-0"
        align="start"
        style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.2)' }}
      >
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
              autoFocus
            />
          </div>
          <div className="flex items-center bg-muted/50 rounded-lg p-1 h-9 shrink-0">
            <button
              onClick={() => setShowFavorites(false)}
              className={cn(
                'px-3 py-1 text-meta font-medium rounded-md transition-all',
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
                'px-3 py-1 text-meta font-medium rounded-md transition-all',
                showFavorites
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              Favorites
            </button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
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
                        const isSelected = selectedModel?.id === model.id
                        const isFavorite = favorites.has(model.id)

                        return (
                          <div
                            key={model.id}
                            className={cn(
                              'group relative flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors',
                              isSelected
                                ? 'bg-accent'
                                : 'hover:bg-accent/50'
                            )}
                            onClick={() => handleModelSelect(model)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-label truncate" title={model.name}>
                                {model.name}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(model.id)
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
