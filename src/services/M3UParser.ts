import type { ISong } from '../interfaces/ISong.js';
import { SongFactory } from '../factories/SongFactory.js';

interface ParseM3UOptions {
  fallbackAlbum?: string;
  fallbackArtist?: string;
}

export class M3UParser {
  parse(content: string, options?: ParseM3UOptions): ISong[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const songs: ISong[] = [];
    let pendingTitle = '';
    let pendingDuration = 0;

    lines.forEach((line) => {
      if (line.startsWith('#EXTINF:')) {
        const body = line.slice('#EXTINF:'.length);
        const [durationPart, titlePart] = body.split(',', 2);
        pendingDuration = Number.parseInt(durationPart ?? '0', 10) || 0;
        pendingTitle = (titlePart ?? '').trim();
        return;
      }

      if (line.startsWith('#')) {
        return;
      }

      const song = SongFactory.fromM3ULine({
        line,
        title: pendingTitle,
        duration: pendingDuration,
        fallbackArtist: options?.fallbackArtist,
        fallbackAlbum: options?.fallbackAlbum,
      });

      songs.push(song);
      pendingTitle = '';
      pendingDuration = 0;
    });

    return songs;
  }

  serialize(songs: ISong[]): string {
    const lines: string[] = ['#EXTM3U'];

    songs.forEach((song) => {
      const duration = Number.isFinite(song.duration) ? Math.floor(song.duration) : 0;
      lines.push(`#EXTINF:${duration},${song.artist} - ${song.title}`);
      lines.push(song.localFilePath || song.audioUrl || song.title);
    });

    return lines.join('\n');
  }
}
