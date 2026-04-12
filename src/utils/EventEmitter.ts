import type { IEventEmitter, EventCallback } from '../interfaces/IEventEmitter.js';

/**
 * EventEmitter – generic pub/sub implementation.
 *
 * Follows the Observer pattern; used by the Player Singleton to
 * broadcast state changes to decoupled UI components.
 */
export class EventEmitter implements IEventEmitter {
  private readonly listeners = new Map<string, Set<EventCallback<unknown>>>();

  /** Subscribe to an event. */
  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  /** Unsubscribe from an event. */
  off<T>(event: string, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  /** Publish an event with a payload. */
  emit<T>(event: string, payload: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload as unknown);
      } catch (err) {
        console.error(`[EventEmitter] Error in handler for "${event}":`, err);
      }
    }
  }

  /**
   * Subscribe for a single invocation, then auto-unsubscribe.
   */
  once<T>(event: string, callback: EventCallback<T>): void {
    const wrapper: EventCallback<T> = (payload: T) => {
      callback(payload);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /** Remove all listeners (useful when tearing down components). */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
