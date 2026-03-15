# Message Augmentation

This guide explains how the message augmentation system injects dynamic context—such as agent skills—into the conversation without breaking prompt caching.

## How It Works

Instead of modifying the system prompt, dynamic content is injected as synthetic text parts prepended to the user's latest message. This ensures the system prompt remains stable, allowing the language model to effectively cache the prefix for all prior messages.

Synthetic parts are identified by a custom `arcSynthetic` attribute, which ensures they are kept separate from user-authored content and can be safely filtered out of the UI.

## Augment Types

### Full Context (First Activation)

When a context (like a skill invoked via a slash command) is first detected in a conversation, its full content is injected into the message history. This persistence is required so the LLM retains the context in subsequent turns without needing re-injection.

**Format:**

```json
{
  "type": "text",
  "text": "<active_skill name=\"shadcn\">\n...full SKILL.md body...\n</active_skill>",
  "arcSynthetic": "skill:shadcn"
}
```

## Injection Rules

The system determines when and how to inject augmentations based on the per-message slash commands and the message history.

| Condition | Action | Persisted? |
|-----------|--------|------------|
| **First activation** (slash command used, no matching augment in history) | Prepend full content part. | Yes |
| **Subsequent send** (slash command used, matching augment found in history) | No injection. | N/A |
| **No slash command** | No injection. Old persisted augments remain in history. | N/A |
| **Multiple skills over time** (e.g., `/skillA` then later `/skillB`) | Both augments end up in the history. No conflict. | Yes (for each first activation) |

## Persistence Flow

The message preparation pipeline handles augmentation injection just before sending to the model. Skills are activated per-message via slash commands (e.g., `/explain ...`), there is no persistent active skill state.

1. **Build Messages:** Extract standard text and file parts from the user's input. Check if the message starts with a slash command.
2. **Load Skill:** If a slash command is detected, parse the skill name and load its `SKILL.md` content from disk.
3. **Scan History:** Scan persisted message history for an existing matching augment (`arcSynthetic === 'skill:${skillName}'`).
4. **Inject Full Content:** If no match is found, **prepend** the full content augment to the last user message's parts.
5. **Persist:** Save the new user messages to the JSONL file (including any full content augment injected in step 4).
6. **Build System Prompt:** Append the available skills list (`buildSkillsPrompt`) to the system prompt and register tools (`load_skill`, `exec`).
7. **Send:** Transmit the finalized messages to the LLM.

## Filtering and Display

Synthetic parts are stripped server-side via `stripSyntheticParts()` before reaching the renderer. The renderer never receives `arcSynthetic` parts.

| Layer | Where | Reason |
|-------|-------|--------|
| **State feed** (`session:state:feed`) | `routes/session.js` | Strips synthetic parts before broadcasting session state to renderer. |
| **Edit save** (`message:edit-save`) | `routes/message.js` | Strips before patching renderer state after an edit. |
| **Branch switch** (`message:switch-branch`) | `routes/message.js` | Strips before patching renderer state on branch change. |
| **Export** (`exportMarkdown`) | `services/message.js` | Ensures clean exports without injected system content. |
| **Model Payload** | — | Keeps all parts. The LLM requires the augments for context. |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| **`/notaskill hello`** | No matching skill. Entire text treated as a regular message. No injection. |
| **`/` mid-sentence** | Only triggers at position 0. No interference. |
| **Slash in edit mode** | Slash command parsing works the same on resend. If the user adds/changes a `/command` while editing, the augmentation logic runs on the edited message. |
| **Already-augmented skill typed again** | System scans history, finds existing augment, skips injection. Content is already in LLM context. |
| **Branch switch** | Different branches have isolated message histories. Detection correctly scans only the active branch's messages. |
| **Missing Content** | If a skill is deleted from disk, the loader returns an error string and it is treated as "no skill" (no augment added). |