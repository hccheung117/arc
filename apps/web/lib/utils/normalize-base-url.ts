/**
 * Known endpoint paths that should be stripped from base URLs
 * These are consistent across official and proxy APIs
 */
const ENDPOINT_PATHS = [
  "/chat/completions",
  "/completions",
  "/messages",
  "/models",
  "/embeddings",
  "/generate",
  "/generateContent",
  "/streamGenerateContent",
  "/audio/transcriptions",
  "/audio/translations",
  "/audio/speech",
  "/images/generations",
  "/images/edits",
  "/images/variations",
  "/moderations",
];

/**
 * Basic URL cleanup
 * - Ensure https:// protocol
 * - Remove trailing slashes
 * - Trim whitespace
 * - Strip known endpoint paths
 */
export function cleanupBaseUrl(url: string): string {
  // Trim whitespace
  url = url.trim();

  // Ensure protocol (default to https)
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Upgrade http to https
  if (url.startsWith("http://")) {
    url = url.replace("http://", "https://");
  }

  // Strip known endpoint paths (case-insensitive)
  for (const path of ENDPOINT_PATHS) {
    const regex = new RegExp(path + "/?$", "i");
    url = url.replace(regex, "");
  }

  // Remove trailing slash
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }

  return url;
}

/**
 * Generate URL variations to try during detection
 * Version paths may or may not be present in proxy URLs
 */
export function generateUrlVariations(
  cleanedUrl: string,
  provider: "openai" | "anthropic" | "google"
): string[] {
  const variations: string[] = [];

  // Always try the cleaned URL as-is first
  variations.push(cleanedUrl);

  // Generate variations based on provider
  switch (provider) {
    case "openai":
    case "anthropic":
      // Try with /v1 if not already present
      if (!cleanedUrl.endsWith("/v1")) {
        variations.push(`${cleanedUrl}/v1`);
      }
      break;

    case "google":
      // Try /v1beta first (current default), then /v1
      if (!cleanedUrl.endsWith("/v1beta") && !cleanedUrl.endsWith("/v1")) {
        variations.push(`${cleanedUrl}/v1beta`);
        variations.push(`${cleanedUrl}/v1`);
      } else if (cleanedUrl.endsWith("/v1")) {
        // If it has /v1, also try /v1beta
        variations.push(cleanedUrl.replace(/\/v1$/, "/v1beta"));
      } else if (cleanedUrl.endsWith("/v1beta")) {
        // If it has /v1beta, also try /v1
        variations.push(cleanedUrl.replace(/\/v1beta$/, "/v1"));
      }
      break;
  }

  // Remove duplicates while preserving order
  return [...new Set(variations)];
}

/**
 * Normalize a base URL for a specific provider
 * Returns cleaned URL ready for variation testing
 */
export function normalizeBaseUrl(url: string | undefined): string {
  if (!url) {
    return "";
  }

  return cleanupBaseUrl(url);
}
