import { describe, test, expect, vi } from 'vitest'

vi.mock('../arcfs.js', () => ({
  resolve: () => '/tmp/arcfs',
  readMarkdown: vi.fn(),
  toUrl: (...segs) => `arcfs://${segs.join('/')}`,
  fromUrl: (url) => url.replace('arcfs://', '/tmp/arcfs/'),
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

vi.mock('fs', () => ({}))

const { runAgent } = await import('./subagent.js')

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
