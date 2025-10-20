"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  matchCount: number;
  currentMatch: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export function SearchBar({
  onSearch,
  matchCount,
  currentMatch,
  onNext,
  onPrevious,
  onClose,
}: SearchBarProps) {
  const [query, setQuery] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+G: Next match
      if ((e.metaKey || e.ctrlKey) && e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        onNext();
      }
      // Cmd/Ctrl+Shift+G: Previous match
      if ((e.metaKey || e.ctrlKey) && e.key === "g" && e.shiftKey) {
        e.preventDefault();
        onPrevious();
      }
      // Escape: Close search
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onPrevious, onClose]);

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2 bg-background">
      <Input
        type="text"
        placeholder="Search in conversation..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1"
        autoFocus
      />

      {matchCount > 0 && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {currentMatch} of {matchCount}
        </span>
      )}

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={matchCount === 0}
          title="Previous match (Cmd+Shift+G)"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={matchCount === 0}
          title="Next match (Cmd+G)"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          title="Close search (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
