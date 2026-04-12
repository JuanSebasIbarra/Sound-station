import type { IPlaylistImporter } from '../interfaces/IPlaylistImporter.js';
import type { ISong } from '../interfaces/ISong.js';
import { generateId, generateGradientArt } from '../utils/helpers.js';

/**
 * AppleMusicImporter – Strategy for importing playlists from Apple Music.
 *
 * In production: use the MusicKit JS SDK or Apple Music API with a
 * developer token (JWT signed with a Music ID private key).
 *
 * API ref: https://developer.apple.com/documentation/applemusicapi/
 */
export class AppleMusicImporter implements IPlaylistImporter {
  readonly name = 'Apple Music';

  private _developerToken = '';

  async authenticate(credentials: Record<string, string>): Promise<boolean> {
    this._developerToken = credentials['apiKey'] ?? credentials['token'] ?? 'demo';
    console.info(`[AppleMusicImporter] Token set: ${this._developerToken.slice(0, 4)}… (demo mode)`);
    return true;
  }

  async importPlaylist(playlistId: string): Promise<ISong[]> {
    console.info(`[AppleMusicImporter] Importing playlist "${playlistId}" …`);

    // Real implementation would call:
    //   GET https://api.music.apple.com/v1/me/library/playlists/{id}/tracks
    //   Authorization: Bearer {developerToken}
    await this._delay(700);

    return this._mockAppleTracks(playlistId);
  }

  async search(query: string): Promise<ISong[]> {
    await this._delay(500);
    return this._mockAppleTracks(query).slice(0, 5);
  }

  // ── Mock helpers ────────────────────────────────────────────

  private _mockAppleTracks(seed: string): ISong[] {
    const tracks = [
      { title: 'drivers license',    artist: 'Olivia Rodrigo', album: 'SOUR',                duration: 242 },
      { title: 'Positions',          artist: 'Ariana Grande',  album: 'Positions',           duration: 172 },
      { title: 'Bad Guy',            artist: 'Billie Eilish',  album: 'WHEN WE ALL FALL ASLEEP', duration: 194 },
      { title: 'Watermelon Sugar',   artist: 'Harry Styles',   album: 'Fine Line',           duration: 174 },
      { title: 'Dynamite',           artist: 'BTS',            album: 'BE',                  duration: 199 },
      { title: 'Say So',             artist: 'Doja Cat',       album: "Hot Pink",            duration: 237 },
      { title: 'Circles',            artist: 'Post Malone',    album: "Hollywood's Bleeding", duration: 215 },
      { title: 'Rockstar',           artist: 'DaBaby',         album: 'KIRK',                duration: 181 },
    ];

    return tracks.map(t => ({
      id:          generateId(),
      title:       t.title,
      artist:      t.artist,
      album:       t.album,
      duration:    t.duration,
      albumArt:    generateGradientArt(`apple${t.title}${seed}`),
      description: `"${t.title}" – a standout track on "${t.album}" by ${t.artist}.`,
      source:      'apple_music' as const,
      genre:       'Pop',
      year:        2020,
    }));
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
