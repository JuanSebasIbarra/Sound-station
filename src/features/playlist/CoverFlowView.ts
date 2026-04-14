import type { SongNode } from '../../core/SongNode.js';
import type { ISong } from '../../interfaces/ISong.js';
import { Player } from '../../core/Player.js';

/**
 * CoverFlowView – iOS 6-style full-screen 3-D album carousel.
 *
 * Visualizes the DoublyLinkedList structure in real time:
 *
 *   … ← left-3 ← left-2 ← left-1 ← [center] → right-1 → right-2 → right-3 → …
 *         prev³       prev²      prev      current     next       next²      next³
 *
 * ── Keyboard controls ──────────────────────────────────────────
 *   ArrowRight  →  player.next()      (advances DLL cursor)
 *   ArrowLeft   ←  player.previous()  (retreats DLL cursor)
 *   Enter           player.play()     (only while stage is focused)
 *
 * ── Pointer / touch ────────────────────────────────────────────
 *   Swipe left  →  next
 *   Swipe right →  previous
 *   Click side album → jumpToId() + re-render (no auto-play)
 *   Click center     → player.play(songId)
 */
export class CoverFlowView {
  private static readonly MAX_SIDES = 3;
  private _swipeStartX = 0;
  private _animationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly stage: HTMLElement,
    private readonly titleEl: HTMLElement,
    private readonly artistEl: HTMLElement,
    private readonly player: Player,
  ) {
    this.render();
    this.bindPlayerEvents();
    this.bindKeyboard();
    this.bindPointer();
  }

  /** Focus the stage element so keyboard navigation works immediately. */
  focusStage(): void {
    this.stage.focus({ preventScroll: true });
  }

  // ─────────────────────────────────────────────────────────────
  //  Core render – snapshot DLL state → paint position classes
  // ─────────────────────────────────────────────────────────────

  render(): void {
    const dll     = this.player.playlist;
    const current = dll.currentNode;

    this.stage.innerHTML = '';

    if (!current) {
      const empty = document.createElement('p');
      empty.className   = 'cf-empty';
      empty.textContent = 'No songs loaded — import or create a playlist to begin.';
      this.stage.appendChild(empty);
      this.titleEl.textContent  = 'No song selected';
      this.artistEl.textContent = '—';
      return;
    }

    // ── Collect left chain (prev pointers) ───────────────────
    // leftNodes[0] = nearest (prev), [n-1] = farthest (prev^n)
    const leftNodes: SongNode[] = [];
    let cursor: SongNode | null = current.prev;
    while (cursor && leftNodes.length < CoverFlowView.MAX_SIDES) {
      leftNodes.push(cursor);
      cursor = cursor.prev;
    }

    // Render farthest-left first → nearer ones sit on top (z-index ascending)
    for (let i = leftNodes.length - 1; i >= 0; i--) {
      const depth = i + 1; // 1 = nearest, MAX_SIDES = farthest
      this.stage.appendChild(
        this.makeAlbum(leftNodes[i]!.song, 'left', depth),
      );
    }

    // ── Center (currentNode) ──────────────────────────────────
    this.stage.appendChild(this.makeAlbum(current.song, 'center', 0));

    // ── Collect right chain (next pointers) ───────────────────
    const rightNodes: SongNode[] = [];
    cursor = current.next;
    while (cursor && rightNodes.length < CoverFlowView.MAX_SIDES) {
      rightNodes.push(cursor);
      cursor = cursor.next;
    }

    rightNodes.forEach((node, i) =>
      this.stage.appendChild(this.makeAlbum(node.song, 'right', i + 1)),
    );

    // ── Update metadata strip ─────────────────────────────────
    this.titleEl.textContent  = current.song.title;
    this.artistEl.textContent =
      `${current.song.artist}${current.song.album ? ' — ' + current.song.album : ''}`;
  }

  // ─────────────────────────────────────────────────────────────
  //  Album element factory
  // ─────────────────────────────────────────────────────────────

  private makeAlbum(
    song: ISong,
    position: 'left' | 'center' | 'right',
    depth: number,
  ): HTMLElement {
    const el = document.createElement('div');

    // Assign position class:
    //   index < activeIndex  → .cf-album--left-{depth}
    //   index === activeIndex → .cf-album--center
    //   index > activeIndex  → .cf-album--right-{depth}
    const posClass =
      position === 'center'
        ? 'cf-album--center'
        : `cf-album--${position}-${depth}`;

    el.className = `cf-album ${posClass}`;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-label', `${song.title} by ${song.artist}`);
    if (position === 'center') el.setAttribute('aria-selected', 'true');

    const img   = document.createElement('img');
    const enhancedArt = this.enhanceArtworkUrl(song.albumArt);
    img.src       = enhancedArt;
    if (enhancedArt !== song.albumArt) {
      img.dataset['fallbackSrc'] = song.albumArt;
      img.addEventListener('error', () => {
        if (img.dataset['fallbackSrc']) {
          img.src = img.dataset['fallbackSrc'];
          delete img.dataset['fallbackSrc'];
        }
      }, { once: true });
    }
    img.alt       = `${song.title} album art`;
    img.className = 'cf-album__cover';
    img.draggable = false;
    el.appendChild(img);

    if (position === 'center') {
      // Center click → immediate playback
      el.title = `▶  Play  — ${song.title}`;
      el.addEventListener('click', () => void this.player.play(song.id));
    } else {
      // Side click → move DLL cursor to this song, re-render (no auto-play)
      el.title = song.title;
      el.addEventListener('click', () => {
        this.player.playlist.jumpToId(song.id);
        this.render();
      });
    }

    return el;
  }

  // ─────────────────────────────────────────────────────────────
  //  Player event bindings – keep carousel in sync with DLL
  // ─────────────────────────────────────────────────────────────

  private bindPlayerEvents(): void {
    this.player.events.on('play',            () => this.render());
    this.player.events.on('next',            () => this.render());
    this.player.events.on('previous',        () => this.render());
    this.player.events.on('playlist-change', () => this.render());
  }

  // ─────────────────────────────────────────────────────────────
  //  Global keyboard handler
  //  Guards: ignore while the user types in an input/modal
  // ─────────────────────────────────────────────────────────────

  private bindKeyboard(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Don't intercept if focus is inside a text field
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Don't intercept if any modal overlay is open
      const modalOpen = !!document.querySelector('.modal-overlay:not(.hidden)');
      if (modalOpen) return;

      // Only react when the Cover Flow view is actually visible
      const cfView = document.getElementById('cover-flow-view');
      if (!cfView || cfView.classList.contains('hidden')) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          this.stepPreview('next');
          break;

        case 'ArrowLeft':
          e.preventDefault();
          this.stepPreview('previous');
          break;

        case 'Enter':
          // Play only when the stage (or a child of it) holds focus
          if (
            this.stage === document.activeElement ||
            this.stage.contains(document.activeElement)
          ) {
            e.preventDefault();
            void this.player.play();
          }
          break;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  Pointer / swipe (Pointer Events API — no Hammer.js)
  // ─────────────────────────────────────────────────────────────

  private bindPointer(): void {
    this.stage.addEventListener('pointerdown', (e: PointerEvent) => {
      this._swipeStartX = e.clientX;
    });

    this.stage.addEventListener('pointerup', (e: PointerEvent) => {
      const delta = e.clientX - this._swipeStartX;
      if (Math.abs(delta) > 50) {
        delta < 0
          ? this.stepPreview('next')
          : this.stepPreview('previous');
      }
    });
  }

  private stepPreview(direction: 'next' | 'previous'): void {
    const dll = this.player.playlist;
    if (dll.isEmpty) return;

    if (!dll.currentNode) {
      dll.jumpToHead();
    }

    let moved = direction === 'next' ? dll.getNext() : dll.getPrevious();
    if (!moved) {
      const songs = dll.toArray();
      const edgeId = direction === 'next' ? songs[0]?.id : songs[songs.length - 1]?.id;
      if (edgeId) {
        moved = dll.jumpToId(edgeId);
      }
    }

    if (!moved) return;

    this.animateStep(direction === 'next' ? 'left' : 'right');
    this.render();
  }

  private animateStep(direction: 'left' | 'right'): void {
    this.stage.classList.remove('coverflow-stage--step-left', 'coverflow-stage--step-right');
    // Force a reflow so consecutive key presses replay animation.
    void this.stage.offsetWidth;
    this.stage.classList.add(direction === 'left' ? 'coverflow-stage--step-left' : 'coverflow-stage--step-right');

    if (this._animationTimer) {
      clearTimeout(this._animationTimer);
    }

    this._animationTimer = setTimeout(() => {
      this.stage.classList.remove('coverflow-stage--step-left', 'coverflow-stage--step-right');
      this._animationTimer = null;
    }, 320);
  }

  private enhanceArtworkUrl(url: string): string {
    if (!url) return url;

    if (url.includes('ytimg.com')) {
      return url.replace(/\/(hqdefault|mqdefault|sddefault|default)(\.jpg|\.webp)/, '/maxresdefault$2');
    }

    if (url.includes('mzstatic.com')) {
      return url.replace(/\/\d+x\d+bb\./, '/1200x1200bb.');
    }

    return url;
  }
}
