import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useEditor, EditorContent } from "@tiptap/react"
import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import Suggestion from "@tiptap/suggestion"
import { useFloating, flip, shift } from "@floating-ui/react"
import { cn } from "@/lib/shadcn"
import { createExtensions, SkillMention } from "@/lib/composer-extensions"
import { useComposer } from "@/hooks/use-composer"
import { useSession } from "@/contexts/SessionContext"
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input"
import { useSubscription } from "@/hooks/use-subscription"
import SkillList from "@/components/SkillList"

// --- helpers -----------------------------------------------------------------

const getMentionName = (doc) => {
  let name = null
  doc.descendants((node) => {
    if (node.type.name === 'skillMention') name = node.attrs.name
  })
  return name
}

const removeMention = (editor) => {
  let found = null
  editor.state.doc.descendants((node, pos) => {
    if (!found && node.type.name === 'skillMention') {
      found = { pos, size: node.nodeSize }
    }
  })
  if (found) {
    editor.chain().deleteRange({ from: found.pos, to: found.pos + found.size }).run()
  }
}

const insertMention = (editor, name) => {
  editor.chain().focus().insertContent([
    { type: 'skillMention', attrs: { name } },
    { type: 'text', text: ' ' },
  ]).run()
}

// --- bridge extension --------------------------------------------------------
// Owns mutable storage for all React-driven values. Extensions read from
// editor.storage.composerBridge.* at call time instead of closing over refs.

const ComposerBridge = Extension.create({
  name: 'composerBridge',
  addStorage() {
    return {
      attachments: null,  // PromptInputAttachments context
      skills: [],         // skills:feed subscription
      placeholder: '',    // derived from props + hasMessages
      // Future: add keys here for @-mention sources (files, agents, contexts)
    }
  },
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('composerBridgePaste'),
        props: {
          handlePaste: (_view, event) => {
            const items = event.clipboardData?.items
            if (!items) return false
            const files = []
            for (const item of items) {
              if (item.kind === 'file') {
                const file = item.getAsFile()
                if (file) files.push(file)
              }
            }
            if (files.length > 0) {
              event.preventDefault()
              editor.storage.composerBridge.attachments?.add(files)
              return true
            }
            return false
          },
        },
      }),
    ]
  },
})

// --- keyboard extensions -----------------------------------------------------

const SubmitOnEnter = Extension.create({
  name: 'submitOnEnter',
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const el = editor.options.element
        const form = el.closest('form')
        if (!form) return false
        const submitButton = form.querySelector('button[type="submit"]')
        if (submitButton?.disabled) return true
        form.requestSubmit()
        return true
      },
    }
  },
})

// --- component ---------------------------------------------------------------

