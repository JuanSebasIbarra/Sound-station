import type { ISong } from '../interfaces/ISong.js';
import type { IUserPlaylist, UserPlaylistSource } from '../interfaces/IUserPlaylist.js';
import type { ILibraryState, IM3URegistryEntry } from '../interfaces/ILibraryState.js';
import { generateId, generateGradientArt } from '../utils/helpers.js';
import { StorageService } from './StorageService.js';
import { M3UParser } from './M3UParser.js';

interface PersistedState {
  songsById: Record<string, ISong>;
  queueSongIds: string[];
  dismissedRecentlySongIds: string[];
  playlists: IUserPlaylist[];
}

interface CreatePlaylistInput {
  name: string;
  source: UserPlaylistSource;
  songs: ISong[];
  coverArt?: string;
}

interface UpdateAlbumMetadataInput {
  artistName: string;
  albumName: string;
  collaborators: string[];
}

/**
 * PlaylistService
 *
 * Central CRUD + persistence layer for playlists and songs.
 * Supports M3U persistence for local playlists and startup re-linking.
 */
export class PlaylistService {
  private state: PersistedState = {
    songsById: {},
    queueSongIds: [],
    dismissedRecentlySongIds: [],
    playlists: [],
  };

  private readonly m3uRegistry: Record<string, IM3URegistryEntry> = {};

