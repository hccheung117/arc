'use client'

import { useState } from 'react'
import { Check, ChevronDown, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Model, models, providers } from './models'

interface ModelSelectorProps {
  selectedModel: Model
  onModelSelect: (model: Model) => void
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

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

  const displayedModels = showFavorites
    ? models.filter((model) => favorites.has(model.id))
    : models

  const groupedModels = providers.map((provider) => ({
    provider,
    models: displayedModels.filter((model) => model.provider.id === provider.id),
  }))

  const handleModelSelect = (model: Model) => {
    onModelSelect(model)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="justify-between gap-2 px-0 hover:bg-transparent"
        >
          <span className="text-sm font-semibold">
            {selectedModel.name}
            <span className="ml-2 text-muted-foreground font-normal">
              {selectedModel.provider.name}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align="start"
        style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.2)' }}
      >
        <div className="flex border-b">
          <button
            onClick={() => setShowFavorites(false)}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
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
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              showFavorites
                ? 'border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Favorites
          </button>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {groupedModels.map((group, groupIndex) => {
              if (group.models.length === 0) return null

              return (
                <div key={group.provider.id}>
                  {groupIndex > 0 && <Separator className="my-2" />}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
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
                            <div className="text-sm font-medium truncate">
                              {model.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {model.description}
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
            })}
            {displayedModels.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                No favorite models yet. Star models to add them here.
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
