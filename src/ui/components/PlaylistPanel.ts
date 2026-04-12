import { Player } from '../../core/Player.js';
import type { ISong } from '../../interfaces/ISong.js';
import { formatTime, generateGradientArt } from '../../utils/helpers.js';

/**
 * PlaylistPanel – renders and manages the sidebar queue list.
 *
 * Responsibilities:
 *  • Render the full playlist from the DoublyLinkedList
 *  • Highlight the currently playing item
 *  • Provide per-item remove buttons
 *  • Enable drag-and-drop reordering (items get `draggable="true"`)
 *  • Swipe-to-remove via PointerEvents on each item
 *  • Quick-add form at the top
 *  • Live search filtering
 */
export class PlaylistPanel {
  private readonly player: Player;

  // DOM refs
  private readonly listEl:    HTMLElement;
  private readonly countEl:   HTMLElement;
  private readonly clearBtn:  HTMLElement;
  private readonly addTitleEl:  HTMLInputElement;
  private readonly addArtistEl: HTMLInputElement;
  private readonly addStartBtn: HTMLElement;
  private readonly addEndBtn:   HTMLElement;

  constructor(player: Player) {
    this.player = player;

    this.listEl     = document.getElementById('playlist')!;
    this.countEl    = document.getElementById('queue-count')!;
    this.clearBtn   = document.getElementById('btn-clear-queue')!;
    this.addTitleEl = document.getElementById('add-song-input') as HTMLInputElement;
    this.addArtistEl= document.getElementById('add-artist-input') as HTMLInputElement;
    this.addStartBtn= document.getElementById('btn-add-start')!;
    this.addEndBtn  = document.getElementById('btn-add-end')!;

    this._bindEvents();
    this.render();
  }

  // ── Full re-render ────────────────────────────────────────────

  render(): void {
    const songs = this.player.playlist.toArray();
    const current = this.player.currentSong;

    this.listEl.innerHTML = '';

    for (const song of songs) {
      this.listEl.appendChild(this._createItem(song, current?.id === song.id));
    }

    this.countEl.textContent = String(songs.length);
  }

  // ── Single item factory ───────────────────────────────────────

