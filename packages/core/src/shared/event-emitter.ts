/**
 * Generic event handler function type
 */
export type EventHandler<T = any> = (data: T) => void;

/**
 * Simple EventEmitter for Core API events
 *
 * Provides a lightweight publish-subscribe mechanism for reactive updates
 * from Core to UI layer without polling.
 */
export class EventEmitter {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event
   *
   * @param event - Event name to listen for
   * @param handler - Callback function to invoke when event fires
   */
  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from an event
   *
   * @param event - Event name to stop listening to
   * @param handler - Specific handler function to remove
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   *
   * @param event - Event name to fire
   * @param data - Data payload to pass to handlers
   */
  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          // Prevent one handler's error from stopping others
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event or all events
   *
   * @param event - Optional event name. If not provided, clears all listeners.
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   *
   * @param event - Event name to check
   * @returns Number of registered handlers
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
