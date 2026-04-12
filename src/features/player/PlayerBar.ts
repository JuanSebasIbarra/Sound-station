import { Player } from '../../core/Player.js';
import { formatTime } from '../../utils/helpers.js';

/**
 * PlayerBar
 *
 * Persistent bottom transport bar with playback controls,
 * progress and volume sliders using PointerEvents.
 */
export class PlayerBar {
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

  constructor(private readonly player: Player) {
    this.bindControls();
    this.bindProgress();
    this.bindVolume();
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
    });

    this.player.events.on('next', () => this.syncMeta());
    this.player.events.on('previous', () => this.syncMeta());
    this.player.events.on('playlist-change', () => this.syncMeta());
  }

  private syncMeta(): void {
    const current = this.player.currentSong;
    if (!current) return;

    this.art.src = current.albumArt;
    this.title.textContent = current.title;
    this.artist.textContent = current.artist;
  }
}
