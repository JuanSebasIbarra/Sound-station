import { Player } from '../core/Player.js';

/**
 * DragDropHandler – reorder playlist items via HTML5 drag-and-drop
 * and native PointerEvents for touch-friendly dragging.
 *
 * Responsibilities:
 *  • Make each `.playlist-item` draggable
 *  • Track the dragged item and the drop target
 *  • Call `player.moveSong()` to update the DoublyLinkedList
 *  • Handle global file drag-and-drop (audio files → import)
 *
 * Architecture: attaches event delegation to the playlist container
 * so newly added items are handled without re-registration.
 */
export class DragDropHandler {
  private readonly listEl: HTMLElement;
  private readonly overlayEl: HTMLElement;
  private readonly player: Player;

  private draggedId: string | null = null;
  private draggedEl: HTMLElement | null = null;

  // Pointer-based drag state (for touch reorder)
  private pointerDragging = false;
  private ghostEl: HTMLElement | null = null;

  constructor(
    listEl: HTMLElement,
    overlayEl: HTMLElement,
    player: Player,
    private readonly onFileDrop: (files: FileList) => void,
  ) {
    this.listEl    = listEl;
    this.overlayEl = overlayEl;
    this.player    = player;

    this._bindList();
    this._bindGlobalFileDrop();
  }

  // ─────────────────────────────────────────────────────────────
  //  Playlist item reordering (HTML5 Drag & Drop)
  // ─────────────────────────────────────────────────────────────

  private _bindList(): void {
    // Event delegation – catches all items including future ones
    this.listEl.addEventListener('dragstart', this._onDragStart);
    this.listEl.addEventListener('dragover',  this._onDragOver);
    this.listEl.addEventListener('dragleave', this._onDragLeave);
    this.listEl.addEventListener('drop',      this._onDrop);
    this.listEl.addEventListener('dragend',   this._onDragEnd);

    // Touch / stylus reorder via PointerEvents
    this.listEl.addEventListener('pointerdown', this._onPointerDown, { passive: false });
  }

  // ── HTML5 Drag & Drop ─────────────────────────────────────────

  private readonly _onDragStart = (e: DragEvent): void => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.playlist-item');
    if (!item) return;

    this.draggedId = item.dataset['songId'] ?? null;
    this.draggedEl = item;
    item.classList.add('dragging');

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.draggedId ?? '');
    }
  };

  private readonly _onDragOver = (e: DragEvent): void => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    const target = (e.target as HTMLElement).closest<HTMLElement>('.playlist-item');
    if (!target || target === this.draggedEl) return;

    // Clear previous indicators
    this.listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    target.classList.add('drag-over');
  };

  private readonly _onDragLeave = (e: DragEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.playlist-item');
    target?.classList.remove('drag-over');
  };

  private readonly _onDrop = (e: DragEvent): void => {
    e.preventDefault();

    const targetItem = (e.target as HTMLElement).closest<HTMLElement>('.playlist-item');
    if (!targetItem || !this.draggedId) return;

    const targetId = targetItem.dataset['songId'];
    if (!targetId || targetId === this.draggedId) return;

    // Find target index and move
    const items   = Array.from(this.listEl.querySelectorAll<HTMLElement>('.playlist-item'));
    const toIndex = items.indexOf(targetItem);

    this.player.moveSong(this.draggedId, toIndex);
  };

  private readonly _onDragEnd = (): void => {
    this.draggedEl?.classList.remove('dragging');
    this.listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    this.draggedId = null;
    this.draggedEl = null;
  };

  // ── Touch / Pointer reorder ───────────────────────────────────

  private readonly _onPointerDown = (e: PointerEvent): void => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.playlist-item');
    if (!item) return;

    // Only initiate on long press (200 ms) to differentiate from taps
    const longPressTimer = setTimeout(() => {
      this.pointerDragging = true;
      this.draggedId       = item.dataset['songId'] ?? null;
      this.draggedEl       = item;

      item.setPointerCapture(e.pointerId);
      this._createGhost(item, e.clientX, e.clientY);

      item.addEventListener('pointermove', this._onPointerMove, { passive: true });
      item.addEventListener('pointerup',   this._onPointerUp);
      item.addEventListener('pointercancel', this._onPointerUp);
    }, 200);

    item.addEventListener('pointerup', () => clearTimeout(longPressTimer), { once: true });
  };

  private readonly _onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDragging || !this.ghostEl) return;
    this.ghostEl.style.top = `${e.clientY - 20}px`;

    // Highlight the item under the ghost
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    const target = els.find(el => el.classList.contains('playlist-item') && el !== this.draggedEl);

    this.listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    if (target) target.classList.add('drag-over');
  };

  private readonly _onPointerUp = (e: PointerEvent): void => {
    if (!this.pointerDragging) return;
    this.pointerDragging = false;

    const els    = document.elementsFromPoint(e.clientX, e.clientY);
    const target = els.find(el =>
      el.classList.contains('playlist-item') && el !== this.draggedEl
    ) as HTMLElement | undefined;

    if (target && this.draggedId) {
      const items   = Array.from(this.listEl.querySelectorAll<HTMLElement>('.playlist-item'));
      const toIndex = items.indexOf(target);
      this.player.moveSong(this.draggedId, toIndex);
    }

    this._destroyGhost();
    this.listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    this.draggedEl?.classList.remove('dragging');
    this.draggedId = null;
    this.draggedEl = null;

    (e.target as HTMLElement).removeEventListener('pointermove', this._onPointerMove);
    (e.target as HTMLElement).removeEventListener('pointerup',   this._onPointerUp);
  };

  private _createGhost(source: HTMLElement, x: number, y: number): void {
    this.ghostEl = source.cloneNode(true) as HTMLElement;
    Object.assign(this.ghostEl.style, {
      position:    'fixed',
      left:        `${x - 20}px`,
      top:         `${y - 20}px`,
      width:       `${source.offsetWidth}px`,
      opacity:     '0.85',
      pointerEvents: 'none',
      zIndex:      '9999',
      borderRadius: '8px',
      background:  'rgba(124,58,237,0.25)',
      backdropFilter: 'blur(8px)',
      boxShadow:   '0 8px 32px rgba(0,0,0,0.5)',
      transform:   'scale(1.03)',
      transition:  'transform 0.1s',
    });
    document.body.appendChild(this.ghostEl);
    source.classList.add('dragging');
  }

  private _destroyGhost(): void {
    this.ghostEl?.remove();
    this.ghostEl = null;
  }

  // ─────────────────────────────────────────────────────────────
  //  Global file drag-and-drop (audio files)
  // ─────────────────────────────────────────────────────────────

  private _bindGlobalFileDrop(): void {
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
      if (!this._hasAudioFiles(e)) return;
      dragCounter++;
      this.overlayEl.classList.remove('hidden');
      e.preventDefault();
    });

    document.addEventListener('dragleave', () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        this.overlayEl.classList.add('hidden');
      }
    });

    document.addEventListener('dragover', (e) => {
      if (this._hasAudioFiles(e)) e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      this.overlayEl.classList.add('hidden');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.onFileDrop(files);
      }
    });
  }

  private _hasAudioFiles(e: DragEvent): boolean {
    return Array.from(e.dataTransfer?.items ?? []).some(
      item => item.kind === 'file' && item.type.startsWith('audio/')
    );
  }
}
