import { createContext, use, useState } from "react"
import { ArrowUp, Save, Split } from "lucide-react"

const MODES = {
  chat: {
    header: false,
    placeholder: "How can I help you today?",
    tools: ["attach", "model", "mic"],
    submitIcon: ArrowUp,
    composerShadowClass: "shadow-[0_4px_30px_rgba(0,0,0,0.3)]",
    footerActionsClass: "",
  },
  "edit:user": {
    header: { title: "USER MESSAGE", actions: ["cancel"] },
    placeholder: "",
    tools: ["attach", "model", "mic"],
    submitIcon: Split,
    composerShadowClass: "shadow-[0_4px_30px_rgba(0,0,0,0.3)]",
    footerActionsClass: "",
  },
  "edit:ai": {
    header: { title: "AI MESSAGE", actions: ["cancel"] },
    placeholder: "",
    tools: ["mic"],
    submitIcon: Save,
    composerShadowClass: "shadow-[0_4px_30px_rgba(0,0,0,0.3)]",
    footerActionsClass: "",
  },
  prompt: {
    header: { title: "SYSTEM PROMPT", actions: ["refine", "promote", "cancel"] },
    placeholder: "How would you like me to behave?",
    tools: ["mic"],
    submitIcon: Save,
    composerShadowClass: "shadow-[0_3px_20px_rgba(255,0,0,0.3)]",
    footerActionsClass: "ml-auto",
  },
}

const ComposerModeContext = createContext()

export const useComposerMode = () => use(ComposerModeContext)

const resolveMode = (type, overrides = {}) => ({ ...MODES[type], ...overrides })

export function ComposerModeProvider({ children }) {
  const [{ modeType, mode }, setState] = useState({ modeType: "chat", mode: MODES.chat })

  const setMode = (typeOrFn, overrides) => {
    setState((prev) => {
      const type = typeof typeOrFn === "function" ? typeOrFn(prev.modeType) : typeOrFn
      return { modeType: type, mode: resolveMode(type, overrides) }
    })
  }

  return (
    <ComposerModeContext value={{ modeType, mode, setMode }}>
      {children}
    </ComposerModeContext>
  )
}
