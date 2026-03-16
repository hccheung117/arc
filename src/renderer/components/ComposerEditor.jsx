import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useEditor, EditorContent } from "@tiptap/react"
import { Extension } from "@tiptap/core"
import Suggestion from "@tiptap/suggestion"
import { useFloating, flip, shift } from "@floating-ui/react"
import { cn } from "@/lib/shadcn"
import { createExtensions, SkillMention } from "@/lib/composer-extensions"
import { useComposer } from "@/hooks/use-composer"
import { useSession } from "@/contexts/SessionContext"
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input"
import { useSubscription } from "@/hooks/use-subscription"
import { useAppStore, act } from "@/store/app-store"
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
  const { plainText, content, version, syncContent } = useComposer()
  const { messages } = useSession()
  const activeSkill = useAppStore((s) => s.workbenches[s.activeSessionId]?.activeSkill)
  const skills = useSubscription('skills:feed', [])
  const attachments = usePromptInputAttachments()
  const hasMessages = messages.length > 0

  const versionRef = useRef(0)
  const placeholderRef = useRef(placeholder)
  placeholderRef.current = hasMessages ? '' : placeholder
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments
  const skillsRef = useRef(skills)
  skillsRef.current = skills
  const internalWriteRef = useRef(false)
  const hadMentionRef = useRef(false)

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
            const files = attachmentsRef.current?.files
            if (files?.length > 0) {
              const last = files.at(-1)
              if (last) attachmentsRef.current.remove(last.id)
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
          items: ({ query }) =>
            skillsRef.current.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
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
    SubmitOnEnter,
    BackspaceRemoveAttachment,
    ...createExtensions(() => placeholderRef.current, SkillMentionWithSuggestion),
  ], [BackspaceRemoveAttachment, SkillMentionWithSuggestion])

  const editor = useEditor({
    extensions,
    content: content || '',
    editorProps: {
      attributes: {
        'data-slot': 'input-group-control',
        class: 'flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent select-text outline-none min-h-0 whitespace-pre-wrap break-words',
      },
      handlePaste: (view, event) => {
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
          attachmentsRef.current?.add(files)
          return true
        }
        return false
      },
    },
    onCreate: ({ editor }) => {
      hadMentionRef.current = !!getMentionName(editor.state.doc)
    },
    onUpdate: ({ editor }) => {
      syncContent(editor.getJSON())

      // Sync mention presence → workbench activeSkill
      if (internalWriteRef.current) return
      const mentionName = getMentionName(editor.state.doc)
      const hasMention = !!mentionName
      if (hasMention !== hadMentionRef.current || (hasMention && mentionName !== activeSkill)) {
        act().workbench.update({ activeSkill: mentionName ?? null })
      }
      hadMentionRef.current = hasMention
    },
  })

  // Store → editor (only fires on external writes that bump version)
  useEffect(() => {
    if (!editor || version === versionRef.current) return
    versionRef.current = version
    editor.commands.setContent(content || '')
    hadMentionRef.current = !!getMentionName(editor.state.doc)
  }, [version])

  // Hide placeholder when chat has messages
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(editor.state.tr)
  }, [editor, hasMessages])

  // ReadOnly toggle
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  // Workbench → editor: sync SkillMention node with activeSkill from store
  useEffect(() => {
    if (!editor) return
    const mentionName = getMentionName(editor.state.doc)
    internalWriteRef.current = true

    // Remove stale mention
    if (mentionName && mentionName !== activeSkill) {
      removeMention(editor)
      hadMentionRef.current = false
    }

    // Insert mention when activeSkill set externally (e.g. book button)
    if (activeSkill && !getMentionName(editor.state.doc)) {
      editor.chain().focus().setTextSelection(0).run()
      insertMention(editor, activeSkill)
      hadMentionRef.current = true
    }

    internalWriteRef.current = false
  }, [activeSkill])

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
