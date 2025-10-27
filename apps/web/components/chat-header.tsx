import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsIcon } from "lucide-react";
import { ModelSelector } from "@/components/model-selector";
import { keyboardShortcuts } from "@/lib/keyboard-shortcuts";
import type { ProviderModelGroup } from "@/lib/use-models";

interface ChatHeaderProps {
  selectedModel: { modelId: string; providerId: string } | null;
  onModelChange: (modelId: string, providerId: string) => void;
  hasProvider: boolean;
  isStreaming: boolean;
  groupedModels: ProviderModelGroup[];
  isLoading: boolean;
}

export function ChatHeader({
  selectedModel,
  onModelChange,
  hasProvider,
  isStreaming,
  groupedModels,
  isLoading,
}: ChatHeaderProps) {
  return (
    <header className="border-b h-14 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 ml-10 md:ml-0">
        <h1 className="text-lg font-semibold">Arc</h1>
        <div aria-label="Model selector">
          <ModelSelector
            value={selectedModel?.modelId || ""}
            onValueChange={onModelChange}
            disabled={!hasProvider || isStreaming}
            groupedModels={groupedModels}
            isLoading={isLoading}
          />
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>{keyboardShortcuts.openSettings.description} ({keyboardShortcuts.openSettings.label})</p>
        </TooltipContent>
      </Tooltip>
    </header>
  );
}
