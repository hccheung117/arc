import { describe, test, expect, vi } from 'vitest'
import fs from 'node:fs/promises'

vi.mock('../arcfs.js', () => ({
  resolve: () => '/tmp/arcfs',
  readMarkdown: vi.fn(),
  toUrl: (...segs) => `arcfs://${segs.join('/')}`,
  fromUrl: (url) => url.replace('arcfs://', '/tmp/arcfs/'),
  builtinDir: () => '/tmp/builtin-agents',
}))

vi.mock('node:fs/promises', () => ({
  default: { readdir: vi.fn() },
}))

vi.mock('./profile.js', () => ({
  resolveDir: vi.fn(),
}))

const mockBuildSystemPrompt = vi.fn(() => 'system prompt')
vi.mock('../prompts/system.jsx', () => ({
  buildSystemPrompt: (...args) => mockBuildSystemPrompt(...args),
}))

const mockLlmStream = vi.fn()
vi.mock('./llm.js', () => ({
  stream: (...args) => mockLlmStream(...args),
}))

const { loadAgentContent } = await import('./subagent.js')


const { runAgent } = await import('./subagent.js')

describe('discoverAgents', () => {
  test('merges profile and builtin agents, profile wins on name conflict', async () => {
    const { resolveDir } = await import('./profile.js')
    const { readMarkdown } = await import('../arcfs.js')

    resolveDir.mockResolvedValue([
      { name: 'custom-agent', description: 'User agent', file: 'custom.md', directory: 'arcfs://agents', source: '@app' },
      { name: 'explore', description: 'User explore override', file: 'explore.md', directory: 'arcfs://agents', source: '@app' },
    ])

    fs.readdir.mockResolvedValue([
      { name: 'general-purpose.md', isFile: () => true },
      { name: 'explore.md', isFile: () => true },
    ])

    readMarkdown
      .mockResolvedValueOnce('---\nname: general-purpose\ndescription: General purpose agent\n---\nYou are a general purpose agent.')
      .mockResolvedValueOnce('---\nname: explore\ndescription: Explore agent\n---\nYou are an explore agent.')

    const { discoverAgents } = await import('./subagent.js')
    const agents = await discoverAgents()

    expect(agents.map(a => a.name)).toEqual(['custom-agent', 'explore', 'general-purpose'])
    expect(agents.find(a => a.name === 'general-purpose').source).toBe('@builtin')
    // profile's explore wins over builtin's explore
    expect(agents.find(a => a.name === 'explore').source).toBe('@app')
  })
})

describe('runAgent', () => {
  const agents = [{ name: 'reviewer', description: 'Reviews code', model: 'agent-model', file: 'reviewer.md', directory: 'arcfs://agents' }]
  const tools = {
    read_file: {},
    list_dir: {},
    write_file: {},
    edit_file: {},
    load_skill: {},
    run_file: {},
    browser: {},
    subagent: {},
  }

  test('passes messages with parts (not content) to llm.stream', async () => {
    const { readMarkdown } = await import('../arcfs.js')
    readMarkdown.mockResolvedValue('---\nname: reviewer\ndescription: Reviews code\nmodel: agent-model\n---\nYou are a code reviewer.')

    mockLlmStream.mockResolvedValue({ text: 'done' })

    await runAgent({
      name: 'reviewer',
      prompt: 'Review this code',
      agents,
      allSkills: [],
      provider: { type: 'anthropic' },
      modelId: 'default-model',
      tools,
    })

    const call = mockLlmStream.mock.calls[0][0]
    const msg = call.messages[0]
    expect(msg).toHaveProperty('parts')
    expect(msg.parts).toEqual([{ type: 'text', text: 'Review this code' }])
    // Must NOT have 'content' — resolveArcfsUrls expects 'parts'
    expect(msg).not.toHaveProperty('content')
  })
})
