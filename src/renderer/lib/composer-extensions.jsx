import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Fragment } from '@tiptap/pm/model'
import { Extension } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import HardBreak from '@tiptap/extension-hard-break'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import History from '@tiptap/extension-history'
import FileHandler from '@tiptap/extension-file-handler'
import Dropcursor from '@tiptap/extension-dropcursor'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../components/ui/hover-card'
import { quotePath, extractFileRefs, extractSkillRefs } from '../../shared/text-patterns.js'

// --- MentionView: NodeView component for both skill and file mentions ---

const MentionView = ({ node }) => {
  const isFile = node.attrs.mentionType === 'file'
  const label = isFile
    ? (node.attrs.label || node.attrs.url?.split('/').pop() || node.attrs.id)
    : `/${node.attrs.id}`

  if (!isFile) {
    return (
      <NodeViewWrapper as="span" data-type="mention" data-mention-type="skill" className="text-purple-600">
        {label}
      </NodeViewWrapper>
    )
  }

  const isImage = node.attrs.mediaType?.startsWith('image/')

  return (
    <NodeViewWrapper
      as="span"
      data-type="mention"
      data-mention-type="file"
      className="text-orange-600 bg-orange-50 dark:bg-orange-950 rounded px-1 cursor-pointer before:content-['@']"
    >
      <HoverCard openDelay={300} closeDelay={100}>
        <HoverCardTrigger asChild>
          <span onClick={() => window.api.call('message:open-file', { url: node.attrs.url })}>
            {label}
          </span>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-auto max-w-xs p-2">
          {isImage
            ? <img src={node.attrs.url} alt={label} className="max-w-[300px] rounded" />
            : (
              <div className="space-y-1 text-sm">
                <div className="font-medium">{node.attrs.filename || label}</div>
                {node.attrs.mediaType && <div className="text-muted-foreground">{node.attrs.mediaType}</div>}
                {node.attrs.url && <div className="text-muted-foreground text-xs break-all">{node.attrs.url}</div>}
              </div>
            )
          }
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  )
}

// --- uploadAndInsertFiles: upload via IPC → insert file mention at cursor ---

export const uploadAndInsertFiles = async (editor, files) => {
  for (const file of files) {
    let url, filename, mediaType

    const filePath = window.api.getFilePath(file)
    if (filePath) {
      // Local file: insert mention with real path, let backend handle strategy
      url = filePath
      filename = file.name
      mediaType = file.type
    } else {
      // In-memory blob (clipboard paste): upload to arcfs temp
      const payload = { data: await file.arrayBuffer(), filename: file.name, mediaType: file.type }
      ;({ url, filename, mediaType } = await window.api.call('message:upload-attachment', payload))
    }

    editor.chain().focus().insertContent([
      { type: 'mention', attrs: { id: url, label: filename, mentionType: 'file', url, filename, mediaType } },
      { type: 'text', text: ' ' },
    ]).run()
  }
}

// --- Extended Mention: adds custom attributes for skill/file differentiation ---
// The base Mention extension only defines id, label, mentionSuggestionChar.
// We need mentionType, url, filename, mediaType for file mentions.

const ExtendedMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mentionType: { default: null, parseHTML: el => el.getAttribute('data-mention-type') },
      url: { default: null },
      filename: { default: null },
      mediaType: { default: null },
    }
  },
  renderText({ node }) {
    if (node.attrs.mentionType === 'file') {
      return `@${quotePath(node.attrs.url || node.attrs.id)}`
    }
    return `/${node.attrs.id}`
  },
  renderHTML({ node, HTMLAttributes }) {
    const isFile = node.attrs.mentionType === 'file'
    const display = isFile
      ? (node.attrs.label || node.attrs.id.split('/').pop())
      : `/${node.attrs.id}`
    const cls = isFile
      ? 'text-orange-600 bg-orange-50 dark:bg-orange-950 rounded px-1'
      : 'text-purple-600'
    return ['span', {
      ...HTMLAttributes,
      'data-type': 'mention',
      'data-mention-type': isFile ? 'file' : 'skill',
      class: cls,
    }, display]
  },
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { $cursor } = editor.state.selection
        if (!$cursor) return false
        const nodeBefore = $cursor.nodeBefore
        if (nodeBefore?.type.name === 'mention') {
          editor.chain().focus().deleteRange({
            from: $cursor.pos - nodeBefore.nodeSize,
            to: $cursor.pos,
          }).run()
          return true
        }
        return false
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(MentionView, { as: 'span', className: 'inline' })
  },
})

// --- EditorStore: mutable storage bridge for React → extensions ---

const EditorStore = Extension.create({
  name: 'editorStore',
  addStorage() {
    return { skills: [], placeholder: '', onFilesPasted: null, suggestionActive: false, suggestionJustExited: false }
  },
})

// --- SubmitOnEnter: configurable submit keybinding ---

const SubmitOnEnter = Extension.create({
  name: 'submitOnEnter',
  addOptions() {
    return { submitKey: 'Enter' }
  },
  addKeyboardShortcuts() {
    const submit = ({ editor }) => {
      const el = editor.options.element
      const form = el.closest('form')
      if (!form) return false
      const btn = form.querySelector('button[type="submit"]')
      if (btn?.disabled) return true
      form.requestSubmit()
      return true
    }
    if (this.options.submitKey === 'Shift-Enter') {
      return { 'Shift-Enter': submit }
    }
    return { Enter: submit }
  },
})

