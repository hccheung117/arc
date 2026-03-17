import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { useFloating, flip, shift } from '@floating-ui/react'
import { cn } from '@/lib/shadcn'
import { createExtensions, hydrateText, uploadAndInsertFiles } from '@/lib/composer-extensions'
import { useComposer } from '@/hooks/use-composer'
import { useSession } from '@/contexts/SessionContext'
import { useSubscription } from '@/hooks/use-subscription'
import SkillList from '@/components/SkillList'

export default function ComposerEditor({ placeholder, readOnly, style, className, onEditorReady }) {
  const { text, saveDraft } = useComposer()
  const { messages } = useSession()
  const skills = useSubscription('skills:feed', [])
  const hasMessages = messages.length > 0

  const fileInputRef = useRef(null)
  const openFileDialog = useCallback(() => fileInputRef.current?.click(), [])

  const textRef = useRef(text)
  const isExternalUpdate = useRef(false)

  // Suggestion popup state — driven by Mention extension's render callbacks
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

  // Suggestion render factory — stable ref, passed to createExtensions
  const skillSuggestionRender = useMemo(() => () => ({
    onStart: (props) => {
      props.editor.storage.editorStore.suggestionActive = true
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
    onExit: (props) => {
      if (!props.editor.storage.editorStore.suggestionActive) return
      props.editor.storage.editorStore.suggestionActive = false
      props.editor.storage.editorStore.suggestionJustExited = true
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
      return false
    },
  }), [])

  const extensions = useMemo(() => createExtensions({
    skillSuggestionRender,
  }), [skillSuggestionRender])

  const editor = useEditor({
    extensions,
    content: text || '',
    editorProps: {
      attributes: {
        'data-slot': 'input-group-control',
        class: 'flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent select-text outline-none min-h-0 whitespace-pre-wrap break-words',
      },
    },
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return
      const currentText = editor.getText()
      textRef.current = currentText
      saveDraft(currentText)
      editor.commands.scrollIntoView()
    },
  })

  // Expose editor + openFileDialog to parent via callback
  useEffect(() => {
    onEditorReady?.(editor ? { editor, openFileDialog } : null)
    return () => onEditorReady?.(null)
  }, [editor, openFileDialog])

  // External content changes (speech, refine, mode switch)
  useEffect(() => {
    if (!editor) return
    if (text === textRef.current) return
    textRef.current = text
    isExternalUpdate.current = true
    // Hydrate text patterns into mention nodes
    const knownSkills = (editor.storage.editorStore?.skills ?? []).map(s => s.name)
    const hydrated = hydrateText(text, knownSkills)
    editor.commands.setContent(hydrated || '')
    isExternalUpdate.current = false
  }, [text])

  // Bridge sync — push reactive values into editor.storage.editorStore
  useEffect(() => {
    if (!editor) return
    const prev = editor.storage.editorStore.placeholder
    Object.assign(editor.storage.editorStore, {
      skills,
      placeholder: hasMessages ? '' : placeholder,
      onFilesPasted: (files) => uploadAndInsertFiles(editor, files),
    })
    if (prev !== editor.storage.editorStore.placeholder) {
      editor.view.dispatch(editor.state.tr)
    }
  }, [editor, skills, hasMessages, placeholder])

  // ReadOnly toggle
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  const selectItem = (index) => {
    const s = suggestionRef.current
    const item = s?.items[index]
    if (item) s.command(item)
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadAndInsertFiles(editor, e.target.files)
          e.target.value = ''
        }}
      />
      <EditorContent
        editor={editor}
        className={cn('flex-1 overflow-y-auto w-full', className)}
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
