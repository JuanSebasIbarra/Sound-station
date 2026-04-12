import type { ISong } from '../../interfaces/ISong.js';
import { Player } from '../../core/Player.js';
import { ArtistMetadataService } from '../../services/ArtistMetadataService.js';
import { formatTime } from '../../utils/helpers.js';

/**
 * NowPlaying – manages all DOM elements in the center "now playing" panel.
 *
 * Subscribes to Player events to stay in sync with playback state.
 */
export class NowPlaying {
  private readonly player: Player;
  private readonly metadataService: ArtistMetadataService;

  // DOM refs
  private readonly albumArtEl:    HTMLElement;
  private readonly titleEl:       HTMLElement;
  private readonly artistEl:      HTMLElement;
  private readonly albumEl:       HTMLElement;
  private readonly descriptionEl: HTMLElement;
  private readonly sourceTagEl:   HTMLElement;
  private readonly likeBtn:       HTMLElement;
  private readonly timeCurrent:   HTMLElement;
  private readonly timeTotal:     HTMLElement;
  private readonly progressFill:  HTMLElement;
  private readonly progressThumb: HTMLElement;
  private readonly progressBar:   HTMLElement;
  private readonly playerSection: HTMLElement;

  constructor(player: Player, metadataService: ArtistMetadataService) {
    this.player          = player;
    this.metadataService = metadataService;

    this.albumArtEl    = document.getElementById('album-art')!;
    this.titleEl       = document.getElementById('song-title')!;
    this.artistEl      = document.getElementById('song-artist')!;
    this.albumEl       = document.getElementById('song-album')!;
    this.descriptionEl = document.getElementById('song-description')!;
    this.sourceTagEl   = document.getElementById('song-source-tag')!;
    this.likeBtn       = document.getElementById('btn-like')!;
    this.timeCurrent   = document.getElementById('time-current')!;
    this.timeTotal     = document.getElementById('time-total')!;
    this.progressFill  = document.getElementById('progress-fill')!;
    this.progressThumb = document.getElementById('progress-thumb')!;
    this.progressBar   = document.getElementById('progress-bar')!;
    this.playerSection = document.getElementById('player-section')!;

    this._bindEvents();
    this._bindProgressBar();
    this._bindLikeButton();
  }

  // ── Update UI to reflect a new song ──────────────────────────

  async updateSong(song: ISong): Promise<void> {
    // Animate exit
    this.albumArtEl.classList.remove('playing');

    // Update basic text fields
    this.titleEl.textContent  = song.title;
    this.artistEl.textContent = song.artist;
    this.albumEl.textContent  = song.album;

    // Source tag
    this._setSourceTag(song.source);

    // Like button state
    this.likeBtn.classList.toggle('liked', !!song.liked);

    // Album art
    this._setAlbumArt(song);

    // Ambient background color
    this._setAmbientColor(song);

    // Animate entrance
    this.albumArtEl.classList.add('now-playing-enter');
    setTimeout(() => this.albumArtEl.classList.remove('now-playing-enter'), 300);

    // Async artist description
    this.descriptionEl.textContent = song.description || 'Loading artist info…';
    const bio = await this.metadataService.getBio(song.artist);
    if (this.player.currentSong?.id === song.id) {
      this.descriptionEl.textContent = bio || song.description;
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  private _setAlbumArt(song: ISong): void {
    const existing = this.albumArtEl.querySelector('img, canvas');
    existing?.remove();

    if (song.albumArt) {
      const img = document.createElement('img');
      img.src = song.albumArt;
      img.alt = `${song.title} cover`;
      img.className = 'gradient-art';
      img.onerror = () => this._showPlaceholder();
      this.albumArtEl.appendChild(img);

      // Hide placeholder
      const ph = this.albumArtEl.querySelector<HTMLElement>('.album-art__placeholder');
      if (ph) ph.style.display = 'none';
    } else {
      this._showPlaceholder();
    }
  }

  private _showPlaceholder(): void {
    const ph = this.albumArtEl.querySelector<HTMLElement>('.album-art__placeholder');
    if (ph) ph.style.display = '';
  }

  private _setSourceTag(source: ISong['source']): void {
    this.sourceTagEl.className = 'tag';
    const map: Record<string, string> = {
      spotify:      'tag--spotify',
      apple_music:  'tag--apple',
      youtube_music:'tag--youtube',
      local:        'tag--local',
    };
    if (source) this.sourceTagEl.classList.add(map[source] ?? '');
    const labels: Record<string, string> = {
      spotify:       'Spotify',
      apple_music:   'Apple Music',
      youtube_music: 'YouTube Music',
      local:         'Local',
    };
    this.sourceTagEl.textContent = labels[source ?? ''] ?? 'Unknown';
  }

  private _setAmbientColor(song: ISong): void {
    // Derive a hue from the first character of artist name
    const hue = [...song.artist].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    this.playerSection.style.setProperty(
      '--ambient-color',
      `hsla(${hue},70%,40%,0.3)`
    );
  }

  private _bindEvents(): void {
    this.player.events.on<{ current: number; total: number }>('time-update', ({ current, total }) => {
      this.timeCurrent.textContent = formatTime(current);
      this.timeTotal.textContent   = formatTime(total);

      const pct = total > 0 ? (current / total) * 100 : 0;
      this.progressFill.style.width  = `${pct}%`;
      this.progressThumb.style.left  = `${pct}%`;
      this.progressBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    });

    this.player.events.on<{ songId: string }>('play', () => {
      this.albumArtEl.classList.add('playing');
    });

    this.player.events.on<{ songId: string }>('pause', () => {
      this.albumArtEl.classList.remove('playing');
    });

    this.player.events.on('stop', () => {
      this.albumArtEl.classList.remove('playing');
      this.progressFill.style.width = '0%';
      this.progressThumb.style.left = '0%';
      this.timeCurrent.textContent  = '0:00';
    });

    this.player.events.on<{ songId: string; liked: boolean }>('song-liked', ({ liked }) => {
      this.likeBtn.classList.toggle('liked', liked);
    });
  }

  private _bindProgressBar(): void {
    let isDragging = false;

    const seek = (e: PointerEvent): void => {
      const rect  = this.progressBar.getBoundingClientRect();
      const frac  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.player.seekFraction(frac);
    };

    this.progressBar.addEventListener('pointerdown', (e) => {
      isDragging = true;
      this.progressBar.setPointerCapture(e.pointerId);
      seek(e);
    });

    this.progressBar.addEventListener('pointermove', (e) => {
      if (isDragging) seek(e);
    });

    this.progressBar.addEventListener('pointerup', () => { isDragging = false; });
    this.progressBar.addEventListener('pointercancel', () => { isDragging = false; });

    // Keyboard accessibility
    this.progressBar.addEventListener('keydown', (e) => {
      const dur = this.player.duration;
      if (!dur) return;
      if (e.key === 'ArrowRight') this.player.seek(this.player.currentTime + 5);
      if (e.key === 'ArrowLeft')  this.player.seek(this.player.currentTime - 5);
    });
  }

  private _bindLikeButton(): void {
    this.likeBtn.addEventListener('click', () => {
      const song = this.player.currentSong;
      if (song) this.player.toggleLike(song.id);
    });
  }
}
