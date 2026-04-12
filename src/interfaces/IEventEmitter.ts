/**
 * IEventEmitter – lightweight typed pub/sub contract.
 *
 * Used by Player (Singleton) to notify UI components about
 * state changes without tight coupling (Observer pattern).
 */
export type EventCallback<T = unknown> = (payload: T) => void;

export interface IEventEmitter {
  on<T>(event: string, callback: EventCallback<T>): void;
  off<T>(event: string, callback: EventCallback<T>): void;
  emit<T>(event: string, payload: T): void;
  once<T>(event: string, callback: EventCallback<T>): void;
}

/* ── Typed player events ─────────────────────────────────────── */
export interface PlayerEvents {
  'play':          { songId: string };
  'pause':         { songId: string };
  'stop':          void;
  'next':          { songId: string };
  'previous':      { songId: string };
  'seek':          { time: number };
  'volume':        { level: number };
  'time-update':   { current: number; total: number };
  'playlist-change': void;
  'song-liked':    { songId: string; liked: boolean };
  'shuffle-change': { active: boolean };
  'repeat-change': { mode: RepeatMode };
}

export type RepeatMode = 'none' | 'all' | 'one';