  constructor(
    private readonly storageService: StorageService = new StorageService(),
    private readonly m3uParser: M3UParser = new M3UParser(),
  ) {
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

  getSongsForAlbum(albumName: string): ISong[] {
    const normalizedAlbum = albumName.trim().toLowerCase();
    if (!normalizedAlbum) return [];

    return Object.values(this.state.songsById)
      .filter((song) => (song.album || 'Singles').trim().toLowerCase() === normalizedAlbum)
      .sort((a, b) => a.title.localeCompare(b.title));
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

    if (playlist.source === 'local') {
      this.persistM3UForPlaylist(playlist, input.songs);
    }

    this.save();
    return playlist;
  }

  deletePlaylist(playlistId: string): boolean {
    const target = this.getPlaylistById(playlistId);
    if (!target) return false;

    const removedSongIds = new Set(target.songIds);
    const before = this.state.playlists.length;
    this.state.playlists = this.state.playlists.filter((playlist) => playlist.id !== playlistId);
    const removed = this.state.playlists.length !== before;

    if (removed) {
      delete this.m3uRegistry[playlistId];
      this.state.queueSongIds = this.state.queueSongIds.filter((songId) => {
        if (!removedSongIds.has(songId)) return true;
        return this.state.playlists.some((playlist) => playlist.songIds.includes(songId));
      });

      this.pruneOrphanSongs();
    }

    if (removed) this.save();
    return removed;
  }

  updatePlaylist(playlistId: string, updates: Partial<Pick<IUserPlaylist, 'name' | 'coverArt'>>): IUserPlaylist | null {
    const playlist = this.getPlaylistById(playlistId);
    if (!playlist) return null;

    if (updates.name) playlist.name = updates.name;
    if (updates.coverArt) playlist.coverArt = updates.coverArt;

    if (playlist.source === 'local') {
      this.persistM3UForPlaylist(playlist, this.getSongsForPlaylist(playlist.id));
    }

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

    this.state.playlists
      .filter((playlist) => playlist.source === 'local' && playlist.songIds.includes(songId))
      .forEach((playlist) => {
        this.persistM3UForPlaylist(playlist, this.getSongsForPlaylist(playlist.id));
      });

    this.save();
    return this.state.songsById[songId];
  }

  updateAlbumMetadata(currentAlbumName: string, input: UpdateAlbumMetadataInput): ISong[] {
    const normalizedCurrentAlbum = currentAlbumName.trim().toLowerCase();
    if (!normalizedCurrentAlbum) return [];

    const normalizedArtist = input.artistName.trim() || 'Unknown Artist';
    const normalizedAlbum = input.albumName.trim() || 'Singles';
    const collaborators = input.collaborators
      .map((name) => name.trim())
      .filter(Boolean);

    const updatedSongs: ISong[] = [];
    Object.values(this.state.songsById).forEach((song) => {
      const songAlbum = (song.album || 'Singles').trim().toLowerCase();
      if (songAlbum !== normalizedCurrentAlbum) return;

      const updatedSong: ISong = {
        ...song,
        artist: normalizedArtist,
        album: normalizedAlbum,
        collaborators,
      };

      this.state.songsById[song.id] = updatedSong;
      updatedSongs.push(updatedSong);
    });

    if (updatedSongs.length === 0) return [];

    this.state.playlists
      .filter((playlist) => playlist.source === 'local')
      .forEach((playlist) => {
        this.persistM3UForPlaylist(playlist, this.getSongsForPlaylist(playlist.id));
      });

    this.save();
    return updatedSongs;
  }

  addSongsToQueue(songs: ISong[]): void {
    songs.forEach((song) => {
      this.state.songsById[song.id] = song;
      if (!this.state.queueSongIds.includes(song.id)) {
        this.state.queueSongIds.push(song.id);
      }
      this.state.dismissedRecentlySongIds = this.state.dismissedRecentlySongIds.filter((id) => id !== song.id);
    });

    this.save();
  }

  addSongsToPlaylist(playlistId: string, songs: ISong[]): IUserPlaylist | null {
    const playlist = this.getPlaylistById(playlistId);
    if (!playlist || songs.length === 0) return playlist;

    this.upsertSongs(songs);
    this.addSongsToQueue(songs);

    const incomingIds = songs.map((song) => song.id);
    const existing = new Set(playlist.songIds);
    incomingIds.forEach((songId) => {
      if (!existing.has(songId)) playlist.songIds.push(songId);
    });

    if (playlist.source === 'local') {
      this.persistM3UForPlaylist(playlist, this.getSongsForPlaylist(playlist.id));
    }

    this.save();
    return playlist;
  }

  removeSongFromQueue(songId: string): boolean {
    const existsInQueue = this.state.queueSongIds.includes(songId);
    if (!existsInQueue) return false;

    this.state.queueSongIds = this.state.queueSongIds.filter((id) => id !== songId);

    this.pruneOrphanSongs();

    this.save();
    return true;
  }

  removeAlbumFromQueue(albumName: string): number {
    const normalized = albumName.trim().toLowerCase();
    if (!normalized) return 0;

    const removableIds = new Set(
      this.state.queueSongIds.filter((songId) => {
        const song = this.state.songsById[songId];
        if (!song) return false;
        const songAlbum = (song.album ?? '').trim().toLowerCase() || 'singles';
        return songAlbum === normalized;
      }),
    );

    if (removableIds.size === 0) return 0;

    this.state.queueSongIds = this.state.queueSongIds.filter((songId) => !removableIds.has(songId));
    this.pruneOrphanSongs();

    this.save();
    return removableIds.size;
  }

  dismissSongFromRecentlyPlayed(songId: string): boolean {
    if (!this.state.songsById[songId]) return false;
    if (!this.state.dismissedRecentlySongIds.includes(songId)) {
      this.state.dismissedRecentlySongIds.push(songId);
      this.save();
    }
    return true;
  }

  isSongDismissedFromRecentlyPlayed(songId: string): boolean {
    return this.state.dismissedRecentlySongIds.includes(songId);
  }

  removeSong(songId: string): boolean {
    return this.removeSongFromQueue(songId);
  }

  removeSongFromPlaylist(playlistId: string, songId: string): boolean {
    const playlist = this.getPlaylistById(playlistId);
    if (!playlist) return false;
    if (!playlist.songIds.includes(songId)) return false;

    playlist.songIds = playlist.songIds.filter((id) => id !== songId);

    const isReferencedElsewhere = this.state.playlists.some((candidate) => candidate.songIds.includes(songId));
    if (!isReferencedElsewhere) {
      this.state.queueSongIds = this.state.queueSongIds.filter((id) => id !== songId);
    }

    if (playlist.source === 'local') {
      this.persistM3UForPlaylist(playlist, this.getSongsForPlaylist(playlist.id));
    }

    this.pruneOrphanSongs();
    this.save();
    return true;
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

  async relinkLocalPlaylistsFromM3U(): Promise<void> {
    const localPlaylists = this.state.playlists.filter((playlist) => playlist.source === 'local');
    if (localPlaylists.length === 0) return;

    const currentSongsByLocalPath = new Map<string, ISong>();
    Object.values(this.state.songsById).forEach((song) => {
      if (song.localFilePath) {
        currentSongsByLocalPath.set(song.localFilePath, song);
      }
    });

    for (const playlist of localPlaylists) {
      const record = this.m3uRegistry[playlist.id];
      if (!record?.m3uContent) continue;

      const parsedSongs = this.m3uParser.parse(record.m3uContent, {
        fallbackAlbum: 'Local Library',
      });

      const relinkedSongs: ISong[] = [];

      for (const parsedSong of parsedSongs) {
        const localPath = parsedSong.localFilePath || '';
        const existingSong = localPath ? currentSongsByLocalPath.get(localPath) : null;
        const resolvedSong: ISong = existingSong
          ? {
              ...existingSong,
              title: existingSong.title || parsedSong.title,
              artist: existingSong.artist || parsedSong.artist,
              album: existingSong.album || parsedSong.album,
            }
          : parsedSong;

        const audioUrl = localPath ? await this.storageService.getAudioUrlByPath(localPath) : null;
        resolvedSong.audioUrl = audioUrl ?? undefined;
        resolvedSong.isFileAvailable = Boolean(audioUrl);
        resolvedSong.missingReason = audioUrl ? undefined : 'not_found';

        this.state.songsById[resolvedSong.id] = resolvedSong;
        relinkedSongs.push(resolvedSong);
      }

      playlist.songIds = relinkedSongs.map((song) => song.id);
    }

    this.save();
  }

  private upsertSongs(songs: ISong[]): void {
    songs.forEach((song) => {
      this.state.songsById[song.id] = song;
    });
  }

  private pruneOrphanSongs(): void {
    const referencedByPlaylist = new Set(this.state.playlists.flatMap((playlist) => playlist.songIds));
    const referencedByQueue = new Set(this.state.queueSongIds);

    Object.keys(this.state.songsById).forEach((songId) => {
      if (!referencedByQueue.has(songId) && !referencedByPlaylist.has(songId)) {
        delete this.state.songsById[songId];
      }
    });

    this.state.dismissedRecentlySongIds = this.state.dismissedRecentlySongIds.filter((songId) =>
      Boolean(this.state.songsById[songId]),
    );
  }

  private persistM3UForPlaylist(playlist: IUserPlaylist, songs: ISong[]): void {
    this.m3uRegistry[playlist.id] = {
      playlistId: playlist.id,
      playlistName: playlist.name,
      source: 'local',
      m3uPath: `local://${playlist.id}.m3u`,
      m3uContent: this.m3uParser.serialize(songs),
      updatedAt: Date.now(),
    };
  }

  private load(): void {
    const payload = this.storageService.loadAppState<PersistedState>();
    if (!payload?.state) return;

    this.state = {
      songsById: payload.state.songsById ?? {},
      queueSongIds: Array.isArray(payload.state.queueSongIds) ? payload.state.queueSongIds : [],
      dismissedRecentlySongIds: Array.isArray(payload.state.dismissedRecentlySongIds)
        ? payload.state.dismissedRecentlySongIds
        : [],
      playlists: Array.isArray(payload.state.playlists) ? payload.state.playlists : [],
    };

    Object.assign(this.m3uRegistry, payload.m3uRegistry ?? {});
  }

  private save(): void {
    const previousLibrary: ILibraryState = this.storageService.loadAppState()?.library ?? {
      artists: {},
      playbackHistory: [],
    };

    this.storageService.saveAppState<PersistedState>({
      state: this.state,
      library: previousLibrary,
      m3uRegistry: this.m3uRegistry,
    });
  }
}
