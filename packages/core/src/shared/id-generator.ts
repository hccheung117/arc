/**
 * Generate a unique ID using timestamp and random string
 *
 * Format: {timestamp}-{random}
 * Example: "1234567890123-abc123def"
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
