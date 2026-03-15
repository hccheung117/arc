import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Node } from '@tiptap/core'

export const SkillMention = Node.create({
  name: 'skillMention',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-name'),
        renderHTML: (attrs) => ({ 'data-name': attrs.name }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="skill-mention"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': 'skill-mention',
        class: 'text-purple-600',
      },
      `/${node.attrs.name}`,
    ]
  },

  renderText({ node }) {
    return `/${node.attrs.name}`
  },
})

export const createExtensions = (placeholder, skillMention = SkillMention) => [
  StarterKit,
  Placeholder.configure({ placeholder }),
  skillMention,
]
