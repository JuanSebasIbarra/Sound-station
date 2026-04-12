import { Player } from '../core/Player.js';

/**
 * GestureHandler – detects swipe gestures on the player section
 * using the native PointerEvents API (no library dependency).
 *
 * Registered gestures:
 *  • Swipe LEFT  on player  → next song
 *  • Swipe RIGHT on player  → previous song
 *  • Swipe LEFT  on a playlist item → remove song
 *  • Swipe RIGHT on a playlist item → add to queue (no-op here, hook provided)
 *
 * Pointer events chosen over Touch events because they work for
 * both touch screens AND stylus/mouse, per W3C recommendation.
 */
export class GestureHandler {
  private readonly player: Player;
  private readonly element: HTMLElement;

  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private isTracking = false;

  /** Minimum horizontal distance (px) to count as a swipe */
  private static readonly SWIPE_THRESHOLD = 60;
  /** Maximum vertical deviation – keeps horizontal-only swipes */
  private static readonly VERTICAL_LIMIT  = 80;
  /** Maximum duration (ms) for a quick swipe */
  private static readonly MAX_DURATION    = 400;

  constructor(element: HTMLElement, player: Player) {
    this.element = element;
    this.player  = player;
    this._bind();
  }

  private _bind(): void {
    this.element.addEventListener('pointerdown',   this._onDown,  { passive: true });
    this.element.addEventListener('pointermove',   this._onMove,  { passive: true });
    this.element.addEventListener('pointerup',     this._onUp,    { passive: true });
    this.element.addEventListener('pointercancel', this._onCancel,{ passive: true });
  }

  destroy(): void {
    this.element.removeEventListener('pointerdown',   this._onDown);
    this.element.removeEventListener('pointermove',   this._onMove);
    this.element.removeEventListener('pointerup',     this._onUp);
    this.element.removeEventListener('pointercancel', this._onCancel);
  }

  // ── Pointer handlers (arrow functions keep `this`) ───────────

  private readonly _onDown = (e: PointerEvent): void => {
    // Only handle primary pointer (first finger / left button)
    if (!e.isPrimary) return;
    this.startX   = e.clientX;
    this.startY   = e.clientY;
    this.startTime = Date.now();
    this.isTracking = true;

    // Capture so pointermove keeps firing even outside the element
    this.element.setPointerCapture(e.pointerId);
  };

  private readonly _onMove = (e: PointerEvent): void => {
    if (!this.isTracking || !e.isPrimary) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    // Visual feedback – translate the element slightly
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      this.element.style.transform = `translateX(${dx * 0.25}px)`;
    }
  };

  private readonly _onUp = (e: PointerEvent): void => {
    if (!this.isTracking || !e.isPrimary) return;
    this.isTracking = false;

    const dx       = e.clientX - this.startX;
    const dy       = e.clientY - this.startY;
    const elapsed  = Date.now() - this.startTime;

    // Reset visual transform with animation
    this.element.style.transition = 'transform 0.3s ease';
    this.element.style.transform  = '';
    setTimeout(() => { this.element.style.transition = ''; }, 300);

    const isSwipe =
      Math.abs(dx) >= GestureHandler.SWIPE_THRESHOLD &&
      Math.abs(dy) <= GestureHandler.VERTICAL_LIMIT  &&
      elapsed       <= GestureHandler.MAX_DURATION;

    if (!isSwipe) return;

    if (dx < 0) {
      // ← Swipe left → Next
      void this.player.next();
      this._ripple('← Next');
    } else {
      // → Swipe right → Previous
      void this.player.previous();
      this._ripple('Previous →');
    }
  };

  private readonly _onCancel = (_e: PointerEvent): void => {
    this.isTracking = false;
    this.element.style.transition = 'transform 0.3s ease';
    this.element.style.transform  = '';
    setTimeout(() => { this.element.style.transition = ''; }, 300);
  };

  /** Brief on-screen label to confirm gesture recognition */
  private _ripple(label: string): void {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      background: rgba(124,58,237,0.85); color: #fff;
      padding: 10px 24px; border-radius: 999px;
      font-size: 1rem; font-weight: 600; pointer-events: none;
      transition: opacity 0.4s ease, transform 0.4s ease;
      z-index: 999;
    `;
    this.element.style.position = 'relative';
    this.element.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -50%) scale(1)';
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%, -70%) scale(0.8)';
        setTimeout(() => el.remove(), 400);
      }, 500);
    });
  }
}
