import { Player } from '../../core/Player.js';

/**
 * PlaybackQueueView
 *
 * Renders the runtime playback queue with iOS-like list rows.
 */
export class PlaybackQueueView {
  private readonly queueCount = document.getElementById('queue-count') as HTMLElement;
  private readonly root = document.getElementById('queue-list') as HTMLElement;
  private readonly clearButton = document.getElementById('btn-clear-queue') as HTMLButtonElement;

  constructor(private readonly player: Player) {
    this.bindEvents();
    this.render();
  }

  render(): void {
    const songs = this.player.playbackQueueSongs;
    const activeIndex = this.player.queueCursorIndex;

    this.queueCount.textContent = `${songs.length} in queue`;
    this.root.innerHTML = '';

    if (songs.length === 0) {
      this.root.innerHTML = '<p class="queue-empty">Queue is empty. Use ⋯ on any song card.</p>';
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

      const remove = row.querySelector('.queue-row__remove') as HTMLButtonElement;
      remove.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.player.removeFromPlaybackQueueAt(index);
      });

      this.root.appendChild(row);
    });
  }

  private bindEvents(): void {
    this.clearButton.addEventListener('click', () => {
      this.player.clearPlaybackQueue();
    });

    this.player.events.on('queue-change', () => this.render());
    this.player.events.on('play', () => this.render());
  }
}
