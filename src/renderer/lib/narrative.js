export const isToolPart = (p) =>
  p.type === 'tool-call' || p.type === 'tool-result' || (p.toolCallId && p.state)

export const narrativeFromParts = (msg) => {
  const parts = msg.parts
  if (!parts?.length) return []

  let lastToolIdx = -1
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isToolPart(parts[i])) { lastToolIdx = i; break }
  }

  const narrative = []

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]

    if (p.type === 'step-start') continue

    if (p.type === 'reasoning') {
      if (p.text?.trim()) narrative.push({ type: 'reasoning', text: p.text })
      continue
    }

    if (p.toolCallId && p.state) {
      const toolName = p.type === 'dynamic-tool' ? p.toolName : p.type.slice(5)
      narrative.push({
        type: 'tool',
        toolCallId: p.toolCallId,
        toolName,
        state: p.state,
        input: p.input,
        output: p.output,
        hasResult: p.state === 'output-available' || p.state === 'output-error' || p.state === 'output-denied',
      })
      continue
    }

    if (p.type === 'tool-call') {
      narrative.push({
        type: 'tool',
        toolCallId: p.toolCallId,
        toolName: p.toolName,
        input: p.input,
        output: undefined,
        hasResult: false,
      })
      continue
    }

    if (p.type === 'tool-result') continue

    if (p.type === 'text') {
      if (i > lastToolIdx) continue
      if (p.text?.trim()) narrative.push({ type: 'interstitial-text', text: p.text })
    }
  }

  return narrative
}
