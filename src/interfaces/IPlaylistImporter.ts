import type { ISong } from './ISong.js';

/**
 * IPlaylistImporter – Strategy interface.
 *
 * Each streaming-service integration (Spotify, Apple Music, YouTube Music)
 * and the LocalFileImporter implement this interface so that the Player can
 * accept any importer without knowing the concrete type (Open/Closed Principle).
 */
export interface IPlaylistImporter {
  /** Human-readable name shown in the UI (e.g. "Spotify") */
  readonly name: string;

  /**
   * Authenticate with the provider using arbitrary credentials.
   * @returns true when authentication succeeds.
   */
  authenticate(credentials: Record<string, string>): Promise<boolean>;

  /**
   * Fetch all songs from a playlist identified by `playlistId`.
   * In demo / mock mode returns simulated data.
   */
  importPlaylist(playlistId: string): Promise<ISong[]>;

  /**
   * Optionally search the provider for tracks matching a query.
   */
  search?(query: string): Promise<ISong[]>;
}
