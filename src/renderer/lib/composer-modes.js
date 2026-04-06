import { ArrowUp, Save, Split } from "lucide-react"

export const textFromParts = (msg) => {
  if (!msg?.parts) return ''
  const parts = msg.parts
  const isToolPart = (p) => p.type === 'tool-call' || p.type === 'tool-result' || (p.toolCallId && p.state)
  let lastToolIdx = -1
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isToolPart(parts[i])) { lastToolIdx = i; break }
  }
  return parts.slice(lastToolIdx + 1)
    .filter(p => p.type === 'text')
    .map(p => p.text).join('')
}

export const MODES = {
  chat: {
    header: false,
    placeholder: "How can I help you today?",
    tools: ["skill", "agent", "attach", "model", "mic"],
    submitIcon: ArrowUp,
  },
  "edit:user": {
    header: { title: "USER MESSAGE", actions: ["cancel"] },
    placeholder: "",
    tools: ["skill", "agent", "attach", "model", "mic"],
    submitIcon: Split,
  },
  "edit:ai": {
    header: { title: "AI MESSAGE", actions: ["cancel"] },
    placeholder: "",
    tools: ["mic"],
    submitIcon: Save,
  },
  prompt: {
    header: { title: "SYSTEM PROMPT", actions: ["refine", "promote", "cancel"] },
    placeholder: "How would you like me to behave?",
    tools: ["mic"],
    submitIcon: Save,
  },
}

export const resolveMode = (type, overrides = {}) => ({ ...MODES[type], ...overrides })
