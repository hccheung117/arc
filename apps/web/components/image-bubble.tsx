"use client";

import { useState } from "react";
import type { ImageAttachment } from "@/lib/types";
import { ImageLightbox } from "./image-lightbox";

interface ImageBubbleProps {
  attachments: ImageAttachment[];
}

export function ImageBubble({ attachments }: ImageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (attachments.length === 0) return null;

  const handleImageClick = (index: number) => {
    setSelectedIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      {/* Horizontal strip layout */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {attachments.map((attachment, index) => (
          <button
            key={attachment.id}
            onClick={() => handleImageClick(index)}
            className="relative flex-shrink-0 rounded-lg overflow-hidden bg-secondary hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring group"
            aria-label={`View image ${index + 1} of ${attachments.length}`}
          >
            {/* Image thumbnail */}
            <img
              src={attachment.objectUrl}
              alt={attachment.file.name}
              className="h-48 w-auto max-w-xs object-cover"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

            {/* Image counter badge for multiple images */}
            {attachments.length > 1 && (
              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full">
                {index + 1}/{attachments.length}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={attachments}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        index={selectedIndex}
        onIndexChange={setSelectedIndex}
      />
    </>
  );
}
