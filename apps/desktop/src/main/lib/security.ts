import { safeStorage } from 'electron'

/**
 * Encrypts a sensitive string using Electron's safeStorage API.
 * Returns a base64 encoded string safe for DB storage.
 * Falls back to plaintext if safeStorage is unavailable (e.g. some Linux envs).
 */
export function encryptSecret(secret: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('safeStorage unavailable: Storing secret in plain text')
    return secret
  }
  return safeStorage.encryptString(secret).toString('base64')
}

/**
 * Decrypts a base64 encoded secret string.
 * Handles cases where the input might be legacy plaintext or if decryption fails.
 */
export function decryptSecret(encryptedBase64: string): string {
  if (!encryptedBase64) return ''

  // Fast path: if safeStorage isn't available, we can't decrypt anyway
  if (!safeStorage.isEncryptionAvailable()) {
    return encryptedBase64
  }

  try {
    const buffer = Buffer.from(encryptedBase64, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    // If decryption fails, it's likely:
    // 1. The string wasn't encrypted (legacy plaintext)
    // 2. It was encrypted on a different machine (safeStorage is machine-bound)
    // Return original string to handle legacy/fallback cases
    return encryptedBase64
  }
}
