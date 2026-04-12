export interface SwipePayload {
  dx: number;
  dy: number;
  duration: number;
}

interface PointerGestureOptions {
  threshold?: number;
  verticalTolerance?: number;
  maxDuration?: number;
  onSwipeLeft?: (payload: SwipePayload) => void;
  onSwipeRight?: (payload: SwipePayload) => void;
}

/**
 * PointerGestureController
 *
 * Native PointerEvents gesture recognizer. Recommended approach for
 * modern web apps because it handles mouse/touch/pen uniformly.
 */
export class PointerGestureController {
  private startX = 0;
  private startY = 0;
  private startAt = 0;
  private tracking = false;

  private readonly threshold: number;
  private readonly verticalTolerance: number;
  private readonly maxDuration: number;

  constructor(private readonly element: HTMLElement, private readonly options: PointerGestureOptions) {
    this.threshold = options.threshold ?? 64;
    this.verticalTolerance = options.verticalTolerance ?? 92;
    this.maxDuration = options.maxDuration ?? 420;

    this.element.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    this.element.addEventListener('pointerup', this.onPointerUp, { passive: true });
    this.element.addEventListener('pointercancel', this.onPointerCancel, { passive: true });
  }

  destroy(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerCancel);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary) return;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startAt = performance.now();
    this.tracking = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.tracking || !event.isPrimary) return;
    this.tracking = false;

    const payload: SwipePayload = {
      dx: event.clientX - this.startX,
      dy: event.clientY - this.startY,
      duration: performance.now() - this.startAt,
    };

    const horizontal = Math.abs(payload.dx) > this.threshold;
    const verticalSafe = Math.abs(payload.dy) < this.verticalTolerance;
    const fastEnough = payload.duration < this.maxDuration;

    if (!(horizontal && verticalSafe && fastEnough)) return;

    if (payload.dx < 0) this.options.onSwipeLeft?.(payload);
    else this.options.onSwipeRight?.(payload);
  };

  private readonly onPointerCancel = (): void => {
    this.tracking = false;
  };
}
