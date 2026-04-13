import type { ISong } from '../interfaces/ISong.js';
import { generateGradientArt, generateId } from '../utils/helpers.js';

interface M3ULineInput {
  line: string;
  title?: string;
  duration?: number;
  fallbackArtist?: string;
  fallbackAlbum?: string;
}

export class SongFactory {
  static fromM3ULine(input: M3ULineInput): ISong {
    const sanitizedLine = input.line.trim();
    const cleanTitle = (input.title?.trim() || this.fileNameFromPath(sanitizedLine)).trim();
    const inferred = this.inferArtistAndTitle(cleanTitle, input.fallbackArtist);

    return {
      id: generateId(),
      title: inferred.title,
      artist: inferred.artist,
      album: input.fallbackAlbum?.trim() || 'Imported from M3U',
      duration: Math.max(0, Math.floor(input.duration ?? 0)),
      albumArt: generateGradientArt(cleanTitle),
      description: `M3U entry: ${sanitizedLine}`,
      source: 'local',
      audioUrl: undefined,
      localFilePath: sanitizedLine,
      isFileAvailable: false,
      missingReason: 'not_found',
    };
  }

  private static fileNameFromPath(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const rawName = normalized.split('/').pop() || normalized;
    return rawName.replace(/\.[^/.]+$/, '');
  }

  private static inferArtistAndTitle(value: string, fallbackArtist?: string): { artist: string; title: string } {
    const parts = value.split(' - ').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      return {
        artist: parts[0] || fallbackArtist || 'Unknown Artist',
        title: parts.slice(1).join(' - ') || value,
      };
    }

    return {
      artist: fallbackArtist || 'Unknown Artist',
      title: value,
    };
  }
}
