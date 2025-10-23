/**
 * Self-cancellable async iterable stream
 *
 * Unlike standard async iterables, this includes a cancel() method
 * to stop the stream without requiring an external AbortController
 */
export interface CancellableStream<T> extends AsyncIterable<T> {
  /**
   * Cancel the stream and stop receiving chunks
   *
   * After calling cancel(), the stream will stop yielding values
   * and the for-await loop will exit cleanly
   */
  cancel(): void;

  /**
   * Whether the stream has been cancelled
   */
  readonly cancelled: boolean;
}
