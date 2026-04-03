import { describe, test, expect } from 'vitest'
import { addUnread, clearUnread } from './unread.js'

describe('unread state', () => {
  describe('addUnread', () => {
    test('adds session to unread set when not the active session', () => {
      const prev = new Set()
      const next = addUnread(prev, 'session-2', 'session-1')
      expect(next.has('session-2')).toBe(true)
    })

    test('ignores responded event for the active session', () => {
      const prev = new Set()
      const next = addUnread(prev, 'session-1', 'session-1')
      expect(next).toBe(prev) // same reference — no change
    })

    test('accumulates multiple unread sessions', () => {
      let state = new Set()
      state = addUnread(state, 'session-2', 'session-1')
      state = addUnread(state, 'session-3', 'session-1')
      expect([...state]).toEqual(['session-2', 'session-3'])
    })

    test('returns same reference if session already unread', () => {
      const prev = new Set(['session-2'])
      const next = addUnread(prev, 'session-2', 'session-1')
      expect(next).toBe(prev)
    })
  })

  describe('clearUnread', () => {
    test('removes activated session from unread set', () => {
      const prev = new Set(['session-2', 'session-3'])
      const next = clearUnread(prev, 'session-2')
      expect(next.has('session-2')).toBe(false)
      expect(next.has('session-3')).toBe(true)
    })

    test('returns same reference if session was not unread', () => {
      const prev = new Set(['session-2'])
      const next = clearUnread(prev, 'session-1')
      expect(next).toBe(prev)
    })
  })
})
