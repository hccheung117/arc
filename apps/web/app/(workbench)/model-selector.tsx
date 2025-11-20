'use client'

import { useState } from 'react'
import { Check, ChevronRight, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Model } from '@arc/contracts/src/models'

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
  selectedModel: Model
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

  const toggleFavorite = (modelId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        next.delete(modelId)
      } else {
        next.add(modelId)
      }
      return next
    })
  }

  // Filter models based on search query or favorites tab
  const filteredModels = models.filter((model) => {
    // If searching, search across ALL models (ignoring tabs)
    if (searchQuery) {
      // Match against model name or provider name
      return fuzzyMatch(searchQuery, model.name) || 
             fuzzyMatch(searchQuery, model.provider.name)
    }
    
    // If not searching, respect the tabs
    return showFavorites ? favorites.has(model.id) : true
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
          <span className="text-label font-semibold">
            {selectedModel.name}
            <span className="ml-2 text-muted-foreground font-normal">
              {selectedModel.provider.name}
            </span>
          </span>
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 opacity-50 transition-transform duration-200',
              open && 'rotate-90'
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align="start"
        style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.2)' }}
      >
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
              autoFocus
            />
          </div>
        </div>

        {/* Hide tabs when searching to keep UI clean */}
        {!searchQuery && (
          <div className="flex border-b">
            <button
              onClick={() => setShowFavorites(false)}
              className={cn(
                'flex-1 px-4 py-2 text-label font-medium transition-colors',
                !showFavorites
                  ? 'border-b-2 border-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Models
            </button>
            <button
              onClick={() => setShowFavorites(true)}
              className={cn(
                'flex-1 px-4 py-2 text-label font-medium transition-colors',
                showFavorites
                  ? 'border-b-2 border-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Favorites
            </button>
          </div>
        )}

        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {filteredModels.length === 0 ? (
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
                        const isSelected = selectedModel.id === model.id
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
                              <div className="text-label font-medium truncate">
                                {model.name}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(model.id)
                              }}
                              className={cn(
                                'shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                                isFavorite && 'opacity-100'
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
