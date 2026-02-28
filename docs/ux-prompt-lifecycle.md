# Prompt Lifecycle

A prompt starts as a casual thought in a single chat and graduates through layers as it proves useful. 

The core philosophy is **One-Way Escalation**: prompts move up the ladder of reusability, never down. There is no concept of "forking" a shared prompt back into a local, single-chat copy. If a shared prompt is edited in any chat, that refinement benefits all chats using it.

## The Stages

### 1. Casual (Single Chat)
The user toggles into prompt mode during a chat and writes a system instruction. It's a one-off thought scoped only to this conversation. There's no pressure to name it or save it anywhere else. It lives and dies with the chat.

### 2. Iterate (Refinement)
As the conversation progresses, the user realizes the prompt needs tweaking. They edit and save the prompt repeatedly within the same chat. It remains low-commitment and isolated.

### 3. Promote (App-Wide)
The user realizes this prompt is a great pattern they want to use again. They hit **Promote**, give it a name, and it graduates to an App Prompt. 

Now it's reusable:
- Any new chat can select this prompt from the dropdown.
- **Crucially:** If the user edits this promoted prompt in *any* chat, they are refining the shared App Prompt. All other chats referencing this prompt immediately benefit from the improvement.

### 4. Distribute (Community/Profile)
The prompt has proven so useful that it belongs in a shared toolkit. The prompt is packaged into a Profile (e.g., a "Coding" profile or "Writing" profile) and distributed. Other users can install that profile and get the prompt automatically in their dropdown.

---

## Why No "Forking"?

Traditional apps let you pick a template, then edit it as a local copy just for that document. We intentionally avoid this.

When you use a shared prompt, the app assumes you are using that specific tool. If you find a flaw in the tool and fix it while working, you want that fix saved to the tool itself—not just left behind in the current project. 

The `@app` layer is the personal customization space. Iterating on a prompt there is the intended way to build up a personalized, highly refined set of tools.
