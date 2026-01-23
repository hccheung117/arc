/**
 * Kernel Boot Test
 *
 * Demonstrates the complete kernel boot flow:
 * 1. Module registration with adapters
 * 2. Dependency resolution
 * 3. Module instantiation in order
 * 4. IPC handler registration
 */

// eslint-disable-next-line import-x/no-unresolved
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IpcMain } from 'electron'
import { createKernel } from './boot'
import type { FoundationCapabilities } from './module'
import { defineModule, defineCapability } from './module'

describe('createKernel', () => {
  let mockIpcMain: Pick<IpcMain, 'handle'>
  let mockFoundation: FoundationCapabilities
  const mockDataDir = '/tmp/test-data'

  beforeEach(() => {
    mockIpcMain = {
      handle: vi.fn(),
    }

    mockFoundation = {
      jsonFile: vi.fn(() => ({ create: vi.fn() })),
      jsonLog: vi.fn(() => ({ create: vi.fn() })),
      archive: vi.fn(() => ({ extract: vi.fn(), write: vi.fn(), readEntry: vi.fn(), listDirectory: vi.fn(), hasEntry: vi.fn() })),
      glob: { matches: vi.fn() },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as unknown as FoundationCapabilities
  })

  it('should register and boot modules in dependency order', () => {
    const kernel = createKernel({
      ipcMain: mockIpcMain,
      dataDir: mockDataDir,
      foundation: mockFoundation,
    })

    // Define module A (no dependencies)
    const moduleA = defineModule({
      capabilities: [] as const,
      depends: [] as const,
      provides: () => ({
        getValue: () => 'A',
      }),
      emits: [] as const,
      paths: [],
    })

    // Define module B (depends on A)
    const moduleB = defineModule({
      capabilities: [] as const,
      depends: ['a'] as const,
      provides: (deps) => ({
        getValue: () => `B-${(deps.a as { getValue: () => string }).getValue()}`,
      }),
      emits: [] as const,
      paths: [],
    })

    kernel.register('a', moduleA)
    kernel.register('b', moduleB)
    kernel.boot()

    // Verify module B can access module A's API
    const apiB = kernel.getModule<{ getValue: () => string }>('b')
    expect(apiB?.getValue()).toBe('B-A')
  })

  it('should register IPC handlers for all module operations', () => {
    const kernel = createKernel({
      ipcMain: mockIpcMain,
      dataDir: mockDataDir,
      foundation: mockFoundation,
    })

    const module = defineModule({
      capabilities: [] as const,
      depends: [] as const,
      provides: () => ({
        list: () => ['item1', 'item2'],
        create: (data: unknown) => data,
      }),
      emits: [] as const,
      paths: [],
    })

    kernel.register('test', module)
    kernel.boot()

    // Verify IPC handlers registered with correct channel names
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'arc:test:list',
      expect.any(Function)
    )
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      'arc:test:create',
      expect.any(Function)
    )
  })

  it('should inject adapted capabilities when adapters are provided', () => {
    const kernel = createKernel({
      ipcMain: mockIpcMain,
      dataDir: mockDataDir,
      foundation: mockFoundation,
    })

    type AdaptedJsonFile = { loadData: () => string }
    const adapter = defineCapability(() => ({
      loadData: () => 'adapted-data',
    }))

    const module = defineModule({
      capabilities: ['jsonFile'] as const,
      depends: [] as const,
      provides: (_, caps) => ({
        getData: () => (caps.jsonFile as AdaptedJsonFile).loadData(),
      }),
      emits: [] as const,
      paths: [],
    })

    kernel.register('test', module, { jsonFile: adapter })
    kernel.boot()

    const api = kernel.getModule<{ getData: () => string }>('test')
    expect(api?.getData()).toBe('adapted-data')
  })

  it('should throw on missing dependency', () => {
    const kernel = createKernel({
      ipcMain: mockIpcMain,
      dataDir: mockDataDir,
      foundation: mockFoundation,
    })

    const module = defineModule({
      capabilities: [] as const,
      depends: ['missing'] as const,
      provides: () => ({}),
      emits: [] as const,
      paths: [],
    })

    kernel.register('test', module)

    expect(() => kernel.boot()).toThrow('depends on unknown "missing"')
  })
})
