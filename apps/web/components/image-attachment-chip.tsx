"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImageAttachment } from "@/lib/types";

interface ImageAttachmentChipProps {
  attachment: ImageAttachment;
  onRemove: () => void;
}

export function ImageAttachmentChip({ attachment, onRemove }: ImageAttachmentChipProps) {
  // Format file size for display
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-secondary border border-border rounded-lg group hover:bg-secondary/80 transition-colors">
      {/* Thumbnail */}
      <div className="relative size-10 rounded overflow-hidden bg-background flex-shrink-0">
        <img
          src={attachment.objectUrl}
          alt={attachment.file.name}
          className="size-full object-cover"
        />
      </div>

      {/* File info */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium truncate max-w-[150px]">
          {attachment.file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatSize(attachment.size)}
        </p>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="size-5 p-0 opacity-60 hover:opacity-100 flex-shrink-0"
        aria-label="Remove attachment"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
