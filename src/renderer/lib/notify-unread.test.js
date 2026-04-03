import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { scheduleNotification, cancelAllPending, fireNotification } from './notify-unread.js'

beforeEach(() => {
  vi.useFakeTimers()
  globalThis.Notification = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
  delete globalThis.Notification
})

const sessions = [
  { id: 'chat-1', title: 'My Chat' },
  { id: 'chat-2', title: 'Another Chat' },
]

describe('fireNotification', () => {
  test('creates a Notification with the chat title', () => {
    const onActivate = vi.fn()
    fireNotification('chat-1', sessions, onActivate)

    expect(Notification).toHaveBeenCalledWith('My Chat', { body: 'New reply available' })
  })

  test('skips notification if session not found', () => {
    const onActivate = vi.fn()
    fireNotification('deleted-chat', sessions, onActivate)

    expect(Notification).not.toHaveBeenCalled()
  })

  test('activates session on notification click', () => {
    const onActivate = vi.fn()
    fireNotification('chat-1', sessions, onActivate)

    const notification = Notification.mock.instances[0]
    notification.onclick()

    expect(onActivate).toHaveBeenCalledWith('chat-1')
  })
})

describe('scheduleNotification', () => {
  test('fires notification after 3 seconds', () => {
    const pending = new Map()
    const onActivate = vi.fn()

    scheduleNotification(pending, 'chat-1', sessions, onActivate)

    expect(Notification).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(Notification).toHaveBeenCalledWith('My Chat', { body: 'New reply available' })
  })

  test('stores timeout id in pending map', () => {
    const pending = new Map()
    const onActivate = vi.fn()

    scheduleNotification(pending, 'chat-1', sessions, onActivate)

    expect(pending.has('chat-1')).toBe(true)
  })

  test('clears entry from pending map after firing', () => {
    const pending = new Map()
    const onActivate = vi.fn()

    scheduleNotification(pending, 'chat-1', sessions, onActivate)
    vi.advanceTimersByTime(3000)

    expect(pending.has('chat-1')).toBe(false)
  })

  test('replaces existing timer for same session', () => {
    const pending = new Map()
    const onActivate = vi.fn()

    scheduleNotification(pending, 'chat-1', sessions, onActivate)
    const firstTimerId = pending.get('chat-1')

    scheduleNotification(pending, 'chat-1', sessions, onActivate)
    const secondTimerId = pending.get('chat-1')

    expect(secondTimerId).not.toBe(firstTimerId)

    vi.advanceTimersByTime(3000)
    // Should only fire once (second timer), not twice
    expect(Notification).toHaveBeenCalledTimes(1)
  })
})

describe('cancelAllPending', () => {
  test('clears all pending timers', () => {
    const pending = new Map()
    const onActivate = vi.fn()

    scheduleNotification(pending, 'chat-1', sessions, onActivate)
    scheduleNotification(pending, 'chat-2', sessions, onActivate)

    cancelAllPending(pending)

    expect(pending.size).toBe(0)

    vi.advanceTimersByTime(3000)
    expect(Notification).not.toHaveBeenCalled()
  })

  test('handles empty map gracefully', () => {
    const pending = new Map()
    expect(() => cancelAllPending(pending)).not.toThrow()
  })
})
