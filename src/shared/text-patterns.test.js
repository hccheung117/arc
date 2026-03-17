import { describe, test, expect } from 'vitest'
import { quotePath, unquotePath, extractFileRefs, extractSkillRefs, FILE_REF, SKILL_REF } from './text-patterns.js'

describe('quotePath', () => {
  test('bare path unchanged', () => {
    expect(quotePath('/Users/me/file.txt')).toBe('/Users/me/file.txt')
  })
  test('path with spaces gets quoted', () => {
    expect(quotePath('/Users/me/My Documents/file.txt')).toBe('"/Users/me/My Documents/file.txt"')
  })
  test('path with quotes and spaces gets escaped', () => {
    expect(quotePath('/tmp/file "name".txt')).toBe('"/tmp/file \\"name\\".txt"')
  })
  test('path with backslash and spaces gets escaped', () => {
    expect(quotePath('/tmp/back\\slash dir/f.txt')).toBe('"/tmp/back\\\\slash dir/f.txt"')
  })
})

describe('unquotePath', () => {
  test('strips backslash escapes', () => {
    expect(unquotePath('file \\"name\\".txt')).toBe('file "name".txt')
  })
  test('plain string unchanged', () => {
    expect(unquotePath('file.txt')).toBe('file.txt')
  })
})

describe('extractFileRefs', () => {
  test('bare arcfs path', () => {
    const refs = extractFileRefs('Look at @arcfs://tmp/x7k2.png please')
    expect(refs).toEqual([{ path: 'arcfs://tmp/x7k2.png', start: 8, end: 29 }])
  })
  test('bare absolute path', () => {
    const refs = extractFileRefs('@/Users/me/file.txt')
    expect(refs).toEqual([{ path: '/Users/me/file.txt', start: 0, end: 19 }])
  })
  test('bare relative paths', () => {
    const refs = extractFileRefs('@./src/main.js and @../lib/x.js')
    expect(refs).toHaveLength(2)
    expect(refs[0].path).toBe('./src/main.js')
    expect(refs[1].path).toBe('../lib/x.js')
  })
  test('bare home path', () => {
    const refs = extractFileRefs('@~/docs/notes.md')
    expect(refs).toEqual([{ path: '~/docs/notes.md', start: 0, end: 16 }])
  })
  test('quoted path with spaces', () => {
    const refs = extractFileRefs('@"/Users/me/My Documents/report.pdf"')
    expect(refs).toEqual([{ path: '/Users/me/My Documents/report.pdf', start: 0, end: 36 }])
  })
  test('quoted path with escaped quotes', () => {
    const refs = extractFileRefs('@"/tmp/file \\"name\\".txt"')
    expect(refs).toEqual([{ path: '/tmp/file "name".txt', start: 0, end: 25 }])
  })
  test('multiple refs in one string', () => {
    const refs = extractFileRefs('/code-review @arcfs://a.png @./b.js')
    expect(refs).toHaveLength(2)
  })
  test('no refs returns empty', () => {
    expect(extractFileRefs('just text')).toEqual([])
  })
  test('agent mention @reviewer not matched', () => {
    expect(extractFileRefs('@reviewer')).toEqual([])
  })
})

describe('extractSkillRefs', () => {
  const skills = ['code-review', 'summarize', 'translate']

  test('detects skill at start of text', () => {
    const refs = extractSkillRefs('/code-review refactor auth', skills)
    expect(refs).toEqual([{ name: 'code-review', start: 0, end: 12 }])
  })

  test('detects skill mid-text', () => {
    const refs = extractSkillRefs('please /summarize this', skills)
    expect(refs).toEqual([{ name: 'summarize', start: 7, end: 17 }])
  })

  test('detects multiple skills', () => {
    const refs = extractSkillRefs('/summarize and /translate this', skills)
    expect(refs).toHaveLength(2)
    expect(refs[0].name).toBe('summarize')
    expect(refs[1].name).toBe('translate')
  })

  test('no match for unknown skill', () => {
    expect(extractSkillRefs('/unknown do something', skills)).toEqual([])
  })

  test('no match for plain text', () => {
    expect(extractSkillRefs('just some text', skills)).toEqual([])
  })

  test('full token match — no prefix confusion', () => {
    expect(extractSkillRefs('/code-review-extended something', skills)).toEqual([])
  })

  test('slash mid-word not matched', () => {
    expect(extractSkillRefs('http://summarize.com', skills)).toEqual([])
  })
})
