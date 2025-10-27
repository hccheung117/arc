import { useState, useRef } from "react";
import type { ImageAttachment } from "@arc/core/core.js";
import { validateImage } from "./image-validation";

export function useImageAttachments() {
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImageAttachment = async (file: File) => {
    const error = validateImage(file);
    if (error) {
      setAttachmentError(error);
      return;
    }

    setAttachmentError("");

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const attachment: ImageAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        data: base64,
        mimeType: file.type,
        size: file.size,
        name: file.name,
      };

      setAttachedImages((prev) => [...prev, attachment]);
    };
    reader.readAsDataURL(file);
  };

  const removeImageAttachment = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAttachments = () => {
    setAttachedImages([]);
    setAttachmentError("");
  };

  const clearAttachmentError = () => {
    setAttachmentError("");
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(addImageAttachment);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    files.filter((file) => file.type.startsWith("image/")).forEach(addImageAttachment);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          addImageAttachment(file);
        }
      }
    }
  };

  return {
    attachedImages,
    attachmentError,
    fileInputRef,
    addImageAttachment,
    removeImageAttachment,
    clearAttachments,
    clearAttachmentError,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handlePaste,
  };
}
