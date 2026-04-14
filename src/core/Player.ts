import type { ISong } from '../interfaces/ISong.js';
import type { RepeatMode } from '../interfaces/IEventEmitter.js';
import { DoublyLinkedList } from './DoublyLinkedList.js';
import { EventEmitter } from '../utils/EventEmitter.js';

export class Player {
  private static instance: Player | null = null;

  public static getInstance(): Player {
    if (!Player.instance) {
      Player.instance = new Player();
    }
    return Player.instance;
  }

  private readonly _playlist: DoublyLinkedList;
  private readonly _audio: HTMLAudioElement;
  public readonly events: EventEmitter;

  private _youtubePlayer: YT.Player | null = null;
  private _youtubeContainer: HTMLElement | null = null;
  private _timeUpdateIntervalId: number | null = null;
  private _ytReady = false;
  private _youtubeScriptRequested = false;
  private _isPlaying = false;
  private _volume = 0.8;
  private _isMuted = false;
  private _shuffle = false;
  private _repeatMode: RepeatMode = 'none';
  private _shuffleStack: ISong[] = [];
  private _playbackQueueSongIds: string[] = [];
  private _queueCursorIndex = -1;

  private constructor() {
    this._playlist = new DoublyLinkedList();
    this._audio = new Audio();
    this.events = new EventEmitter();

    this._audio.volume = this._volume;
    this._bindAudioEvents();
    this._bindYouTubeLifecycle();
  }

  get playlist(): DoublyLinkedList { return this._playlist; }
  get isPlaying(): boolean { return this._isPlaying; }
  get volume(): number { return this._volume; }
  get isMuted(): boolean { return this._isMuted; }
  get shuffleActive(): boolean { return this._shuffle; }
  get repeatMode(): RepeatMode { return this._repeatMode; }
  get currentSong(): ISong | null { return this._playlist.currentSong; }
  get currentTime(): number {
    return this._isCurrentSongYouTube()
      ? this._youtubePlayer?.getCurrentTime() ?? 0
      : this._audio.currentTime;
  }
  get duration(): number {
    return this._isCurrentSongYouTube()
      ? this._youtubePlayer?.getDuration() ?? 0
      : this._audio.duration || 0;
  }
  get playbackQueueSongIds(): string[] { return [...this._playbackQueueSongIds]; }
  get playbackQueueSongs(): ISong[] {
    return this._playbackQueueSongIds
      .map((songId) => this.getSongById(songId))
      .filter((song): song is ISong => Boolean(song));
  }
  get queueCursorIndex(): number { return this._queueCursorIndex; }

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
    this.removeFromPlaybackQueue(id);
    this._playlist.remove(id);

    if (wasCurrent && this._isPlaying) {
      void this._loadCurrentAndPlay();
    }

