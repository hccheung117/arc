import type { BaseMetadata } from '../common/metadata.js';

/**
 * Audio segment with timestamp
 */
export interface AudioSegment {
  /** Segment ID */
  id: number;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Transcribed text for this segment */
  text: string;
  /** Confidence/probability score (0-1) */
  confidence?: number;
}

/**
 * Metadata for audio transcription
 */
export interface AudioMetadata extends BaseMetadata {
  /** Detected language (ISO 639-1 code) */
  language?: string;
  /** Duration of the audio in seconds */
  duration?: number;
  /** Timestamped segments (verbose mode only) */
  segments?: AudioSegment[];
}
