import type { ISong } from '../../interfaces/ISong.js';
import { Player } from '../../core/Player.js';
import { PointerGestureController } from '../../hooks/PointerGestureController.js';

/**
 * PlaylistView
 *
 * Hero "Recently Played" view driven directly from DoublyLinkedList order.
 * Supports swipe navigation and drag/drop reorder.
 */
export class PlaylistView {
  private readonly gesture: PointerGestureController;
  private readonly onRemoveSong?: (songId: string) => void;
  private readonly isSongVisible?: (song: ISong) => boolean;

  constructor(
    private readonly root: HTMLElement,
    private readonly player: Player,
    options?: {
      onRemoveSong?: (songId: string) => void;
      isSongVisible?: (song: ISong) => boolean;
    },
  ) {
    this.onRemoveSong = options?.onRemoveSong;
    this.isSongVisible = options?.isSongVisible;

    this.bindPlayerEvents();
    this.render('left');
    this.gesture = new PointerGestureController(this.root, {
      onSwipeLeft: () => void this.player.next(),
      onSwipeRight: () => void this.player.previous(),
    });
  }

  destroy(): void {
    this.gesture.destroy();
  }

  render(direction: 'left' | 'right' = 'left'): void {
    const songs = this.player.playlist
      .toArray()
      .filter((song) => (this.isSongVisible ? this.isSongVisible(song) : true));
    const currentId = this.player.currentSong?.id;

    this.root.classList.remove('slide-left', 'slide-right');
    this.root.classList.add(direction === 'left' ? 'slide-left' : 'slide-right');

    this.root.innerHTML = '';

    if (songs.length === 0) {
      const empty = document.createElement('article');
      empty.className = 'recently-empty-state';
      empty.innerHTML = `
        <h3>No hay canciones recientes</h3>
        <p>Agrega una canción local o crea una playlist para comenzar a escuchar música.</p>
      `;
      this.root.appendChild(empty);
      return;
    }

    songs.slice(0, 8).forEach((song) => {
      const card = this.createCard(song, currentId === song.id);
      this.root.appendChild(card);
    });
  }

  private createCard(song: ISong, active: boolean): HTMLElement {
    const card = document.createElement('article');
    card.className = `song-card${active ? ' song-card--active' : ''}`;
    if (song.isFileAvailable === false) card.classList.add('song-card--missing');
    card.draggable = true;
    card.dataset['songId'] = song.id;

    card.innerHTML = `
      <button class="song-card__remove" aria-label="Remove song" title="Remove song">✕</button>
      <button class="song-card__queue" aria-label="Add song to queue" title="Add to queue">≡+</button>
      <img src="${song.albumArt}" alt="${song.title} cover" />
      <div class="song-card__body">
        <h3 class="song-card__title">${song.title}</h3>
        <p class="song-card__artist">${song.artist}</p>
      </div>
    `;

    const removeBtn = card.querySelector('.song-card__remove') as HTMLButtonElement;
    const queueBtn = card.querySelector('.song-card__queue') as HTMLButtonElement;

    queueBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.player.addToPlaybackQueue(song.id);
    });
    removeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (this.onRemoveSong) {
        this.onRemoveSong(song.id);
        return;
      }

      this.player.remove(song.id);
    });

    card.addEventListener('click', () => {
      if (song.isFileAvailable === false) return;
      void this.player.play(song.id);
    });

    card.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', song.id);
      event.dataTransfer!.effectAllowed = 'move';
    });

    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'move';
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const fromId = event.dataTransfer?.getData('text/plain');
      if (!fromId || fromId === song.id) return;
      const toIndex = this.player.playlist.indexOf(song.id);
      if (toIndex >= 0) {
        this.player.moveSong(fromId, toIndex);
      }
    });

    return card;
  }

  private bindPlayerEvents(): void {
    this.player.events.on('playlist-change', () => this.render('left'));
    this.player.events.on('play', () => this.render('left'));
    this.player.events.on('next', () => this.render('left'));
    this.player.events.on('previous', () => this.render('right'));
  }
}
