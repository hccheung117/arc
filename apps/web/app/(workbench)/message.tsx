"use client"

import { useState } from "react"
import { BotMessageSquare, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Message as MessageType } from '@arc/contracts/src/messages'

interface MessageProps {
  message: MessageType
}

export function Message({ message }: MessageProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
  }
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-6">
        <div
          className="max-w-[70%]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="bg-muted rounded-2xl px-4 py-3">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="h-8 flex items-center justify-end">
            {isHovered && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCopy}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="mb-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3">
        <div className="shrink-0 mt-1">
          <BotMessageSquare className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          <div className="h-8 flex items-center justify-start">
            {isHovered && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCopy}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
