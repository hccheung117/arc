"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImageAttachment as CoreImageAttachment } from "@arc/core/core.js";

interface ImageAttachmentChipProps {
  attachment: CoreImageAttachment;
  onRemove: () => void;
}

export function ImageAttachmentChip({ attachment, onRemove }: ImageAttachmentChipProps) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-secondary border border-border rounded-lg group hover:bg-secondary/80 transition-colors">
      {/* Thumbnail */}
      <div className="relative size-10 rounded overflow-hidden bg-background flex-shrink-0">
        <img
          src={attachment.data}
          alt="Image attachment"
          className="size-full object-cover"
        />
      </div>

      {/* File info */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium truncate max-w-[150px]">
          Image ({attachment.mimeType})
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
