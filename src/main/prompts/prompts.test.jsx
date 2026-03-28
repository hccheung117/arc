import { describe, test, expect } from 'vitest'
import { buildSystemPrompt } from './system.jsx'
import { renderWorkspaceFiles, renderActiveSkill } from './augment.jsx'
import { SYSTEM_REFINE, SYSTEM_TITLE, renderPromptTag, renderTitleTag } from './assist.jsx'

describe('buildSystemPrompt', () => {
  test('includes system text', () => {
    const result = buildSystemPrompt('You are helpful.', [])
    expect(result).toContain('You are helpful.')
  })

  test('includes session_workspace and session_tmp tags', () => {
    const result = buildSystemPrompt(null, [])
    expect(result).toContain('<session_workspace path="$WORKSPACE">')
    expect(result).toContain('</session_workspace>')
    expect(result).toContain('<session_tmp path="$SESSION_TMP">')
    expect(result).toContain('</session_tmp>')
  })

  test('includes workspace instructions', () => {
    const result = buildSystemPrompt(null, [])
    expect(result).toContain('Your working directory for user-facing deliverables')
    expect(result).toContain('should be stored in $WORKSPACE')
    expect(result).toContain('Your scratch space for intermediate and in-progress files')
  })

  test('omits available_skills when no skills', () => {
    const result = buildSystemPrompt(null, [])
    expect(result).not.toContain('<available_skills>')
  })

  test('includes available_skills with skill entries', () => {
    const skills = [
      { name: 'code-review', description: 'Reviews code for quality' },
      { name: 'test-gen', description: 'Generates tests' },
    ]
    const result = buildSystemPrompt('System.', skills)
    expect(result).toContain('<available_skills>')
    expect(result).toContain('</available_skills>')
    expect(result).toContain('<skill name="code-review" path="$CODE_REVIEW_SKILL_DIR">')
    expect(result).toContain('Reviews code for quality')
    expect(result).toContain('<skill name="test-gen" path="$TEST_GEN_SKILL_DIR">')
    expect(result).toContain('Generates tests')
    expect(result).toContain('Proactively load a skill')
  })

  test('sections separated by double newline', () => {
    const result = buildSystemPrompt('System.', [{ name: 'foo', description: 'bar' }])
    expect(result).toContain('System.\n\n<available_skills>')
    expect(result).toContain('</available_skills>\n\n<session_workspace')
    expect(result).toContain('</session_workspace>\n\n<session_tmp')
  })

  test('handles null system text', () => {
    const result = buildSystemPrompt(null, [])
    expect(result).toContain('<session_workspace')
    expect(result).not.toContain('null')
  })
})

describe('renderWorkspaceFiles', () => {
  test('wraps paths in global_workspace_files tag', () => {
    const result = renderWorkspaceFiles(['/path/to/file.js', '/other/file.py'])
    expect(result).toContain('<global_workspace_files>')
    expect(result).toContain('</global_workspace_files>')
    expect(result).toContain('- /path/to/file.js')
    expect(result).toContain('- /other/file.py')
    expect(result).toContain('Use the `read_file` tool to access their live contents')
  })
})

describe('renderActiveSkill', () => {
  test('wraps body in active_skill tag with name and path', () => {
    const result = renderActiveSkill('code-review', 'Review this code.', 'CODE_REVIEW_SKILL_DIR')
    expect(result).toContain('<active_skill name="code-review" path="$CODE_REVIEW_SKILL_DIR">')
    expect(result).toContain('Review this code.')
    expect(result).toContain('</active_skill>')
  })

  test('omits path attribute when env is falsy', () => {
    const result = renderActiveSkill('foo', 'body', null)
    expect(result).toContain('<active_skill name="foo">')
    expect(result).not.toContain('path=')
  })
})

describe('assist prompts', () => {
  test('SYSTEM_REFINE is a string', () => {
    expect(typeof SYSTEM_REFINE).toBe('string')
    expect(SYSTEM_REFINE).toContain('Improve the following system prompt')
  })

  test('SYSTEM_TITLE is a string', () => {
    expect(typeof SYSTEM_TITLE).toBe('string')
    expect(SYSTEM_TITLE).toContain('short Title Case title')
  })

  test('renderPromptTag wraps text in prompt tag', () => {
    const result = renderPromptTag('Be concise.')
    expect(result).toContain('<prompt>')
    expect(result).toContain('Be concise.')
    expect(result).toContain('</prompt>')
  })

  test('renderTitleTag wraps text in first_user_message tag', () => {
    const result = renderTitleTag('Hello world')
    expect(result).toContain('<first_user_message>')
    expect(result).toContain('Hello world')
    expect(result).toContain('</first_user_message>')
  })
})
