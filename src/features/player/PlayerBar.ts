import { Player } from '../../core/Player.js';
import { formatTime } from '../../utils/helpers.js';

/**
 * PlayerBar
 *
 * Persistent bottom transport bar with playback controls,
 * progress and volume sliders using PointerEvents.
 */
export class PlayerBar {
  private readonly body = document.body;
  private readonly art = document.getElementById('bar-art') as HTMLImageElement;
  private readonly title = document.getElementById('bar-title') as HTMLElement;
  private readonly artist = document.getElementById('bar-artist') as HTMLElement;

  private readonly prev = document.getElementById('btn-prev') as HTMLButtonElement;
  private readonly play = document.getElementById('btn-play') as HTMLButtonElement;
  private readonly next = document.getElementById('btn-next') as HTMLButtonElement;

  private readonly timeCurrent = document.getElementById('time-current') as HTMLElement;
  private readonly timeTotal = document.getElementById('time-total') as HTMLElement;
  private readonly progressBar = document.getElementById('progress-bar') as HTMLElement;
  private readonly progressFill = document.getElementById('progress-fill') as HTMLElement;

  private readonly volumeBar = document.getElementById('volume-bar') as HTMLElement;
  private readonly volumeFill = document.getElementById('volume-fill') as HTMLElement;
  private readonly volumeIcon = document.getElementById('btn-volume-icon') as HTMLButtonElement;

  private readonly focusOverlay = document.getElementById('song-focus-overlay') as HTMLElement;
  private readonly focusCover = document.getElementById('song-focus-cover') as HTMLImageElement;
  private readonly focusTitle = document.getElementById('song-focus-title') as HTMLElement;
  private readonly focusLyrics = document.getElementById('song-focus-lyrics') as HTMLElement;
  private readonly focusQueueCount = document.getElementById('song-focus-queue-count') as HTMLElement;
  private readonly focusQueue = document.getElementById('song-focus-queue') as HTMLElement;
  private readonly focusClose = document.getElementById('song-focus-close') as HTMLButtonElement;

  constructor(private readonly player: Player) {
    this.bindControls();
    this.bindProgress();
    this.bindVolume();
    this.bindFocusOverlay();
    this.bindPlayerEvents();
    this.syncMeta();
  }

  private bindControls(): void {
    this.prev.addEventListener('click', () => void this.player.previous());
    this.play.addEventListener('click', () => this.player.togglePlay());
    this.next.addEventListener('click', () => void this.player.next());
  }

