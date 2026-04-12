import type { IPlaylistImporter } from '../interfaces/IPlaylistImporter.js';
import type { ISong } from '../interfaces/ISong.js';
import { generateId, generateGradientArt } from '../utils/helpers.js';

/**
 * SpotifyImporter – Strategy for importing playlists from Spotify.
 *
 * In production: swap _mockFetch() for real Spotify Web API calls
 * using the OAuth access token stored in `credentials`.
 *
 * API ref: https://developer.spotify.com/documentation/web-api/
 */
export class SpotifyImporter implements IPlaylistImporter {
  readonly name = 'Spotify';

  private _accessToken = '';

  async authenticate(credentials: Record<string, string>): Promise<boolean> {
    // In a real app: exchange client credentials or authorization code for a token
    this._accessToken = credentials['apiKey'] ?? credentials['token'] ?? 'demo';
    console.info(`[SpotifyImporter] Authenticated token=${this._accessToken.slice(0,4)}… (demo mode)`);
    return true;
  }

  async importPlaylist(playlistId: string): Promise<ISong[]> {
    console.info(`[SpotifyImporter] Importing playlist "${playlistId}" …`);

    // Real implementation would call:
    //   GET https://api.spotify.com/v1/playlists/{playlist_id}/tracks
    // Here we return simulated data.
    await this._delay(600);

    return this._mockSpotifyTracks(playlistId);
  }

  async search(query: string): Promise<ISong[]> {
    await this._delay(400);
    return this._mockSpotifyTracks(query).slice(0, 5);
  }

  // ── Mock helpers ────────────────────────────────────────────

  private _mockSpotifyTracks(seed: string): ISong[] {
    const tracks = [
      { title: 'Blinding Lights',    artist: 'The Weeknd',    album: 'After Hours',          duration: 200 },
      { title: 'As It Was',          artist: 'Harry Styles',  album: "Harry's House",         duration: 167 },
      { title: 'Stay',               artist: 'The Kid LAROI', album: 'F*CK LOVE 3',           duration: 141 },
      { title: 'Heat Waves',         artist: 'Glass Animals', album: 'Dreamland',             duration: 238 },
      { title: 'Levitating',         artist: 'Dua Lipa',      album: 'Future Nostalgia',      duration: 203 },
      { title: 'Peaches',            artist: 'Justin Bieber', album: 'Justice',               duration: 198 },
      { title: 'Good 4 U',           artist: 'Olivia Rodrigo',album: 'SOUR',                  duration: 178 },
      { title: 'Montero',            artist: 'Lil Nas X',     album: 'Montero',               duration: 137 },
    ];

    return tracks.map(t => ({
      id:          generateId(),
      title:       t.title,
      artist:      t.artist,
      album:       t.album,
      duration:    t.duration,
      albumArt:    generateGradientArt(`${t.title}${seed}`),
      description: `A hit track by ${t.artist} from the album "${t.album}".`,
      source:      'spotify' as const,
      genre:       'Pop',
      year:        2021,
    }));
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
