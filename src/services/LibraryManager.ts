import type { ISong } from '../interfaces/ISong.js';
import type { ILibraryState } from '../interfaces/ILibraryState.js';
import { Artist } from '../models/Artist.js';
import { StorageService } from './StorageService.js';

export class LibraryManager {
  private static instance: LibraryManager | null = null;

  static getInstance(storageService?: StorageService): LibraryManager {
    if (!LibraryManager.instance) {
      LibraryManager.instance = new LibraryManager(storageService ?? new StorageService());
    }
    return LibraryManager.instance;
  }

  private readonly artists = new Map<string, Artist>();
  private playbackHistory: string[] = [];
  private initialized = false;

  private constructor(private readonly storageService: StorageService) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.load();
    this.initialized = true;
  }

  recordSongPlay(song: ISong): void {
    const artist = this.getOrCreateArtist(song.artist || 'Unknown Artist');
    artist.touch();

    const albumName = song.album?.trim() || 'Singles';
    artist.saveAlbum(albumName, [song]);

    this.playbackHistory.unshift(song.id);
    this.playbackHistory = this.playbackHistory.slice(0, 200);
    this.save();
  }

  saveAlbum(artistName: string, albumName: string, songs: ISong[]): void {
    const artist = this.getOrCreateArtist(artistName || 'Unknown Artist');
    artist.saveAlbum(albumName || 'Singles', songs);
    this.save();
  }

  getArtists(): Artist[] {
    return Array.from(this.artists.values()).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }

  getArtist(name: string): Artist | null {
    return this.artists.get(name) ?? null;
  }

  rebuildFromSongs(songs: ISong[]): void {
    const historySnapshot = this.playbackHistory.slice(0, 200);
    this.artists.clear();

    songs.forEach((song) => {
      const artist = this.getOrCreateArtist(song.artist || 'Unknown Artist');
      artist.saveAlbum(song.album || 'Singles', [song]);
    });

    this.playbackHistory = historySnapshot;
    this.save();
  }

  getState(): ILibraryState {
    return {
      artists: this.getArtists().reduce<ILibraryState['artists']>((acc, artist) => {
        acc[artist.name] = artist.toJSON();
        return acc;
      }, {}),
      playbackHistory: this.playbackHistory.slice(),
    };
  }

  syncFromState(state: ILibraryState): void {
    this.artists.clear();
    Object.values(state.artists).forEach((storedArtist) => {
      const artist = Artist.fromStoredArtist(storedArtist);
      this.artists.set(artist.name, artist);
    });
    this.playbackHistory = state.playbackHistory.slice(0, 200);
  }

  private async load(): Promise<void> {
    const payload = await this.storageService.loadAppStateAsync();
    if (!payload?.library) return;
    this.syncFromState(payload.library);
  }

  private save(): void {
    void this.storageService.saveLibraryState(this.getState());
  }

  private getOrCreateArtist(artistName: string): Artist {
    const normalizedName = artistName.trim() || 'Unknown Artist';
    const existing = this.artists.get(normalizedName);
    if (existing) return existing;

    const artist = new Artist(normalizedName);
    this.artists.set(normalizedName, artist);
    return artist;
  }
}
