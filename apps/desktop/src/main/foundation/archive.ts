/**
 * Archive Operations
 *
 * Generic ZIP archive operations for profile packages.
 * Handles extraction, validation, and file reading from archives.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import AdmZip from 'adm-zip'

/**
 * Opens a ZIP archive with error handling.
 */
function openArchive(archivePath: string) {
  try {
    return new AdmZip(archivePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to open archive: ${message}`)
  }
}

/**
 * Validates that no ZIP entries contain path traversal sequences.
 */
function validateArchiveEntries(zip: AdmZip, targetDir: string) {
  const resolvedTarget = path.resolve(targetDir)

  for (const entry of zip.getEntries()) {
    const entryPath = path.normalize(entry.entryName)
    const fullPath = path.join(resolvedTarget, entryPath)

    if (!fullPath.startsWith(resolvedTarget)) {
      throw new Error(`Archive contains invalid path: ${entry.entryName}`)
    }
  }
}

/**
 * Extracts a ZIP archive to a target directory.
 * Creates the target directory if it doesn't exist.
 * Validates paths to prevent directory traversal attacks.
 */
export async function extractArchive(archivePath: string, targetDir: string) {
  await fs.mkdir(targetDir, { recursive: true })

  const zip = openArchive(archivePath)
  validateArchiveEntries(zip, targetDir)
  zip.extractAllTo(targetDir, true)
}

/**
 * Reads a file from a ZIP archive without extracting.
 * Returns null if entry not found or on error.
 */
export function readArchiveEntry(archivePath: string, entryPath: string) {
  try {
    const zip = openArchive(archivePath)
    const entry = zip.getEntry(entryPath)
    if (!entry) return null
    return entry.getData().toString('utf-8')
  } catch {
    return null
  }
}

/**
 * Lists entries in a directory within a ZIP archive.
 * Returns empty array on error.
 */
export function listArchiveDirectory(archivePath: string, dirPath: string) {
  try {
    const zip = openArchive(archivePath)
    const normalizedDir = dirPath.endsWith('/') ? dirPath : `${dirPath}/`

    const entries = zip.getEntries()
    const names = new Set<string>()

    for (const entry of entries) {
      if (entry.entryName.startsWith(normalizedDir) && entry.entryName !== normalizedDir) {
        const relativePath = entry.entryName.slice(normalizedDir.length)
        const topLevel = relativePath.split('/')[0]
        if (topLevel) {
          names.add(topLevel)
        }
      }
    }

    return Array.from(names)
  } catch {
    return []
  }
}

/**
 * Checks if an archive contains a specific entry.
 */
export function archiveHasEntry(archivePath: string, entryPath: string) {
  try {
    const zip = openArchive(archivePath)
    return zip.getEntry(entryPath) !== null
  } catch {
    return false
  }
}

/**
 * Creates a ZIP archive from a directory.
 */
export async function createArchive(sourceDir: string, archivePath: string) {
  const zip = new AdmZip()
  zip.addLocalFolder(sourceDir)
  await fs.mkdir(path.dirname(archivePath), { recursive: true })
  zip.writeZip(archivePath)
}