  private bindProgress(): void {
    let dragging = false;

    const updateFromPointer = (event: PointerEvent): void => {
      const rect = this.progressBar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      this.player.seekFraction(fraction);
    };

    this.progressBar.addEventListener('pointerdown', (event) => {
      dragging = true;
      this.progressBar.setPointerCapture(event.pointerId);
      updateFromPointer(event);
    });

    this.progressBar.addEventListener('pointermove', (event) => {
      if (dragging) updateFromPointer(event);
    });

    this.progressBar.addEventListener('pointerup', () => {
      dragging = false;
    });

    this.progressBar.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') this.player.seek(this.player.currentTime + 5);
      if (event.key === 'ArrowLeft') this.player.seek(this.player.currentTime - 5);
    });
  }

  private bindVolume(): void {
    let dragging = false;

    const updateFromPointer = (event: PointerEvent): void => {
      const rect = this.volumeBar.getBoundingClientRect();
      const level = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      this.player.setVolume(level);
    };

    this.volumeBar.addEventListener('pointerdown', (event) => {
      dragging = true;
      this.volumeBar.setPointerCapture(event.pointerId);
      updateFromPointer(event);
    });

    this.volumeBar.addEventListener('pointermove', (event) => {
      if (dragging) updateFromPointer(event);
    });

    this.volumeBar.addEventListener('pointerup', () => {
      dragging = false;
    });

    this.volumeIcon.addEventListener('click', () => {
      this.player.toggleMute();
      this.syncVolumeIcon();
    });
  }

  private bindPlayerEvents(): void {
    this.player.events.on('play', () => {
      this.play.textContent = '❚❚';
      this.syncMeta();
    });

    this.player.events.on('pause', () => {
      this.play.textContent = '▶';
    });

    this.player.events.on('stop', () => {
      this.play.textContent = '▶';
    });

    this.player.events.on<{ current: number; total: number }>('time-update', ({ current, total }) => {
      this.timeCurrent.textContent = formatTime(current);
      this.timeTotal.textContent = formatTime(total);
      const percent = total > 0 ? (current / total) * 100 : 0;
      this.progressFill.style.width = `${percent}%`;
    });

    this.player.events.on<{ level: number }>('volume', ({ level }) => {
      this.volumeFill.style.width = `${level * 100}%`;
      this.syncVolumeIcon();
    });

    this.player.events.on('next', () => this.syncMeta());
    this.player.events.on('previous', () => this.syncMeta());
    this.player.events.on('playlist-change', () => this.syncMeta());
    this.player.events.on('current-song-update', () => this.syncMeta());
    this.player.events.on('queue-change', () => this.renderFocusQueue());
  }

  private syncVolumeIcon(): void {
    const muted = this.player.isMuted;
    const icon = muted || this.player.volume <= 0 ? '🔇' : '🔊';
    this.volumeIcon.textContent = icon;
    this.volumeIcon.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    this.volumeIcon.setAttribute('title', muted ? 'Unmute' : 'Mute');
  }

  private bindFocusOverlay(): void {
    this.art.addEventListener('click', () => {
      const current = this.player.currentSong;
      if (!current) return;

      this.syncFocusContent();
      this.focusOverlay.classList.remove('hidden');
      this.body.classList.add('focus-mode-open');
    });

    this.focusClose.addEventListener('click', () => {
      this.closeFocusOverlay();
    });

    this.focusOverlay.addEventListener('click', (event) => {
      if (event.target === this.focusOverlay) {
        this.closeFocusOverlay();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.focusOverlay.classList.contains('hidden')) {
        this.closeFocusOverlay();
      }
    });
  }

  private syncMeta(): void {
    const current = this.player.currentSong;
    this.syncVolumeIcon();
    if (!current) return;

    this.art.src = current.albumArt;
    this.title.textContent = current.title;
    this.artist.textContent = current.artist;

    if (!this.focusOverlay.classList.contains('hidden')) {
      this.syncFocusContent();
    }
  }

  private closeFocusOverlay(): void {
    this.focusOverlay.classList.add('hidden');
    this.body.classList.remove('focus-mode-open');
  }

  private syncFocusContent(): void {
    const current = this.player.currentSong;
    if (!current) return;

    this.focusCover.src = current.albumArt;
    this.focusTitle.textContent = `${current.title} · Lyrics`;
    this.focusLyrics.textContent = current.lyrics?.trim() || 'No lyrics added for this song.';
    this.renderFocusQueue();
  }

  private renderFocusQueue(): void {
    const songs = this.player.playbackQueueSongs;
    const activeIndex = this.player.queueCursorIndex;

    this.focusQueueCount.textContent = `${songs.length} in queue`;
    this.focusQueue.innerHTML = '';

    if (songs.length === 0) {
      this.focusQueue.innerHTML = '<p class="queue-empty">Queue is empty. Add songs from ⋯.</p>';
      return;
    }

    songs.forEach((song, index) => {
      const row = document.createElement('article');
      row.className = `queue-row${index === activeIndex ? ' queue-row--active' : ''}`;
      row.innerHTML = `
        <div class="queue-row__meta">
          <strong>${song.title}</strong>
          <small>${song.artist} · ${song.album}</small>
        </div>
        <button class="queue-row__remove" aria-label="Remove from queue">✕</button>
      `;

      row.addEventListener('click', () => {
        void this.player.play(song.id);
      });

      const removeButton = row.querySelector('.queue-row__remove') as HTMLButtonElement;
      removeButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.player.removeFromPlaybackQueueAt(index);
      });

      this.focusQueue.appendChild(row);
    });
  }
}
