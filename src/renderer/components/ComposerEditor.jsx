import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { cn } from '@/lib/shadcn'
import { createExtensions, uploadAndInsertFiles } from '@/lib/composer-extensions'
import { useComposer, useComposerJson } from '@/hooks/use-composer'
import { useSession } from '@/contexts/SessionContext'
import { useSubscription } from '@/hooks/use-subscription'
import { useSuggestionPopup } from '@/hooks/use-suggestion-popup'
import SkillList from '@/components/SkillList'

function SuggestionPopup({ popup }) {
  const { suggestion, selectedIndex, suggestionRef, refs, floatingStyles } = popup
  if (!suggestion?.items?.length) return null
  return createPortal(
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="z-50 w-80 rounded-md border bg-popover p-0 text-popover-foreground shadow-md"
    >
      <SkillList
        skills={suggestion.items}
        onSelect={(item, index) => {
          const s = suggestionRef.current
          const it = s?.items[index]
          if (it) s.command(it)
        }}
        shouldFilter={false}
        selectedIndex={selectedIndex}
      />
    </div>,
    document.body,
  )
}

export default function ComposerEditor({ placeholder, readOnly, style, className, onEditorReady }) {
  const { text, saveDraft } = useComposer()
  const json = useComposerJson()
  const { messages } = useSession()
  const skills = useSubscription('skills:feed', [])
  const agents = useSubscription('agents:feed', [])
  const hasMessages = messages.length > 0

  const fileInputRef = useRef(null)
  const openFileDialog = useCallback(() => fileInputRef.current?.click(), [])

  const textRef = useRef(text)
  const isExternalUpdate = useRef(false)

  // Suggestion popup state — driven by Mention extension's render callbacks
  const skill = useSuggestionPopup()
  const agent = useSuggestionPopup()

  const extensions = useMemo(() => createExtensions({
    skillSuggestionRender: skill.render,
    agentSuggestionRender: agent.render,
  }), [skill.render, agent.render])

  const editor = useEditor({
    extensions,
    content: json || '',
    // Check editor.isEmpty (not !json) — tiptap's ref pattern for callbacks
    // means `json` can become stale before onCreate fires.
    onCreate: ({ editor }) => {
      if (editor.isEmpty && text) editor.commands.setHydratedContent(text)
    },
    editorProps: {
      attributes: {
        'data-slot': 'input-group-control',
        class: 'flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent select-text outline-none min-h-0 whitespace-pre-wrap break-words',
      },
    },
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return
      const currentText = editor.getText()
      const currentJson = editor.getJSON()
      textRef.current = currentText
      saveDraft(currentText, currentJson)
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
    editor.commands.setHydratedContent(text)
    isExternalUpdate.current = false
  }, [text])

  // Bridge sync — push reactive values into editor.storage.editorStore
  useEffect(() => {
    if (!editor) return
    const prev = editor.storage.editorStore.placeholder
    Object.assign(editor.storage.editorStore, {
      skills,
      agents,
      placeholder: hasMessages ? '' : placeholder,
      onFilesPasted: (files) => uploadAndInsertFiles(editor, files),
    })
    if (prev !== editor.storage.editorStore.placeholder) {
      editor.view.dispatch(editor.state.tr)
    }
  }, [editor, skills, agents, hasMessages, placeholder])

  // ReadOnly toggle
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
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
      <SuggestionPopup popup={skill} />
      <SuggestionPopup popup={agent} />
    </>
  )
}
