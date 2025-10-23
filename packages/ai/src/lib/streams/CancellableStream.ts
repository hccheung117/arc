import type { CancellableStream as ICancellableStream } from '@arc/contracts/ai/Streams.js';

/**
 * Implementation of a self-cancellable async iterable stream
 *
 * Wraps an async iterable and adds cancellation support
 */
export class CancellableStream<T> implements ICancellableStream<T> {
  private _cancelled = false;
  private abortController: AbortController;

  constructor(
    private source: AsyncIterable<T>,
    abortController?: AbortController
  ) {
    this.abortController = abortController || new AbortController();
  }

  /**
   * Cancel the stream
   */
  cancel(): void {
    if (!this._cancelled) {
      this._cancelled = true;
      this.abortController.abort();
    }
  }

  /**
   * Whether the stream has been cancelled
   */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /**
   * Async iterator implementation
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    try {
      for await (const item of this.source) {
        if (this._cancelled) {
          return;
        }
        yield item;
      }
    } catch (error) {
      // If cancelled, don't propagate the abort error
      if (this._cancelled && this.isAbortError(error)) {
        return;
      }
      throw error;
    }
  }

  /**
   * Check if an error is an abort error
   */
  private isAbortError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('aborted'))
    );
  }
}

/**
 * Create a cancellable stream from an async generator function
 *
 * @param generator - Function that creates an async iterable
 * @returns A cancellable stream
 */
export function createCancellableStream<T>(
  generator: (signal: AbortSignal) => AsyncIterable<T>
): ICancellableStream<T> {
  const abortController = new AbortController();
  const source = generator(abortController.signal);
  return new CancellableStream(source, abortController);
}
