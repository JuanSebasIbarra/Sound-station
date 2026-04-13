import type { ISong } from '../interfaces/ISong.js';
import type { IStoredArtist } from '../interfaces/ILibraryState.js';
import { Album } from './Album.js';

export class Artist {
  private readonly albums = new Map<string, Album>();

  constructor(
    public readonly name: string,
    private _lastPlayedAt: number = Date.now(),
  ) {}

  get lastPlayedAt(): number {
    return this._lastPlayedAt;
  }

  touch(): void {
    this._lastPlayedAt = Date.now();
  }

  saveAlbum(albumName: string, songs: ISong[]): Album {
    const normalizedName = albumName.trim() || 'Singles';
    const existing = this.albums.get(normalizedName);
    if (existing) {
      existing.addSongs(songs);
      this.touch();
      return existing;
    }

    const album = new Album(normalizedName);
    album.addSongs(songs);
    this.albums.set(normalizedName, album);
    this.touch();
    return album;
  }

  getAlbum(albumName: string): Album | null {
    return this.albums.get(albumName) ?? null;
  }

  getAlbums(): Album[] {
    return Array.from(this.albums.values()).sort((a, b) => b.savedAt - a.savedAt);
  }

  toJSON(): IStoredArtist {
    return {
      name: this.name,
      lastPlayedAt: this._lastPlayedAt,
      albums: this.getAlbums().reduce<Record<string, ReturnType<Album['toJSON']>>>((acc, album) => {
        acc[album.name] = album.toJSON();
        return acc;
      }, {}),
    };
  }

  static fromStoredArtist(stored: IStoredArtist): Artist {
    const model = new Artist(stored.name, stored.lastPlayedAt);
    Object.values(stored.albums).forEach((album) => {
      model.albums.set(album.name, Album.fromStoredAlbum(album));
    });
    return model;
  }
}
