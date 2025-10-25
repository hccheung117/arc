/**
 * Image attachment entity (platform-agnostic)
 *
 * Uses base64/data URL encoding for platform independence.
 * The UI layer is responsible for converting platform-specific
 * types (e.g., File in browsers) to this format.
 */
export interface ImageAttachment {
  id: string;
  /**
   * Base64-encoded image data or data URL
   * Example: "data:image/png;base64,iVBORw0KGgo..."
   */
  data: string;
  /**
   * MIME type of the image
   * Example: "image/png", "image/jpeg", "image/webp"
   */
  mimeType: string;
  /**
   * Size of the original file in bytes
   */
  size: number;
  /**
   * Optional filename
   */
  name?: string;
}
