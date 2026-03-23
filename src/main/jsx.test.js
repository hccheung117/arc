import { describe, test, expect } from 'vitest'
import { h, Fragment } from './jsx.js'

describe('h', () => {
  test('intrinsic element with text content', () => {
    const result = h('foo', null, 'hello')
    expect(result).toBe('<foo>\nhello\n</foo>')
  })

  test('intrinsic element with attributes', () => {
    const result = h('foo', { bar: 'baz', qux: 42 }, 'content')
    expect(result).toBe('<foo bar="baz" qux="42">\ncontent\n</foo>')
  })

  test('intrinsic element filters null/undefined attributes', () => {
    const result = h('foo', { bar: 'baz', qux: null, nope: undefined }, 'content')
    expect(result).toBe('<foo bar="baz">\ncontent\n</foo>')
  })

  test('intrinsic element self-closes when no children', () => {
    const result = h('foo', { bar: 'baz' })
    expect(result).toBe('<foo bar="baz" />')
  })

  test('intrinsic element joins children with newline', () => {
    const result = h('list', null, '- a', '- b', '- c')
    expect(result).toBe('<list>\n- a\n- b\n- c\n</list>')
  })

  test('filters out null, undefined, false, true children', () => {
    const result = h('foo', null, 'a', null, false, true, undefined, 'b')
    expect(result).toBe('<foo>\na\nb\n</foo>')
  })

  test('flattens nested arrays of children', () => {
    const result = h('foo', null, ['a', 'b'], 'c')
    expect(result).toBe('<foo>\na\nb\nc\n</foo>')
  })

  test('function tag calls the function with props and children', () => {
    const Comp = ({ name, children }) => h('custom', { name }, children)
    const result = h(Comp, { name: 'test' }, 'body')
    expect(result).toBe('<custom name="test">\nbody\n</custom>')
  })

  test('no props passed as null', () => {
    const result = h('foo', null, 'bar')
    expect(result).toBe('<foo>\nbar\n</foo>')
  })
})

describe('Fragment', () => {
  test('joins children with double newline', () => {
    const result = Fragment({ children: ['section one', 'section two'] })
    expect(result).toBe('section one\n\nsection two')
  })

  test('filters falsy children', () => {
    const result = Fragment({ children: ['a', null, false, '', 'b'] })
    expect(result).toBe('a\n\nb')
  })

  test('handles single child', () => {
    const result = Fragment({ children: 'only' })
    expect(result).toBe('only')
  })
})
