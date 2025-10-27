import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchIcon } from "lucide-react";
import { NoGlobalSearchResultsState } from "@/components/empty-states";
import type { SearchResult } from "@arc/core/core.js";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  globalSearchResults: SearchResult[];
  onResultClick: (result: SearchResult) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  globalSearchQuery,
  setGlobalSearchQuery,
  globalSearchResults,
  onResultClick,
}: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        onOpenAutoFocus={(e) => {
          // Ensure search input gets focus when dialog opens
          if (e.currentTarget instanceof HTMLElement) {
            const input = e.currentTarget.querySelector("input");
            if (input) {
              e.preventDefault();
              setTimeout(() => input.focus(), 0);
            }
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Search Across All Chats</DialogTitle>
          <DialogDescription>
            Find messages in any conversation
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
          <SearchIcon className="size-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            className="border-0 shadow-none focus-visible:ring-0 px-0"
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            autoFocus
            aria-label="Search messages across all chats"
          />
        </div>

        {globalSearchResults.length > 0 && (
          <ScrollArea className="max-h-96">
            <div className="space-y-2 pr-4">
              {globalSearchResults.map((result) => {
                const preview = result.message.content.slice(0, 100);
                const timestamp = new Date(result.message.createdAt).toLocaleString();

                return (
                  <button
                    key={result.message.id}
                    onClick={() => onResultClick(result)}
                    className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {result.chatTitle}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timestamp}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 text-foreground">
                      {preview}{result.message.content.length > 100 ? "..." : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {globalSearchQuery && globalSearchResults.length === 0 && (
          <NoGlobalSearchResultsState query={globalSearchQuery} />
        )}

        {!globalSearchQuery && (
          <div className="text-sm text-muted-foreground">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-accent font-mono text-xs">
              Esc
            </kbd>{" "}
            to close
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
