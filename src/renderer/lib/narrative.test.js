import { describe, test, expect } from 'vitest'
import { narrativeFromParts } from './narrative.js'

const msg = (parts) => ({ parts })

describe('narrativeFromParts', () => {
  test('empty parts → empty narrative', () => {
    expect(narrativeFromParts(msg([]))).toEqual([])
  })

  test('text-only message → empty narrative (text is final response)', () => {
    expect(narrativeFromParts(msg([
      { type: 'text', text: 'Hello world' },
    ]))).toEqual([])
  })

  test('reasoning then text → reasoning in narrative', () => {
    const result = narrativeFromParts(msg([
      { type: 'reasoning', text: 'Let me think...' },
      { type: 'text', text: 'Here is my answer' },
    ]))
    expect(result).toEqual([
      { type: 'reasoning', text: 'Let me think...' },
    ])
  })

  test('reasoning only (streaming, no text yet) → reasoning in narrative', () => {
    const result = narrativeFromParts(msg([
      { type: 'reasoning', text: 'Thinking...' },
    ]))
    expect(result).toEqual([
      { type: 'reasoning', text: 'Thinking...' },
    ])
  })

  test('tool calls preserve output field', () => {
    const result = narrativeFromParts(msg([
      { type: 'tool-read_file', toolCallId: 'tc1', state: 'output-available', input: { path: '/foo' }, output: 'contents' },
      { type: 'text', text: 'Done' },
    ]))
    expect(result).toEqual([
      { type: 'tool', toolCallId: 'tc1', toolName: 'read_file', state: 'output-available', input: { path: '/foo' }, output: 'contents', hasResult: true },
    ])
  })

  test('interleaved reasoning + tools in order', () => {
    const result = narrativeFromParts(msg([
      { type: 'reasoning', text: 'First thought' },
      { type: 'tool-read_file', toolCallId: 'tc1', state: 'output-available', input: {}, output: 'x' },
      { type: 'text', text: 'Let me check' },
      { type: 'reasoning', text: 'Second thought' },
      { type: 'tool-edit_file', toolCallId: 'tc2', state: 'output-available', input: {}, output: 'y' },
      { type: 'text', text: 'Final answer' },
    ]))
    expect(result).toEqual([
      { type: 'reasoning', text: 'First thought' },
      { type: 'tool', toolCallId: 'tc1', toolName: 'read_file', state: 'output-available', input: {}, output: 'x', hasResult: true },
      { type: 'interstitial-text', text: 'Let me check' },
      { type: 'reasoning', text: 'Second thought' },
      { type: 'tool', toolCallId: 'tc2', toolName: 'edit_file', state: 'output-available', input: {}, output: 'y', hasResult: true },
    ])
  })

  test('tool without result yet → hasResult false', () => {
    const result = narrativeFromParts(msg([
      { type: 'tool-browser', toolCallId: 'tc1', state: 'call', input: { command: 'screenshot' } },
    ]))
    expect(result).toEqual([
      { type: 'tool', toolCallId: 'tc1', toolName: 'browser', state: 'call', input: { command: 'screenshot' }, output: undefined, hasResult: false },
    ])
  })

  test('step-start parts are skipped', () => {
    const result = narrativeFromParts(msg([
      { type: 'step-start' },
      { type: 'reasoning', text: 'think' },
      { type: 'step-start' },
      { type: 'tool-read_file', toolCallId: 'tc1', state: 'output-available', input: {}, output: 'x' },
      { type: 'text', text: 'answer' },
    ]))
    expect(result).toEqual([
      { type: 'reasoning', text: 'think' },
      { type: 'tool', toolCallId: 'tc1', toolName: 'read_file', state: 'output-available', input: {}, output: 'x', hasResult: true },
    ])
  })

  test('blank text parts are excluded from narrative', () => {
    const result = narrativeFromParts(msg([
      { type: 'text', text: '   ' },
      { type: 'tool-read_file', toolCallId: 'tc1', state: 'output-available', input: {}, output: 'x' },
      { type: 'text', text: 'answer' },
    ]))
    expect(result).toEqual([
      { type: 'tool', toolCallId: 'tc1', toolName: 'read_file', state: 'output-available', input: {}, output: 'x', hasResult: true },
    ])
  })

  test('tool with output-error → hasResult true and state preserved', () => {
    const result = narrativeFromParts(msg([
      { type: 'tool-read_file', toolCallId: 'tc1', state: 'output-error', input: { path: '/foo' }, output: 'Error: file not found' },
      { type: 'text', text: 'Sorry' },
    ]))
    expect(result[0].hasResult).toBe(true)
    expect(result[0].state).toBe('output-error')
  })

  test('tool with output-denied → hasResult true and state preserved', () => {
    const result = narrativeFromParts(msg([
      { type: 'tool-edit_file', toolCallId: 'tc1', state: 'output-denied', input: {}, output: undefined },
      { type: 'text', text: 'Okay' },
    ]))
    expect(result[0].hasResult).toBe(true)
    expect(result[0].state).toBe('output-denied')
  })

  test('tool with output-available → state preserved', () => {
    const result = narrativeFromParts(msg([
      { type: 'tool-read_file', toolCallId: 'tc1', state: 'output-available', input: { path: '/foo' }, output: 'contents' },
      { type: 'text', text: 'Done' },
    ]))
    expect(result[0].state).toBe('output-available')
  })

  test('in-progress tool call → state preserved', () => {
    const result = narrativeFromParts(msg([
      { type: 'tool-browser', toolCallId: 'tc1', state: 'call', input: { command: 'screenshot' } },
    ]))
    expect(result[0].state).toBe('call')
  })

  test('dynamic-tool uses toolName field', () => {
    const result = narrativeFromParts(msg([
      { type: 'dynamic-tool', toolName: 'custom_tool', toolCallId: 'tc1', state: 'output-available', input: {}, output: 'r' },
      { type: 'text', text: 'done' },
    ]))
    expect(result[0].toolName).toBe('custom_tool')
  })
})
