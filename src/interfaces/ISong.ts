/**
 * ISong – canonical song data model used throughout Sound-Station.
 * All importers (Spotify, Apple Music, YouTube, Local) map their
 * provider-specific payloads into this interface before handing
 * them to the DoublyLinkedList.
 */
export type SongSource = 'spotify' | 'apple_music' | 'youtube_music' | 'local';

export interface ISong {
  /** UUID-like unique identifier generated at import time */
  readonly id: string;

  /** Display title of the track */
  title: string;

  /** Primary artist name */
  artist: string;

  /** Album or playlist name */
  album: string;

  /** Track duration in seconds */
  duration: number;

  /** URL or data-URI for the album artwork image */
  albumArt: string;

  /** Short bio / description (from artist metadata service or provider) */
  description: string;

  /** Musical genre (optional) */
  genre?: string;

  /** Release year (optional) */
  year?: number;

  /** Stream URL or provider media locator; local/Spotify use HTMLAudioElement, YouTube stores the watch URL here */
  audioUrl?: string;

  /** Origin service */
  source?: SongSource;

  /** Whether the user has "liked" this song */
  liked?: boolean;

  /** Optional plain text lyrics authored/imported by user */
  lyrics?: string;

  /** Optional list of collaborator artist names */
  collaborators?: string[];

  /** Stable local path/key used for M3U persistence and re-linking */
  localFilePath?: string;

  /** Local file availability state after startup re-linking */
  isFileAvailable?: boolean;

  /** Optional reason for unavailable local files */
  missingReason?: 'not_found' | 'permission_denied' | 'unknown';
}
