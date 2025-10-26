"use client";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import type { ImageAttachment } from "@arc/core/core.js";

interface ImageLightboxProps {
  images: ImageAttachment[];
  open: boolean;
  onClose: () => void;
  index: number;
  onIndexChange: (index: number) => void;
}

export function ImageLightbox({
  images,
  open,
  onClose,
  index,
  onIndexChange,
}: ImageLightboxProps) {
  // Convert ImageAttachment[] to lightbox slides format
  const slides = images.map((attachment, idx) => ({
    src: attachment.data,
    alt: `Image ${idx + 1}`,
  }));

  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={slides}
      index={index}
      on={{
        view: ({ index: newIndex }) => onIndexChange(newIndex),
      }}
      plugins={[Zoom]}
      animation={{ fade: 250 }}
      controller={{ closeOnBackdropClick: true }}
      zoom={{
        maxZoomPixelRatio: 3,
        scrollToZoom: true,
      }}
      // Styling to match Arc's theme
      styles={{
        container: {
          backgroundColor: "rgba(0, 0, 0, 0.9)",
        },
      }}
    />
  );
}
