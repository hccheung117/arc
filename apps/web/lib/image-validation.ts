export const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"] as const;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

type ValidImageType = (typeof VALID_IMAGE_TYPES)[number];

export function validateImage(file: File): string | null {
  if (!VALID_IMAGE_TYPES.includes(file.type as ValidImageType)) {
    return `Invalid file type. Only PNG, JPEG, and WebP images are supported.`;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return `File size exceeds 10MB limit. "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
  }

  return null;
}
