import type { ISong } from '../interfaces/ISong.js';
import type { IUserPlaylist, UserPlaylistSource } from '../interfaces/IUserPlaylist.js';
import { generateId, generateGradientArt } from '../utils/helpers.js';

interface PersistedState {
  songsById: Record<string, ISong>;
  queueSongIds: string[];
  playlists: IUserPlaylist[];
}

interface CreatePlaylistInput {
  name: string;
  source: UserPlaylistSource;
  songs: ISong[];
  coverArt?: string;
}

/**
 * PlaylistService
 *
 * Central CRUD + persistence layer for playlists and songs.
 * Keeps LocalStorage as source of truth and can rehydrate
 * the Player's Doubly Linked List queue at startup.
 */
export class PlaylistService {
  private static readonly STORAGE_KEY = 'sound-station.state.v2';

  private state: PersistedState = {
    songsById: {},
    queueSongIds: [],
    playlists: [],
  };

  constructor() {
    this.load();
  }

  getPlaylists(): IUserPlaylist[] {
    return this.state.playlists.slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  getPlaylistById(playlistId: string): IUserPlaylist | null {
    return this.state.playlists.find((playlist) => playlist.id === playlistId) ?? null;
  }

  getSongsForPlaylist(playlistId: string): ISong[] {
    const playlist = this.getPlaylistById(playlistId);
    if (!playlist) return [];

    return playlist.songIds
      .map((songId) => this.state.songsById[songId])
      .filter((song): song is ISong => Boolean(song));
  }

  getAllQueueSongs(): ISong[] {
    return this.state.queueSongIds
      .map((songId) => this.state.songsById[songId])
      .filter((song): song is ISong => Boolean(song));
  }

  getSongById(songId: string): ISong | null {
    return this.state.songsById[songId] ?? null;
  }

  createPlaylist(input: CreatePlaylistInput): IUserPlaylist {
    this.upsertSongs(input.songs);

    const songIds = input.songs.map((song) => song.id);
    this.addSongsToQueue(input.songs);

    const playlist: IUserPlaylist = {
      id: generateId(),
      name: input.name,
      source: input.source,
      coverArt: input.coverArt || input.songs[0]?.albumArt || generateGradientArt(input.name),
      songIds,
      createdAt: Date.now(),
    };

    this.state.playlists.push(playlist);
    this.save();
    return playlist;
  }

  deletePlaylist(playlistId: string): boolean {
    const before = this.state.playlists.length;
    this.state.playlists = this.state.playlists.filter((playlist) => playlist.id !== playlistId);
    const removed = this.state.playlists.length !== before;

    if (removed) this.save();
    return removed;
  }

  updatePlaylist(playlistId: string, updates: Partial<Pick<IUserPlaylist, 'name' | 'coverArt'>>): IUserPlaylist | null {
    const playlist = this.getPlaylistById(playlistId);
    if (!playlist) return null;

    if (updates.name) playlist.name = updates.name;
    if (updates.coverArt) playlist.coverArt = updates.coverArt;

    this.save();
    return playlist;
  }

  updateSong(songId: string, updates: Partial<ISong>): ISong | null {
    const song = this.state.songsById[songId];
    if (!song) return null;

    this.state.songsById[songId] = {
      ...song,
      ...updates,
      id: song.id,
    };

    this.save();
    return this.state.songsById[songId];
  }

  addSongsToQueue(songs: ISong[]): void {
    songs.forEach((song) => {
      this.state.songsById[song.id] = song;
      if (!this.state.queueSongIds.includes(song.id)) {
        this.state.queueSongIds.push(song.id);
      }
    });

    this.save();
  }

  replaceQueueSongs(songs: ISong[]): void {
    this.upsertSongs(songs);
    this.state.queueSongIds = songs.map((song) => song.id);
    this.save();
  }

  hasPersistedData(): boolean {
    return this.state.queueSongIds.length > 0 || this.state.playlists.length > 0;
  }

  seedIfEmpty(seedSongs: ISong[]): void {
    if (this.hasPersistedData()) return;

    this.addSongsToQueue(seedSongs);
    this.createPlaylist({
      name: 'Recently Imported',
      source: 'local',
      songs: seedSongs,
      coverArt: seedSongs[0]?.albumArt,
    });
  }

  private upsertSongs(songs: ISong[]): void {
    songs.forEach((song) => {
      this.state.songsById[song.id] = song;
    });
  }

  private load(): void {
    const raw = localStorage.getItem(PlaylistService.STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as PersistedState;
      if (!parsed || typeof parsed !== 'object') return;

      this.state = {
        songsById: parsed.songsById ?? {},
        queueSongIds: Array.isArray(parsed.queueSongIds) ? parsed.queueSongIds : [],
        playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
      };
    } catch {
      this.state = { songsById: {}, queueSongIds: [], playlists: [] };
    }
  }

  private save(): void {
    localStorage.setItem(PlaylistService.STORAGE_KEY, JSON.stringify(this.state));
  }
}
