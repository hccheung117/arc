import { ArrowUp, Save, Split } from "lucide-react"

export const textFromParts = (msg) =>
  msg?.parts.filter((p) => p.type === "text").map((p) => p.text).join("")

export const MODES = {
  chat: {
    header: false,
    placeholder: "How can I help you today?",
    tools: ["skill", "attach", "model", "mic"],
    submitIcon: ArrowUp,
  },
  "edit:user": {
    header: { title: "USER MESSAGE", actions: ["cancel"] },
    placeholder: "",
    tools: ["skill", "attach", "model", "mic"],
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
