import type { ISong } from '../interfaces/ISong.js';
import type { RepeatMode } from '../interfaces/IEventEmitter.js';
import { DoublyLinkedList } from './DoublyLinkedList.js';
import { EventEmitter } from '../utils/EventEmitter.js';

/**
 * Player – Singleton.
 *
 * Central orchestrator that owns:
 *  • The DoublyLinkedList playlist
 *  • An HTMLAudioElement for playback
 *  • An EventEmitter to broadcast state changes
 *
 * Pattern: Singleton + Observer (via EventEmitter)
 *
 * Usage:
 *   const player = Player.getInstance();
 *   player.events.on('time-update', ({ current, total }) => { … });
 */
export class Player {
  // ── Singleton bookkeeping ───────────────────────────────────
  private static instance: Player | null = null;

  public static getInstance(): Player {
    if (!Player.instance) {
      Player.instance = new Player();
    }
    return Player.instance;
  }

  // ── Private state ───────────────────────────────────────────
  private readonly _playlist: DoublyLinkedList;
  private readonly _audio: HTMLAudioElement;
  public  readonly events: EventEmitter;

  private _isPlaying    = false;
  private _volume       = 0.8;
  private _isMuted      = false;
  private _shuffle      = false;
  private _repeatMode: RepeatMode = 'none';
  private _shuffleStack: ISong[] = [];

  /** @private – use Player.getInstance() */
  private constructor() {
    this._playlist = new DoublyLinkedList();
    this._audio    = new Audio();
    this.events    = new EventEmitter();

    this._audio.volume = this._volume;
    this._bindAudioEvents();
  }

  // ─────────────────────────────────────────────────────────────
  //  Playlist accessors
  // ─────────────────────────────────────────────────────────────

  get playlist(): DoublyLinkedList { return this._playlist; }
  get isPlaying(): boolean         { return this._isPlaying; }
  get volume(): number             { return this._volume; }
  get isMuted(): boolean           { return this._isMuted; }
  get shuffleActive(): boolean     { return this._shuffle; }
  get repeatMode(): RepeatMode     { return this._repeatMode; }
  get currentSong(): ISong | null  { return this._playlist.currentSong; }
  get currentTime(): number        { return this._audio.currentTime; }
  get duration(): number           { return this._audio.duration || 0; }

  // ─────────────────────────────────────────────────────────────
  //  Playlist mutation helpers (delegate to DoublyLinkedList)
  // ─────────────────────────────────────────────────────────────

  addAtStart(song: ISong): void {
    this._playlist.addAtStart(song);
    this.events.emit('playlist-change', undefined);
  }

  addAtEnd(song: ISong): void {
    this._playlist.addAtEnd(song);
    this.events.emit('playlist-change', undefined);
  }

  addAtPosition(song: ISong, index: number): void {
    this._playlist.addAtPosition(song, index);
    this.events.emit('playlist-change', undefined);
  }

  addMany(songs: ISong[]): void {
    this._playlist.addMany(songs);
    this.events.emit('playlist-change', undefined);
  }

  remove(id: string): void {
    const wasCurrent = this._playlist.currentSong?.id === id;
    this._playlist.remove(id);

    if (wasCurrent && this._isPlaying) {
      this._loadCurrentAndPlay();
    }
    this.events.emit('playlist-change', undefined);
  }

  clearPlaylist(): void {
    this._audio.pause();
    this._audio.src = '';
    this._isPlaying = false;
    this._playlist.clear();
    this.events.emit('stop', undefined);
    this.events.emit('playlist-change', undefined);
  }

  moveSong(fromId: string, toIndex: number): void {
    this._playlist.move(fromId, toIndex);
    this.events.emit('playlist-change', undefined);
  }

  // ─────────────────────────────────────────────────────────────
  //  Playback controls
  // ─────────────────────────────────────────────────────────────

  /**
   * play – start / resume playback of the current song.
   * If a `songId` is provided the cursor jumps to that song first.
   */
  async play(songId?: string): Promise<void> {
    if (songId) {
      const node = this._playlist.jumpToId(songId);
      if (!node) return;
    }

    const song = this._playlist.currentSong;
    if (!song) return;

    // If the audio element is already loaded with this song, just resume
    const isSameSource = this._audio.src !== '' &&
      this._audio.dataset['songId'] === song.id;

    if (!isSameSource) {
      this._loadSong(song);
    }

    try {
      await this._audio.play();
      this._isPlaying = true;
      this.events.emit('play', { songId: song.id });
    } catch (err) {
      // Autoplay policy – silently handle
      console.warn('[Player] play() blocked by browser policy:', err);
    }
  }

  pause(): void {
    if (!this._isPlaying) return;
    this._audio.pause();
    this._isPlaying = false;
    const id = this._playlist.currentSong?.id ?? '';
    this.events.emit('pause', { songId: id });
  }

  togglePlay(): void {
    this._isPlaying ? this.pause() : void this.play();
  }

