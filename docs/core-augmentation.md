# Message Augmentation

This guide explains how the message augmentation system injects dynamic context—such as active agent skills—into the conversation without breaking prompt caching.

## How It Works

Instead of modifying the system prompt, dynamic content is injected as synthetic text parts prepended to the user's latest message. This ensures the system prompt remains stable, allowing the language model to effectively cache the prefix for all prior messages.

Synthetic parts are identified by a custom `arcSynthetic` attribute, which ensures they are kept separate from user-authored content and can be safely filtered out of the UI.

## Augment Types

### 1. Full Context (First Activation)

When a context (like a skill) is first activated, its full content is injected into the message history. This persistence is required so the LLM retains the context in subsequent turns.

**Format:**

```json
{
  "type": "text",
  "text": "<active_skill name=\"shadcn\">\n...full SKILL.md body...\n</active_skill>",
  "arcSynthetic": "skill:shadcn"
}
```

### 2. Ephemeral Reminders

To reinforce attention without duplicating large blocks of text, every send with an active skill includes a short, ephemeral reminder. Ephemeral reminders are not persisted to the database.

**Format:**

```json
{
  "type": "text",
  "text": "<skill_reminder>\nThe \"shadcn\" skill is active. Follow its instructions from earlier in the conversation.\n</skill_reminder>",
  "arcSynthetic": "skill-reminder:shadcn"
}
```

## Injection Rules

The system follows specific rules to determine when and how to inject augmentations based on the current state and message history:

| Condition | Action | Persisted? |
|-----------|--------|------------|
| **First activation** (no matching augment in history) | Prepend full content part + append ephemeral reminder. | Full content: Yes. Reminder: No. |
| **Subsequent send** (matching augment found in history) | Append ephemeral reminder only. | No (Ephemeral) |
| **Deactivated** | No injection. Old persisted augments remain in history. | N/A |
| **Switched** (e.g., Skill A → Skill B) | Old augment stays in history (no reminder). New skill treated as first activation. | Yes (for new) |
| **Reactivated** | If old augment is found in history, resumes with ephemeral reminder only. | No (Ephemeral) |

## Persistence Flow

The message preparation pipeline handles augmentation injection just before sending to the model:

1. **Build Messages:** Extract standard text and file parts from the user's input.
2. **Load Skill:** If `activeSkill` is set, load its `SKILL.md` content from disk.
3. **Scan History:** Scan persisted message history for an existing matching augment (`arcSynthetic === 'skill:${activeSkill}'`).
4. **Inject Full Content:** If no match is found, **prepend** the full content augment to the last user message's parts.
5. **Persist:** Save the new user messages to the JSONL file (including any full content augment injected in step 4).
6. **Build System Prompt:** Append the available skills list (`buildSkillsPrompt`) to the system prompt and register tools (`load_skill`, `exec`).
7. **Inject Reminder:** **Always** append the ephemeral reminder to the last user message when a skill is active (this happens *after* persistence, so the reminder is never saved).
8. **Send:** Transmit the finalized messages to the LLM.

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
| **Skill deactivated mid-session** | Stop adding augments. Old persisted augments remain in history to preserve context for past model responses. |
| **Skill switched** | The old skill's augment stays in history, but receives no further reminders. The new skill gets a full injection on the next send. |
| **Branch switch** | Different branches have isolated message histories. Detection correctly scans only the active branch's messages. |
| **Missing Content** | If a skill is deleted from disk, the loader returns an error string and it is treated as "no skill" (no augment added). |