  private _createItem(song: ISong, isActive: boolean): HTMLElement {
    const li = document.createElement('li');
    li.className = `playlist-item${isActive ? ' active' : ''}`;
    li.dataset['songId'] = song.id;
    li.draggable = true;

    // Album art (gradient SVG thumbnail)
    const artDiv = document.createElement('div');
    artDiv.className = 'playlist-item__art';
    const img = document.createElement('img');
    img.src = song.albumArt || generateGradientArt(song.id);
    img.alt = '';
    img.loading = 'lazy';
    artDiv.appendChild(img);

    // Info
    const info = document.createElement('div');
    info.className = 'playlist-item__info';

    const titleEl = document.createElement('div');
    titleEl.className = 'playlist-item__title';
    titleEl.textContent = song.title;

    const artistEl = document.createElement('div');
    artistEl.className = 'playlist-item__artist';
    artistEl.textContent = song.artist;

    info.append(titleEl, artistEl);

    // Duration
    const dur = document.createElement('span');
    dur.className = 'playlist-item__duration';
    dur.textContent = formatTime(song.duration);

    // Playing indicator (shown instead of duration when active)
    if (isActive && this.player.isPlaying) {
      const indicator = document.createElement('div');
      indicator.className = 'playing-indicator';
      indicator.innerHTML = '<span></span><span></span><span></span>';
      li.append(artDiv, info, indicator);
    } else {
      li.append(artDiv, info, dur);
    }

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn--icon btn--ghost playlist-item__remove';
    removeBtn.title = 'Remove from queue';
    removeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>`;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._animateRemove(li, song.id);
    });
    li.appendChild(removeBtn);

    // Click → play
    li.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.playlist-item__remove')) return;
      void this.player.play(song.id);
    });

    // Swipe-to-remove via PointerEvents
    this._attachSwipeToRemove(li, song.id);

    return li;
  }

  // ── Swipe-to-remove on list item ─────────────────────────────

  private _attachSwipeToRemove(li: HTMLElement, songId: string): void {
    let startX = 0;
    let tracking = false;

    li.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return; // mouse users use the remove button
      startX   = e.clientX;
      tracking = true;
    }, { passive: true });

    li.addEventListener('pointermove', (e: PointerEvent) => {
      if (!tracking) return;
      const dx = e.clientX - startX;
      if (dx < -10) {
        li.style.transform = `translateX(${Math.max(dx, -80)}px)`;
        li.style.opacity   = String(Math.max(0.3, 1 + dx / 120));
      }
    }, { passive: true });

    li.addEventListener('pointerup', (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;

      if (dx < -60) {
        this._animateRemove(li, songId);
      } else {
        li.style.transition = 'transform 0.2s, opacity 0.2s';
        li.style.transform  = '';
        li.style.opacity    = '';
        setTimeout(() => { li.style.transition = ''; }, 200);
      }
    }, { passive: true });
  }

  private _animateRemove(li: HTMLElement, songId: string): void {
    li.style.transition = 'transform 0.25s ease, opacity 0.25s ease, max-height 0.25s ease';
    li.style.transform  = 'translateX(-100%)';
    li.style.opacity    = '0';
    li.style.maxHeight  = `${li.offsetHeight}px`;

    setTimeout(() => {
      li.style.maxHeight = '0';
      li.style.padding   = '0';
      li.style.margin    = '0';
    }, 50);

    setTimeout(() => {
      this.player.remove(songId);
    }, 300);
  }

  // ── Event bindings ────────────────────────────────────────────

  private _bindEvents(): void {
    // Re-render when playlist or playback state changes
    this.player.events.on('playlist-change', () => this.render());
    this.player.events.on('play',  () => this.render());
    this.player.events.on('pause', () => this.render());
    this.player.events.on('next',  () => this.render());
    this.player.events.on('previous', () => this.render());

    // Clear all
    this.clearBtn.addEventListener('click', () => {
      if (confirm('Clear the entire queue?')) {
        this.player.clearPlaylist();
      }
    });

    // Quick add – prepend
    this.addStartBtn.addEventListener('click', () => this._quickAdd('start'));
    // Quick add – append
    this.addEndBtn.addEventListener('click',   () => this._quickAdd('end'));

    // Enter key on inputs
    [this.addTitleEl, this.addArtistEl].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._quickAdd('end');
      });
    });
  }

  private _quickAdd(position: 'start' | 'end'): void {
    const title  = this.addTitleEl.value.trim();
    const artist = this.addArtistEl.value.trim();
    if (!title) return;

    const song: ISong = {
      id:          crypto.randomUUID(),
      title,
      artist:      artist || 'Unknown Artist',
      album:       '',
      duration:    0,
      albumArt:    generateGradientArt(title + artist),
      description: '',
      source:      'local',
    };

    if (position === 'start') {
      this.player.addAtStart(song);
    } else {
      this.player.addAtEnd(song);
    }

    this.addTitleEl.value  = '';
    this.addArtistEl.value = '';
    this.addTitleEl.focus();
  }

  // ── Search filter (called by main) ───────────────────────────

  filter(query: string): void {
    const lq = query.toLowerCase();
    const items = this.listEl.querySelectorAll<HTMLElement>('.playlist-item');

    items.forEach(item => {
      const songId = item.dataset['songId'];
      if (!songId) return;

      const songs = this.player.playlist.toArray();
      const song  = songs.find(s => s.id === songId);
      if (!song) return;

      const match = !lq ||
        song.title.toLowerCase().includes(lq) ||
        song.artist.toLowerCase().includes(lq) ||
        song.album.toLowerCase().includes(lq);

      item.style.display = match ? '' : 'none';
    });
  }
}
