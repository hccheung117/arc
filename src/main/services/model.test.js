import { describe, test, expect, vi } from 'vitest'

vi.mock('../arcfs.js', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
}))

const { filterModels } = await import('./model.js')

const m = (id) => ({ id, name: id })

describe('filterModels — add verb', () => {
  test('appends models to empty list', () => {
    const result = filterModels([], [{ add: ['a', 'b'] }])
    expect(result).toEqual([m('a'), m('b')])
  })

  test('appends models to existing list', () => {
    const result = filterModels([m('x')], [{ add: ['a'] }])
    expect(result).toEqual([m('x'), m('a')])
  })

  test('skips duplicates already in list', () => {
    const result = filterModels([m('a')], [{ add: ['a', 'b'] }])
    expect(result).toEqual([m('a'), m('b')])
  })

  test('added models subject to later drop', () => {
    const result = filterModels([], [
      { add: ['keep-me', 'drop-me'] },
      { drop: ['drop-*'] },
    ])
    expect(result).toEqual([m('keep-me')])
  })

  test('keep [] then add builds manual-only list', () => {
    const result = filterModels([m('api-model')], [
      { keep: [] },
      { add: ['manual-a', 'manual-b'] },
    ])
    expect(result).toEqual([m('manual-a'), m('manual-b')])
  })
})
