/**
 * Message streaming utility
 *
 * Manages AbortController lifecycle for in-progress streaming operations.
 * This allows messages to be stopped mid-stream.
 */
export class MessageStreamer {
  private activeStreams = new Map<string, AbortController>();

  /**
   * Create and register an AbortController for a message
   *
   * @param messageId - ID of the message being streamed
   * @returns AbortSignal to pass to the provider
   */
  startStreaming(messageId: string): AbortSignal {
    const controller = new AbortController();
    this.activeStreams.set(messageId, controller);
    return controller.signal;
  }

  /**
   * Stop streaming for a specific message
   *
   * @param messageId - ID of the message to stop
   * @returns true if a stream was stopped, false if no active stream
   */
  stopStreaming(messageId: string): boolean {
    const controller = this.activeStreams.get(messageId);
    if (!controller) {
      return false;
    }

    controller.abort();
    this.activeStreams.delete(messageId);
    return true;
  }

  /**
   * Complete streaming for a message (cleanup)
   *
   * Call this when streaming completes successfully or with an error.
   */
  completeStreaming(messageId: string): void {
    this.activeStreams.delete(messageId);
  }

  /**
   * Check if a message is currently streaming
   */
  isStreaming(messageId: string): boolean {
    return this.activeStreams.has(messageId);
  }

  /**
   * Stop all active streams
   *
   * Useful for cleanup when shutting down.
   */
  stopAll(): void {
    for (const controller of this.activeStreams.values()) {
      controller.abort();
    }
    this.activeStreams.clear();
  }
}
