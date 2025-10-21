/**
 * Utilities for converting between Web and Core ImageAttachment formats
 *
 * Web format: Uses File objects and object URLs (browser-specific)
 * Core format: Uses base64 data URLs (platform-agnostic)
 */

import type { ImageAttachment as WebImageAttachment } from "../types";
import type { ImageAttachment as CoreImageAttachment } from "@arc/core/domain/ImageAttachment.js";

/**
 * Convert a File object to a base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as data URL"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert web ImageAttachment (with File) to core ImageAttachment (with base64)
 */
export async function webAttachmentToCore(
  webAttachment: WebImageAttachment
): Promise<CoreImageAttachment> {
  const data = await fileToBase64(webAttachment.file);

  return {
    id: webAttachment.id,
    data,
    mimeType: webAttachment.type,
    size: webAttachment.size,
    name: webAttachment.file.name,
  };
}

/**
 * Convert multiple web attachments to core format
 */
export async function webAttachmentsToCore(
  webAttachments: WebImageAttachment[]
): Promise<CoreImageAttachment[]> {
  return Promise.all(webAttachments.map(webAttachmentToCore));
}

/**
 * Convert core ImageAttachment (base64) to a blob URL for display
 *
 * Note: The caller is responsible for revoking the blob URL when done
 * via URL.revokeObjectURL(blobUrl)
 */
export function coreAttachmentToBlobUrl(
  coreAttachment: CoreImageAttachment
): string {
  // Extract base64 data from data URL if needed
  let base64Data = coreAttachment.data;
  if (base64Data.startsWith("data:")) {
    const commaIndex = base64Data.indexOf(",");
    if (commaIndex !== -1) {
      base64Data = base64Data.slice(commaIndex + 1);
    }
  }

  // Convert base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create blob and object URL
  const blob = new Blob([bytes], { type: coreAttachment.mimeType });
  return URL.createObjectURL(blob);
}
