/**
 * IArtistMetadata – contract for the artist biography / metadata service.
 *
 * Mirrors Spotify's Artist bio feature.  Concrete implementations may
 * hit a real API (MusicBrainz, Last.fm, etc.) or return mock data.
 */
export interface IArtistMetadata {
  /** Fetch a short biography for the given artist name */
  getBio(artistName: string): Promise<string>;

  /** Fetch a representative image URL for the artist */
  getImageUrl(artistName: string): Promise<string>;

  /** Fetch top tracks for the given artist */
  getTopTracks(artistName: string): Promise<string[]>;
}
