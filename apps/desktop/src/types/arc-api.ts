/**
 * ArcAPI Type Definitions
 *
 * This file defines the contract for window.arc, the new IPC surface
 * exposed via contextBridge. It demonstrates the 3 canonical IPC patterns:
 *
 * - Rule 1 (One-Way): Renderer → Main, fire-and-forget
 * - Rule 2 (Two-Way): Renderer → Main with response
 * - Rule 3 (Push): Main → Renderer event subscription
 */

/** Response from the echo demo (Rule 2: Two-Way) */
export interface EchoResponse {
  original: string
  uppercased: string
  timestamp: number
}

/** Data pushed from main process (Rule 3: Push) */
export interface PongEvent {
  message: string
  sentAt: number
  receivedAt: number
}

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void

/**
 * ArcAPI - The new IPC surface for renderer process
 *
 * Accessed via window.arc in the renderer.
 */
export interface ArcAPI {
  /**
   * Rule 1: One-Way (Renderer → Main)
   * Fire-and-forget log message to main process console.
   */
  log: (message: string) => void

  /**
   * Rule 2: Two-Way (Renderer → Main with Response)
   * Sends a message and receives a transformed response.
   */
  echo: (message: string) => Promise<EchoResponse>

  /**
   * Rule 1: One-Way (Renderer → Main)
   * Triggers a delayed pong event from main process.
   */
  ping: () => void

  /**
   * Rule 3: Push (Main → Renderer)
   * Subscribe to pong events pushed from main process.
   * Returns an unsubscribe function for cleanup.
   */
  onPong: (callback: (event: PongEvent) => void) => Unsubscribe
}

declare global {
  interface Window {
    arc: ArcAPI
  }
}
