import { ArrowUp, Save, Split } from "lucide-react"

const textFromParts = (msg) =>
  msg?.parts.filter((p) => p.type === "text").map((p) => p.text).join("")

const draftValue = ({ drafts, mode }) => drafts[mode] ?? ""

const editValue = ({ drafts, mode, messages, messageKey }) =>
  drafts[mode] ?? textFromParts(messages?.find((m) => m.id === messageKey)) ?? ""

const sendSubmit = ({ value, sendMessage, workbench, act }) => {
  sendMessage({ text: value }, { body: { promptRef: workbench.promptRef } })
  act().session.retireDraft()
}

export const MODES = {
  chat: {
    header: false,
    placeholder: "How can I help you today?",
    tools: ["attach", "model", "mic"],
    submitIcon: ArrowUp,
    useValue: draftValue,
    submit: sendSubmit,
  },
  "edit:user": {
    header: { title: "USER MESSAGE", actions: ["cancel"] },
    placeholder: "",
    tools: ["attach", "model", "mic"],
    submitIcon: Split,
    useValue: editValue,
    submit: sendSubmit,
  },
  "edit:ai": {
    header: { title: "AI MESSAGE", actions: ["cancel"] },
    placeholder: "",
    tools: ["mic"],
    submitIcon: Save,
    useValue: editValue,
    submit: sendSubmit,
  },
  prompt: {
    header: { title: "SYSTEM PROMPT", actions: ["refine", "promote", "cancel"] },
    placeholder: "How would you like me to behave?",
    tools: ["mic"],
    submitIcon: Save,
    useValue: ({ drafts, mode, prompt }) => drafts[mode] || prompt || "",
    submit: ({ value, sessionId, act }) => {
      window.api.call('session:save-prompt', { id: sessionId, content: value })
      act().composer.setMode("chat")
    },
  },
}

export const resolveMode = (type, overrides = {}) => ({ ...MODES[type], ...overrides })
