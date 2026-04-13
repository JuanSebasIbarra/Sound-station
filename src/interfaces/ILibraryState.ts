import type { SongSource } from './ISong.js';

export interface IM3URegistryEntry {
  playlistId: string;
  playlistName: string;
  source: SongSource;
  m3uPath: string;
  m3uContent: string;
  updatedAt: number;
}

export interface IStoredSongRef {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  albumArt: string;
  source?: SongSource;
  localFilePath?: string;
  collaborators?: string[];
}

export interface IStoredAlbum {
  name: string;
  savedAt: number;
  songs: IStoredSongRef[];
}

export interface IStoredArtist {
  name: string;
  lastPlayedAt: number;
  albums: Record<string, IStoredAlbum>;
}

export interface ILibraryState {
  artists: Record<string, IStoredArtist>;
  playbackHistory: string[];
}
