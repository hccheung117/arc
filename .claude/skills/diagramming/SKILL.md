---
name: diagramming
description: Create ASCII diagrams to visualize code architecture, data flow, race conditions, or any system behavior the user wants to understand. Use this whenever the user asks to "diagram", "visualize", "draw", or "show me how X works", or when they reference a specific area of code and want to see relationships or sequences.
argument-hint: [focus-area]
---

Create clear, minimal ASCII diagrams to help the user understand code or system behavior.

Focus area (if specified): $ARGUMENTS

## Approach

1. Read the relevant code before diagramming — never diagram from assumptions.
2. Identify what the user actually wants to understand. The diagram should answer a question, not just depict structure.
3. Choose the simplest diagram type that answers that question.

## Abstraction level — behavior, not code

Every label in the diagram and every sentence in the explanation should describe what **happens**, not how the code spells it. Function names, variable names, and internal APIs belong in the code, not in a diagram meant to build understanding. The reader wants to see the system's behavior — what moves where, what breaks, what's ordered before what.

This applies everywhere: diagram labels, inline annotations, and the explanation that follows. Detail comes from showing *what happens and in what order*, not from naming the functions that do it. A diagram full of function names is just the source code drawn sideways.

Use code-level names only when the user explicitly asked about specific code, or when the name IS the concept (e.g. a well-known public API like `fetch` or `localStorage`).

To calibrate: ask yourself whether each label would make sense to someone who has never opened the codebase. If a label requires knowing the codebase to parse, rewrite it as behavior.

```
WRONG                              RIGHT
─────                              ─────
sessionStore.remove(id)        →   Erase session from memory
win.destroy()                  →   Close the window
ctx.stream(signal)             →   Start streaming from LLM
prepareSend()                  →   Save the user's message to disk
push({ type: 'tip', msg })    →   Send each chunk to the UI
ipc:invoke → session:send      →   Send message to main process
session:state:feed (tip)       →   Main pushes chunk to renderer
isStreaming? → YES             →   Already streaming? → blocked
SessionContext                 →   Session state manager
useSubscription(sessions)      →   Subscribe to session list
```

This covers function calls, event/channel names, internal flags, and component/hook names. All of these are code-level identifiers that mean nothing to someone who hasn't read the source. Even when a flag or component IS the mechanism, describe what it *does* rather than what it's *called*.

The same standard applies to the explanation after the diagram and to inline annotations beside diagram elements. Don't use behavioral labels in the diagram and then drop function signatures or channel names into the prose — that undoes the work the diagram did.

**Technique: personify the components.** When you're tempted to reach for a function name, describe what the component *wants* or *thinks* instead. Personification naturally forces behavioral language — you can't say `reloadSession(sessionId)` when the component is "talking."

```
Code-level:     'closed' callback → reloadSession(sessionId)
Personified:    "I was closed — better reload that session!"

Code-level:     SessionContext filters by sessionId, discards non-matching events
Personified:    Renderer sees the event, thinks "not my session," ignores it
```

You don't have to personify everything — use it when a component's intent or reaction is the interesting part. It works especially well for race conditions, guards, and error handling where the "why" matters more than the "what."

## Keep diagrams simple

Prefer showing one path through the system. Branching is fine when it answers the user's question — e.g. showing "what if X happens before vs after Y" — but only if the branches use behavioral language and each side is immediately understandable. If a branch requires the reader to think about code to follow it, flatten it to one path and explain the other in prose.

## Style rules

- Prefer one focused diagram over multiple. Only split if the concepts are genuinely independent.
- After the diagram, add 1-3 sentences explaining the takeaway — not a recap of what the diagram shows, but the "so what."
- No tables summarizing what the diagram already shows. No bullet lists restating the same information in prose.
