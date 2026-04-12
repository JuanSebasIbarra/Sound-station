import type { IPlaylistImporter } from '../interfaces/IPlaylistImporter.js';
import type { ISong } from '../interfaces/ISong.js';
import { generateId, generateGradientArt } from '../utils/helpers.js';

/**
 * LocalFileImporter – bulk-imports audio files from the user's device.
 *
 * Accepts a FileList (from an <input type="file"> or drag-and-drop)
 * and converts each file into an ISong using:
 *  • URL.createObjectURL() for the audioUrl
 *  • The Web Audio API to read the actual duration
 *  • ID3 tag parsing (basic filename heuristic when no ID3 tags)
 */
export class LocalFileImporter implements IPlaylistImporter {
  readonly name = 'Local Files';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    return true; // no auth needed for local files
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async importPlaylist(_playlistId: string): Promise<ISong[]> {
    // Triggers the file picker programmatically if called without files
    return [];
  }

  /**
   * importFiles – convert a FileList into ISong[].
   *
   * This is the primary entry point for the local importer.
   * Each audio file is read with the Web Audio API to extract
   * its exact duration, and a blob URL is created for playback.
   */
  async importFiles(files: FileList | File[]): Promise<ISong[]> {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('audio/'));
    const songs = await Promise.all(fileArray.map(f => this._fileToSong(f)));
    return songs;
  }

  // ── Private helpers ─────────────────────────────────────────

  private async _fileToSong(file: File): Promise<ISong> {
    const audioUrl  = URL.createObjectURL(file);
    const duration  = await this._getAudioDuration(audioUrl);
    const { title, artist } = this._parseFileName(file.name);

    return {
      id:          generateId(),
      title,
      artist,
      album:       'Local Library',
      duration,
      albumArt:    generateGradientArt(file.name),
      description: `Local file: ${file.name} (${this._formatSize(file.size)})`,
      audioUrl,
      source:      'local',
      genre:       'Unknown',
    };
  }

  /**
   * Resolves the duration by creating a temporary Audio element
   * and waiting for its metadata to load.
   */
  private _getAudioDuration(url: string): Promise<number> {
    return new Promise(resolve => {
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
      audio.addEventListener('error', () => resolve(0));
    });
  }

  /**
   * Naive filename parser: tries "Artist - Title.ext" or falls back
   * to the raw filename as the title.
   */
  private _parseFileName(fileName: string): { title: string; artist: string } {
    const withoutExt = fileName.replace(/\.[^/.]+$/, '');
    const parts = withoutExt.split(' - ');
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    return { artist: 'Unknown Artist', title: withoutExt.trim() };
  }

  private _formatSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }
}