export default function ComposerEditor({ placeholder, readOnly, style, className }) {
  // [CMD-CHANNEL] pendingMention is consumed by the pendingMention effect below.
  const { plainText, content, version, syncContent, pendingMention } = useComposer()
  const { messages } = useSession()
  const skills = useSubscription('skills:feed', [])
  const attachments = usePromptInputAttachments()
  const hasMessages = messages.length > 0

  const versionRef = useRef(0)

  // Suggestion popup state
  const [suggestion, setSuggestion] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedIndexRef = useRef(0)
  const suggestionRef = useRef(null)

  const { refs, floatingStyles } = useFloating({
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [flip(), shift({ padding: 8 })],
  })

  useEffect(() => {
    if (!suggestion?.clientRect) return
    refs.setReference({ getBoundingClientRect: suggestion.clientRect })
  }, [suggestion])

  // --- extensions (stable, created once) ---

  const BackspaceRemoveAttachment = useMemo(() => Extension.create({
    name: 'backspaceRemoveAttachment',
    addKeyboardShortcuts() {
      return {
        Backspace: ({ editor }) => {
          if (editor.isEmpty) {
            const att = editor.storage.composerBridge.attachments
            const files = att?.files
            if (files?.length > 0) {
              const last = files.at(-1)
              if (last) att.remove(last.id)
              return true
            }
          }
          return false
        },
      }
    },
  }), [])

  const SkillMentionWithSuggestion = useMemo(() => SkillMention.extend({
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          allow: ({ editor }) => !getMentionName(editor.state.doc),
          items: ({ editor, query }) =>
            editor.storage.composerBridge.skills.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).run()
            insertMention(editor, props.name)
          },
          render: () => ({
            onStart: (props) => {
              suggestionRef.current = props
              setSuggestion(props)
              setSelectedIndex(0)
              selectedIndexRef.current = 0
            },
            onUpdate: (props) => {
              suggestionRef.current = props
              setSuggestion(props)
              setSelectedIndex((i) => {
                const clamped = Math.min(i, Math.max(0, props.items.length - 1))
                selectedIndexRef.current = clamped
                return clamped
              })
            },
            onExit: () => {
              suggestionRef.current = null
              setSuggestion(null)
            },
            onKeyDown: ({ event }) => {
              const s = suggestionRef.current
              if (!s?.items.length) return false
              if (event.key === 'ArrowUp') {
                setSelectedIndex((i) => {
                  const next = (i - 1 + s.items.length) % s.items.length
                  selectedIndexRef.current = next
                  return next
                })
                return true
              }
              if (event.key === 'ArrowDown') {
                setSelectedIndex((i) => {
                  const next = (i + 1) % s.items.length
                  selectedIndexRef.current = next
                  return next
                })
                return true
              }
              if (event.key === 'Enter') {
                const item = s.items[selectedIndexRef.current]
                if (item) s.command(item)
                return true
              }
              if (event.key === 'Escape') {
                return false // Let Suggestion handle dismissal via onExit
              }
              return false
            },
          }),
        }),
      ]
    },
  }), [])

  // --- editor ----------------------------------------------------------------

  const extensions = useMemo(() => [
    ComposerBridge, // must be first so storage exists before other extensions read it
    SubmitOnEnter,
    BackspaceRemoveAttachment,
    ...createExtensions(
      ({ editor }) => editor?.storage.composerBridge?.placeholder ?? '',
      SkillMentionWithSuggestion
    ),
  ], [BackspaceRemoveAttachment, SkillMentionWithSuggestion])

  const editor = useEditor({
    extensions,
    content: content || '',
    editorProps: {
      attributes: {
        'data-slot': 'input-group-control',
        class: 'flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent select-text outline-none min-h-0 whitespace-pre-wrap break-words',
      },
    },
    // [SSOT] The editor document is the single source of truth for mentions.
    // No mention → store sync needed. syncContent writes JSON to the composer
    // store and clears pendingMention [CMD-CHANNEL].
    onUpdate: ({ editor }) => {
      syncContent(editor.getJSON())
    },
  })

  // Store → editor (only fires on external writes that bump version)
  useEffect(() => {
    if (!editor || version === versionRef.current) return
    versionRef.current = version
    editor.commands.setContent(content || '')
  }, [version])

  // Bridge sync — pushes all reactive values into editor.storage
  // Future: add new @-mention sources here (files, agents, contexts)
  useEffect(() => {
    if (!editor) return
    const prev = editor.storage.composerBridge.placeholder
    Object.assign(editor.storage.composerBridge, {
      attachments, skills,
      placeholder: hasMessages ? '' : placeholder,
    })
    if (prev !== editor.storage.composerBridge.placeholder) {
      editor.view.dispatch(editor.state.tr)
    }
  }, [editor, attachments, skills, hasMessages, placeholder])

  // ReadOnly toggle
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  // [CMD-CHANNEL] Consume pendingMention: insert the requested skill mention.
  // syncContent (called by onUpdate after insertion) clears pendingMention.
  // Producer: composerActions.insertMention() called by SkillSelectorButton.jsx.
  useEffect(() => {
    if (!editor || !pendingMention) return
    const existing = getMentionName(editor.state.doc)
    if (existing) removeMention(editor)
    editor.chain().focus().setTextSelection(0).run()
    insertMention(editor, pendingMention)
  }, [pendingMention])

  // --- popup -----------------------------------------------------------------

  const selectItem = (index) => {
    const s = suggestionRef.current
    const item = s?.items[index]
    if (item) s.command(item)
  }

  return (
    <>
      <input type="hidden" name="message" value={plainText} />
      <EditorContent
        editor={editor}
        className={cn("flex-1 overflow-y-auto w-full", className)}
        style={style}
      />
      {suggestion && suggestion.items.length > 0 && createPortal(
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className="z-50 w-80 rounded-md border bg-popover p-0 text-popover-foreground shadow-md"
        >
          <SkillList
            skills={suggestion.items}
            onSelect={(skill, index) => selectItem(index)}
            shouldFilter={false}
            selectedIndex={selectedIndex}
          />
        </div>,
        document.body,
      )}
    </>
  )
}