// --- AutoMention: auto-converts typed text patterns to mention nodes ---

const AutoMention = Extension.create({
  name: 'autoMention',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('autoMention'),
        appendTransaction(transactions, oldState, newState) {
          const store = editor.storage.editorStore
          if (store?.suggestionActive) return null

          if (store?.suggestionJustExited) store.suggestionJustExited = false

          const knownSkills = (store?.skills ?? []).map(s => s.name)
          const allMarkers = []

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'text') return

            for (const r of extractSkillRefs(node.text, knownSkills)) {
              allMarkers.push({ ...r, type: 'skill', from: pos + r.start, to: pos + r.end })
            }
            for (const r of extractFileRefs(node.text)) {
              allMarkers.push({ ...r, type: 'file', from: pos + r.start, to: pos + r.end })
            }
          })

          // Skip markers the cursor is still inside — user may still be typing
          const head = newState.selection.head
          const actionable = allMarkers.filter(m => head <= m.from || head > m.to)

          if (!actionable.length) return null

          actionable.sort((a, b) => b.from - a.from)
          const tr = newState.tr

          for (const marker of actionable) {
            const mentionNode = marker.type === 'skill'
              ? newState.schema.nodes.mention.create({
                  id: marker.name, label: marker.name, mentionType: 'skill',
                })
              : newState.schema.nodes.mention.create({
                  id: marker.path, label: marker.path,
                  mentionType: 'file', url: marker.path, filename: marker.path.split('/').pop() || marker.path, mediaType: '',
                })

            const charBefore = marker.from > 0 ? newState.doc.textBetween(marker.from - 1, marker.from) : ''
            const needsSpace = charBefore !== '' && !/\s/.test(charBefore)
            tr.replaceWith(marker.from, marker.to,
              needsSpace ? Fragment.from([newState.schema.text(' '), mentionNode]) : mentionNode
            )
          }

          return tr
        },
      }),
    ]
  },
})

// --- Hydrator: converts text → mention nodes on setContent ---
// Splits on \n and emits hardBreak nodes between lines (notepad-style).
// Each \n in the source becomes exactly one hardBreak, so \n\n produces
// two consecutive hardBreaks (visible blank line). This is intentional —
// getText() serializes each hardBreak back to \n, keeping the round-trip lossless.

export const hydrateText = (text, knownSkills) => {
  if (!text || typeof text !== 'string') return text

  const lines = text.split('\n')
  const content = []

  for (let i = 0; i < lines.length; i++) {
    // One hardBreak per \n — empty lines intentionally get only a hardBreak (no text node)
    if (i > 0) content.push({ type: 'hardBreak' })

    const line = lines[i]
    if (line.length === 0) continue

    const skillRefs = extractSkillRefs(line, knownSkills)
    const fileRefs = extractFileRefs(line)
    const markers = [
      ...skillRefs.map(r => ({ ...r, type: 'skill' })),
      ...fileRefs.map(r => ({ ...r, type: 'file' })),
    ].sort((a, b) => a.start - b.start)

    if (markers.length === 0) {
      content.push({ type: 'text', text: line })
      continue
    }

    let cursor = 0
    for (const marker of markers) {
      if (marker.start > cursor) {
        content.push({ type: 'text', text: line.slice(cursor, marker.start) })
      }
      if (marker.type === 'skill') {
        content.push({
          type: 'mention',
          attrs: { id: marker.name, label: marker.name, mentionType: 'skill' },
        })
      } else {
        const filename = marker.path.split('/').pop() || marker.path
        content.push({
          type: 'mention',
          attrs: { id: marker.path, label: filename, mentionType: 'file', url: marker.path, filename, mediaType: '' },
        })
      }
      cursor = marker.end
    }
    if (cursor < line.length) {
      content.push({ type: 'text', text: line.slice(cursor) })
    }
  }

  return { type: 'doc', content: [{ type: 'paragraph', content: content.length ? content : undefined }] }
}

// --- createExtensions ---

export const createExtensions = ({ skillSuggestionRender } = {}) => [
  EditorStore,
  Document,
  Paragraph,
  Text,
  HardBreak,
  History,
  Dropcursor,
  ExtendedMention.configure({
    suggestion: {
      char: '/',
      items: ({ editor, query }) =>
        (editor.storage.editorStore?.skills ?? [])
          .filter(s => s.name.toLowerCase().includes(query.toLowerCase())),
      command: ({ editor, range, props }) => {
        editor.chain().focus().deleteRange(range).insertContent([
          { type: 'mention', attrs: { id: props.name, label: props.name, mentionType: 'skill' } },
          { type: 'text', text: ' ' },
        ]).run()
      },
      render: skillSuggestionRender,
    },
  }),
  Placeholder.configure({
    placeholder: ({ editor }) => editor.storage.editorStore?.placeholder ?? '',
  }),
  SubmitOnEnter,
  AutoMention,
  FileHandler.configure({
    onPaste: (editor, files) => editor.storage.editorStore?.onFilesPasted?.(files),
    onDrop: (editor, files, _pos) => editor.storage.editorStore?.onFilesPasted?.(files),
  }),
]
