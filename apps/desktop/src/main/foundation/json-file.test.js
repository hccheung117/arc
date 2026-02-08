import { describe, it, expect } from 'vitest'
import { createJsonFile } from './json-file'

describe('createJsonFile path validation', () => {
  const dataDir = '/tmp/test-arcfs'

  it('allows exact file match', () => {
    const scoped = createJsonFile(dataDir, ['app/settings.json'])
    // create() should not throw for the declared path
    const file = scoped.create('app/settings.json', {}, { parse: (v) => v })
    expect(file).toBeDefined()
  })

  it('denies access to undeclared file', () => {
    const scoped = createJsonFile(dataDir, ['app/settings.json'])
    expect(() => scoped.create('app/other.json', {}, { parse: (v) => v }))
      .toThrow('Path access denied')
  })

  it('allows paths within declared directory', () => {
    const scoped = createJsonFile(dataDir, ['profiles/'])
    const file = scoped.create('profiles/myprofile/arc.json', {}, { parse: (v) => v })
    expect(file).toBeDefined()
  })

  it('denies access outside declared directory', () => {
    const scoped = createJsonFile(dataDir, ['profiles/'])
    expect(() => scoped.create('app/settings.json', {}, { parse: (v) => v }))
      .toThrow('Path access denied')
  })

  it('allows access with multiple allowed paths', () => {
    const scoped = createJsonFile(dataDir, ['profiles/', 'app/settings.json'])
    // Directory scope
    const file1 = scoped.create('profiles/x/y.json', {}, { parse: (v) => v })
    expect(file1).toBeDefined()
    // File scope
    const file2 = scoped.create('app/settings.json', {}, { parse: (v) => v })
    expect(file2).toBeDefined()
  })

  it('denies all paths when allowedPaths is empty', () => {
    const scoped = createJsonFile(dataDir, [])
    expect(() => scoped.create('anything.json', {}, { parse: (v) => v }))
      .toThrow('Path access denied')
  })

  it('blocks path traversal attempts', () => {
    const scoped = createJsonFile(dataDir, ['app/'])
    expect(() => scoped.create('app/../profiles/secret.json', {}, { parse: (v) => v }))
      .toThrow('Path access denied')
  })

  it('allows access to declared directory itself', () => {
    const scoped = createJsonFile(dataDir, ['profiles/'])
    // Accessing the directory path itself should be allowed
    const file = scoped.create('profiles', {}, { parse: (v) => v })
    expect(file).toBeDefined()
  })

  it('denies directory name prefix bypass', () => {
    const scoped = createJsonFile(dataDir, ['profiles/'])
    // 'profiles2/' must NOT be accessible when only 'profiles/' is allowed
    expect(() => scoped.create('profiles2/secret.json', {}, { parse: (v) => v }))
      .toThrow('Path access denied')
  })

  it('denies absolute path escape', () => {
    const scoped = createJsonFile(dataDir, ['app/'])
    expect(() => scoped.create('/etc/passwd', {}, { parse: (v) => v }))
      .toThrow('Path access denied')
  })
})