  /** Advance to the next song. */
  async next(): Promise<void> {
    let song: ISong | null = null;

    if (this._shuffle) {
      song = this._pickShuffleSong();
    } else {
      const node = this._playlist.getNext();
      song = node?.song ?? null;

      // Handle repeat-all: loop back to head
      if (!song && this._repeatMode === 'all') {
        this._playlist.jumpToHead();
        song = this._playlist.currentSong;
      }
    }

    if (!song) return;
    await this._loadCurrentAndPlay();
    this.events.emit('next', { songId: song.id });
  }

  /** Go back to the previous song. */
  async previous(): Promise<void> {
    // If more than 3 s played, restart instead of going back
    if (this._audio.currentTime > 3) {
      this._audio.currentTime = 0;
      return;
    }

    const node = this._playlist.getPrevious();
    if (!node) return;

    await this._loadCurrentAndPlay();
    this.events.emit('previous', { songId: node.song.id });
  }

  /** Seek to an absolute time (seconds). */
  seek(seconds: number): void {
    if (!isFinite(seconds)) return;
    this._audio.currentTime = seconds;
    this.events.emit('seek', { time: seconds });
  }

  /** Seek by fraction 0–1. */
  seekFraction(fraction: number): void {
    const dur = this._audio.duration;
    if (!isFinite(dur)) return;
    this.seek(fraction * dur);
  }

  // ─────────────────────────────────────────────────────────────
  //  Volume
  // ─────────────────────────────────────────────────────────────

  setVolume(level: number): void {
    this._volume = Math.max(0, Math.min(1, level));
    this._audio.volume = this._isMuted ? 0 : this._volume;
    this.events.emit('volume', { level: this._volume });
  }

  toggleMute(): void {
    this._isMuted = !this._isMuted;
    this._audio.volume = this._isMuted ? 0 : this._volume;
    this.events.emit('volume', { level: this._isMuted ? 0 : this._volume });
  }

  // ─────────────────────────────────────────────────────────────
  //  Shuffle & Repeat
  // ─────────────────────────────────────────────────────────────

  toggleShuffle(): void {
    this._shuffle = !this._shuffle;
    if (this._shuffle) {
      this._shuffleStack = this._playlist.toArray().filter(
        s => s.id !== this._playlist.currentSong?.id
      );
    }
    this.events.emit('shuffle-change', { active: this._shuffle });
  }

  cycleRepeat(): void {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const idx = modes.indexOf(this._repeatMode);
    this._repeatMode = modes[(idx + 1) % modes.length];
    this.events.emit('repeat-change', { mode: this._repeatMode });
  }

  // ─────────────────────────────────────────────────────────────
  //  Like
  // ─────────────────────────────────────────────────────────────

  toggleLike(songId: string): void {
    const node = this._playlist.jumpToId(songId);
    if (!node) {
      // Restore cursor to current song after jump
      if (this._playlist.currentSong) {
        this._playlist.jumpToId(this._playlist.currentSong.id);
      }
      return;
    }
    node.song.liked = !node.song.liked;

    // Jump back to previously current song
    if (this._playlist.currentSong) {
      this._playlist.jumpToId(this._playlist.currentSong.id);
    }

    this.events.emit('song-liked', { songId, liked: node.song.liked });
    this.events.emit('playlist-change', undefined);
  }

  // ─────────────────────────────────────────────────────────────
  //  Private helpers
  // ─────────────────────────────────────────────────────────────

  private _loadSong(song: ISong): void {
    this._audio.src = song.audioUrl ?? '';
    this._audio.dataset['songId'] = song.id;
    this._audio.load();
  }

  private async _loadCurrentAndPlay(): Promise<void> {
    const song = this._playlist.currentSong;
    if (!song) return;
    this._loadSong(song);
    try {
      await this._audio.play();
      this._isPlaying = true;
      this.events.emit('play', { songId: song.id });
    } catch {
      // Silently ignore autoplay block
    }
  }

  private _pickShuffleSong(): ISong | null {
    if (this._shuffleStack.length === 0) {
      // Refill if repeat-all, else stop
      if (this._repeatMode === 'all') {
        this._shuffleStack = this._playlist.toArray();
      } else {
        return null;
      }
    }
    const idx = Math.floor(Math.random() * this._shuffleStack.length);
    const [song] = this._shuffleStack.splice(idx, 1);
    this._playlist.jumpToId(song.id);
    return song;
  }

  private _bindAudioEvents(): void {
    // Time progress
    this._audio.addEventListener('timeupdate', () => {
      this.events.emit('time-update', {
        current: this._audio.currentTime,
        total:   this._audio.duration || 0,
      });
    });

    // Song ended
    this._audio.addEventListener('ended', () => {
      if (this._repeatMode === 'one') {
        this._audio.currentTime = 0;
        void this._audio.play();
        return;
      }
      void this.next();
    });

    // Errors
    this._audio.addEventListener('error', () => {
      console.warn('[Player] Audio error – skipping to next');
      void this.next();
    });
  }
}