    this.events.emit('playlist-change', undefined);
  }

  clearPlaylist(): void {
    this._stopCurrentPlayback();
    this._playlist.clear();
    this.clearPlaybackQueue();
    this.events.emit('stop', undefined);
    this.events.emit('playlist-change', undefined);
  }

  addToPlaybackQueue(songId: string): boolean {
    const song = this.getSongById(songId);
    if (!song) return false;

    this._playbackQueueSongIds.push(song.id);
    this.events.emit('queue-change', {
      songIds: this.playbackQueueSongIds,
      activeIndex: this._queueCursorIndex,
    });
    return true;
  }

  removeFromPlaybackQueueAt(index: number): boolean {
    if (index < 0 || index >= this._playbackQueueSongIds.length) return false;

    this._playbackQueueSongIds.splice(index, 1);
    if (this._playbackQueueSongIds.length === 0) {
      this._queueCursorIndex = -1;
    } else if (index <= this._queueCursorIndex) {
      this._queueCursorIndex = Math.max(0, this._queueCursorIndex - 1);
    }

    this.events.emit('queue-change', {
      songIds: this.playbackQueueSongIds,
      activeIndex: this._queueCursorIndex,
    });
    return true;
  }

  removeFromPlaybackQueue(songId: string): boolean {
    const index = this._playbackQueueSongIds.findIndex((id) => id === songId);
    if (index < 0) return false;
    return this.removeFromPlaybackQueueAt(index);
  }

  isSongQueued(songId: string): boolean {
    return this._playbackQueueSongIds.includes(songId);
  }

  clearPlaybackQueue(): void {
    this._playbackQueueSongIds = [];
    this._queueCursorIndex = -1;
    this.events.emit('queue-change', {
      songIds: [],
      activeIndex: -1,
    });
  }

  moveSong(fromId: string, toIndex: number): void {
    this._playlist.move(fromId, toIndex);
    this.events.emit('playlist-change', undefined);
  }

  getSongById(songId: string): ISong | null {
    return this._playlist.toArray().find((song) => song.id === songId) ?? null;
  }

  updateSongMetadata(songId: string, updates: Partial<ISong>): void {
    const song = this.getSongById(songId);
    if (!song) return;

    Object.assign(song, updates);
    this.events.emit('playlist-change', undefined);

    if (this.currentSong?.id === songId) {
      this.events.emit('current-song-update', { songId });
    }
  }

  async play(songId?: string): Promise<void> {
    if (songId && this._playbackQueueSongIds.length > 0) {
      const queueIndex = this._playbackQueueSongIds.findIndex((id) => id === songId);
      if (queueIndex >= 0) this._queueCursorIndex = queueIndex;
    }

    if (!songId && this._playbackQueueSongIds.length > 0 && this._queueCursorIndex === -1) {
      this._queueCursorIndex = 0;
      songId = this._playbackQueueSongIds[0];
    }

    if (songId) {
      const node = this._playlist.jumpToId(songId);
      if (!node) return;
    }

    if (!songId && !this._playlist.currentSong && !this._playlist.isEmpty) {
      this._playlist.jumpToHead();
    }

    const song = this._playlist.currentSong;
    if (!song) return;

    if (song.source === 'youtube_music') {
      await this._playYouTubeSong(song);
      return;
    }

    if (song.isFileAvailable === false || !song.audioUrl) {
      this._isPlaying = false;
      this.events.emit('playback-error', {
        songId: song.id,
        reason: song.missingReason ?? 'not_found',
      });
      return;
    }

    this._stopYouTubePlayback();

    const isSameSource = this._audio.src !== '' && this._audio.dataset['songId'] === song.id;
    if (!isSameSource) {
      this._loadSong(song);
    }

    try {
      await this._audio.play();
      this._isPlaying = true;
      this.events.emit('play', { songId: song.id });
    } catch (err) {
      console.warn('[Player] play() blocked by browser policy:', err);
    }
  }

  pause(): void {
    if (!this._isPlaying) return;

    if (this._isCurrentSongYouTube()) {
      this._youtubePlayer?.pauseVideo();
    } else {
      this._audio.pause();
    }

    this._isPlaying = false;
    const id = this._playlist.currentSong?.id ?? '';
    this.events.emit('pause', { songId: id });
  }

  togglePlay(): void {
    if (this._isPlaying) {
      this.pause();
      return;
    }

    if (!this.currentSong && !this._playlist.isEmpty) {
      this._playlist.jumpToHead();
    }

    void this.play();
  }

  async next(): Promise<void> {
    if (this._playbackQueueSongIds.length > 0) {
      if (this._queueCursorIndex < 0) {
        this._queueCursorIndex = 0;
      } else if (this._queueCursorIndex < this._playbackQueueSongIds.length - 1) {
        this._queueCursorIndex += 1;
      } else if (this._repeatMode === 'all') {
        this._queueCursorIndex = 0;
      } else {
        return;
      }

      const queueSongId = this._playbackQueueSongIds[this._queueCursorIndex];
      if (!queueSongId) return;
      this._playlist.jumpToId(queueSongId);
      const queueSong = this._playlist.currentSong;
      if (!queueSong) return;

      await this._loadCurrentAndPlay();
      this.events.emit('queue-change', {
        songIds: this.playbackQueueSongIds,
        activeIndex: this._queueCursorIndex,
      });
      this.events.emit('next', { songId: queueSong.id });
      return;
    }

    let song: ISong | null = null;

    if (this._shuffle) {
      song = this._pickShuffleSong();
    } else {
      const node = this._playlist.getNext();
      song = node?.song ?? null;

      if (!song && this._repeatMode === 'all') {
        this._playlist.jumpToHead();
        song = this._playlist.currentSong;
      }
    }

    if (!song) return;
    await this._loadCurrentAndPlay();
    this.events.emit('next', { songId: song.id });
  }

  async previous(): Promise<void> {
    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }

    if (this._playbackQueueSongIds.length > 0) {
      if (this._queueCursorIndex <= 0) {
        if (this._repeatMode === 'all' && this._playbackQueueSongIds.length > 0) {
          this._queueCursorIndex = this._playbackQueueSongIds.length - 1;
        } else {
          return;
        }
      } else {
        this._queueCursorIndex -= 1;
      }

      const queueSongId = this._playbackQueueSongIds[this._queueCursorIndex];
      if (!queueSongId) return;
      this._playlist.jumpToId(queueSongId);
      const queueSong = this._playlist.currentSong;
      if (!queueSong) return;

      await this._loadCurrentAndPlay();
      this.events.emit('queue-change', {
        songIds: this.playbackQueueSongIds,
        activeIndex: this._queueCursorIndex,
      });
      this.events.emit('previous', { songId: queueSong.id });
      return;
    }

    const node = this._playlist.getPrevious();
    if (!node) return;

    await this._loadCurrentAndPlay();
    this.events.emit('previous', { songId: node.song.id });
  }

  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return;

    if (this._isCurrentSongYouTube()) {
      this._youtubePlayer?.seekTo(Math.max(0, seconds), true);
    } else {
      this._audio.currentTime = seconds;
    }

    this.events.emit('seek', { time: seconds });
  }

  seekFraction(fraction: number): void {
    const dur = this.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    this.seek(fraction * dur);
  }

  setVolume(level: number): void {
    this._volume = Math.max(0, Math.min(1, level));
    this._audio.volume = this._isMuted ? 0 : this._volume;
    this._youtubePlayer?.setVolume(Math.round((this._isMuted ? 0 : this._volume) * 100));
    this.events.emit('volume', { level: this._isMuted ? 0 : this._volume });
  }

  toggleMute(): void {
    this._isMuted = !this._isMuted;
    this._audio.volume = this._isMuted ? 0 : this._volume;
    this._youtubePlayer?.setVolume(Math.round((this._isMuted ? 0 : this._volume) * 100));
    this.events.emit('volume', { level: this._isMuted ? 0 : this._volume });
  }

  toggleShuffle(): void {
    this._shuffle = !this._shuffle;
    if (this._shuffle) {
      this._shuffleStack = this._playlist.toArray().filter((song) => song.id !== this._playlist.currentSong?.id);
    }
    this.events.emit('shuffle-change', { active: this._shuffle });
  }

  cycleRepeat(): void {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const idx = modes.indexOf(this._repeatMode);
    this._repeatMode = modes[(idx + 1) % modes.length];
    this.events.emit('repeat-change', { mode: this._repeatMode });
  }

  toggleLike(songId: string): void {
    const previousCurrentSongId = this._playlist.currentSong?.id ?? null;
    const node = this._playlist.jumpToId(songId);
    if (!node) {
      if (previousCurrentSongId) {
        this._playlist.jumpToId(previousCurrentSongId);
      }
      return;
    }

    node.song.liked = !node.song.liked;

    if (previousCurrentSongId) {
      this._playlist.jumpToId(previousCurrentSongId);
    }

    this.events.emit('song-liked', { songId, liked: node.song.liked });
    this.events.emit('playlist-change', undefined);
  }

  private _loadSong(song: ISong): void {
    this._audio.src = song.audioUrl ?? '';
    this._audio.dataset['songId'] = song.id;
    this._audio.load();
  }

  private async _loadCurrentAndPlay(): Promise<void> {
    const song = this._playlist.currentSong;
    if (!song) return;

    if (song.source === 'youtube_music') {
      await this._playYouTubeSong(song);
      return;
    }

    if (song.isFileAvailable === false || !song.audioUrl) {
      this._isPlaying = false;
      this.events.emit('playback-error', {
        songId: song.id,
        reason: song.missingReason ?? 'not_found',
      });
      return;
    }

    this._stopYouTubePlayback();
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
    this._audio.addEventListener('timeupdate', () => {
      if (this._isCurrentSongYouTube()) return;

      this.events.emit('time-update', {
        current: this._audio.currentTime,
        total: this._audio.duration || 0,
      });
    });

    this._audio.addEventListener('ended', () => {
      if (this._isCurrentSongYouTube()) return;

      if (this._repeatMode === 'one') {
        this._audio.currentTime = 0;
        void this._audio.play();
        return;
      }

      void this.next();
    });

    this._audio.addEventListener('error', () => {
      if (this._isCurrentSongYouTube()) return;
      console.warn('[Player] Audio error – skipping to next');
      void this.next();
    });
  }

  private _bindYouTubeLifecycle(): void {
    window.addEventListener('yt-api-ready', () => {
      this._ytReady = true;
      const currentSong = this._playlist.currentSong;
      if (currentSong?.source === 'youtube_music') {
        void this._playYouTubeSong(currentSong);
      }
    });

    if (typeof window !== 'undefined' && window.YT?.Player) {
      this._ytReady = true;
    }
  }

  private async _playYouTubeSong(song: ISong): Promise<void> {
    const videoId = this._extractYouTubeVideoId(song.audioUrl);
    if (!videoId) {
      this._isPlaying = false;
      this.events.emit('playback-error', {
        songId: song.id,
        reason: 'unknown',
      });
      return;
    }

    this._stopNativeAudio();
    await this._ensureYouTubePlayer(videoId);

    if (!this._youtubePlayer) {
      this._isPlaying = false;
      return;
    }

    this._youtubePlayer.loadVideoById(videoId);
    this._youtubePlayer.setVolume(Math.round((this._isMuted ? 0 : this._volume) * 100));
    this._youtubePlayer.playVideo();
    this._startYouTubeProgressPolling();
  }

  private async _ensureYouTubePlayer(initialVideoId: string): Promise<void> {
    this._ensureYouTubeContainer();
    if (this._youtubePlayer) return;

    if (!this._ytReady) {
      this._loadYouTubeApiScript();
      return;
    }

    if (!this._youtubeContainer) return;

    this._youtubePlayer = new window.YT.Player(this._youtubeContainer, {
      videoId: initialVideoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          this._youtubePlayer?.setVolume(Math.round((this._isMuted ? 0 : this._volume) * 100));
        },
        onStateChange: (event) => {
          this._handleYouTubeStateChange(event.data);
        },
      },
    });
  }

  private _handleYouTubeStateChange(state: number): void {
    const songId = this._playlist.currentSong?.id ?? '';

    if (state === YT.PlayerState.PLAYING) {
      this._isPlaying = true;
      this.events.emit('play', { songId });
      this._startYouTubeProgressPolling();
      return;
    }

    if (state === YT.PlayerState.PAUSED) {
      if (this._isPlaying) {
        this._isPlaying = false;
        this.events.emit('pause', { songId });
      }
      this._stopYouTubeProgressPolling();
      return;
    }

    if (state === YT.PlayerState.ENDED) {
      this._stopYouTubeProgressPolling();
      if (this._repeatMode === 'one') {
        this.seek(0);
        this._youtubePlayer?.playVideo();
        return;
      }
      void this.next();
    }
  }

  private _startYouTubeProgressPolling(): void {
    this._stopYouTubeProgressPolling();
    this._timeUpdateIntervalId = window.setInterval(() => {
      if (!this._isCurrentSongYouTube() || !this._youtubePlayer) return;
      this.events.emit('time-update', {
        current: this._youtubePlayer.getCurrentTime(),
        total: this._youtubePlayer.getDuration(),
      });
    }, 250);
  }

  private _stopYouTubeProgressPolling(): void {
    if (this._timeUpdateIntervalId !== null) {
      window.clearInterval(this._timeUpdateIntervalId);
      this._timeUpdateIntervalId = null;
    }
  }

  private _ensureYouTubeContainer(): void {
    if (this._youtubeContainer) return;

    const existingContainer = document.getElementById('youtube-player-container');
    if (existingContainer instanceof HTMLElement) {
      this._youtubeContainer = existingContainer;
      return;
    }

    const container = document.createElement('div');
    container.id = 'youtube-player-container';
    container.setAttribute('aria-hidden', 'true');
    container.style.position = 'fixed';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.style.bottom = '0';
    container.style.right = '0';
    document.body.appendChild(container);
    this._youtubeContainer = container;
  }

  private _loadYouTubeApiScript(): void {
    if (this._youtubeScriptRequested || document.querySelector('script[data-youtube-iframe-api="true"]')) {
      return;
    }

    this._youtubeScriptRequested = true;

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.defer = true;
    script.dataset['youtubeIframeApi'] = 'true';
    document.head.appendChild(script);
  }

  private _extractYouTubeVideoId(value: string | undefined): string | null {
    if (!value) return null;

    try {
      const url = new URL(value, window.location.origin);

      if (url.hostname === 'youtu.be') {
        return url.pathname.replace(/^\//, '') || null;
      }

      if (url.searchParams.get('v')) {
        return url.searchParams.get('v');
      }

      const embedMatch = /\/embed\/([^/?]+)/.exec(url.pathname);
      if (embedMatch?.[1]) {
        return embedMatch[1];
      }
    } catch {
      return /^[a-zA-Z0-9_-]{11}$/.test(value) ? value : null;
    }

    return null;
  }

  private _isCurrentSongYouTube(): boolean {
    return this._playlist.currentSong?.source === 'youtube_music';
  }

  private _stopNativeAudio(): void {
    this._audio.pause();
    this._audio.removeAttribute('src');
    this._audio.load();
  }

  private _stopYouTubePlayback(): void {
    this._youtubePlayer?.pauseVideo();
    this._stopYouTubeProgressPolling();
  }

  private _stopCurrentPlayback(): void {
    this._stopNativeAudio();
    this._stopYouTubePlayback();
    this._isPlaying = false;
  }
}
