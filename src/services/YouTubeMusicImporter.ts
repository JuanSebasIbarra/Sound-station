import type { IPlaylistImporter } from '../interfaces/IPlaylistImporter.js';
import type { ISong } from '../interfaces/ISong.js';
import { generateId, generateGradientArt } from '../utils/helpers.js';

/**
 * YouTubeMusicImporter – Strategy for importing playlists from YouTube Music.
 *
 * In production: use the YouTube Data API v3 with an OAuth 2.0 token.
 * YouTube Music playlists are regular YouTube playlists, so the same
 * endpoint works: GET /youtube/v3/playlistItems?part=snippet&playlistId=…
 *
 * API ref: https://developers.google.com/youtube/v3/docs/playlistItems
 */
export class YouTubeMusicImporter implements IPlaylistImporter {
  readonly name = 'YouTube Music';

  private _apiKey = '';

  async authenticate(credentials: Record<string, string>): Promise<boolean> {
    this._apiKey = credentials['apiKey'] ?? 'demo';
    console.info(`[YouTubeMusicImporter] API key set: ${this._apiKey.slice(0, 4)}… (demo mode)`);
    return true;
  }

  async importPlaylist(playlistId: string): Promise<ISong[]> {
    console.info(`[YouTubeMusicImporter] Importing playlist "${playlistId}" …`);

    // Real implementation would call:
    //   GET https://www.googleapis.com/youtube/v3/playlistItems
    //       ?part=snippet&maxResults=50&playlistId={id}&key={apiKey}
    await this._delay(800);

    return this._mockYouTubeTracks(playlistId);
  }

  async search(query: string): Promise<ISong[]> {
    await this._delay(600);
    return this._mockYouTubeTracks(query).slice(0, 5);
  }

  // ── Mock helpers ────────────────────────────────────────────

  private _mockYouTubeTracks(seed: string): ISong[] {
    const tracks = [
      { title: 'Butter',               artist: 'BTS',              album: 'Butter (Single)',   duration: 164 },
      { title: 'Permission to Dance',  artist: 'BTS',              album: 'Permission to Dance', duration: 188 },
      { title: 'Mood',                 artist: '24kGoldn',         album: 'El Dorado',         duration: 141 },
      { title: 'Leave The Door Open',  artist: 'Silk Sonic',       album: 'An Evening with Silk Sonic', duration: 244 },
      { title: 'Happier Than Ever',    artist: 'Billie Eilish',    album: 'Happier Than Ever', duration: 298 },
      { title: 'Kiss Me More',         artist: 'Doja Cat',         album: 'Planet Her',        duration: 208 },
      { title: 'MONTERO',              artist: 'Lil Nas X',        album: 'MONTERO',           duration: 137 },
      { title: 'Essence',              artist: 'Wizkid',           album: 'Made in Lagos',     duration: 248 },
    ];

    return tracks.map(t => ({
      id:          generateId(),
      title:       t.title,
      artist:      t.artist,
      album:       t.album,
      duration:    t.duration,
      albumArt:    generateGradientArt(`yt${t.title}${seed}`),
      description: `From YouTube Music – "${t.title}" by ${t.artist}.`,
      source:      'youtube_music' as const,
      genre:       'R&B / Pop',
      year:        2021,
    }));
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
