# Message Augmentation

This guide explains how Arc injects dynamic context—such as agent skills—into conversations while optimizing performance and ensuring a clean user experience.

## The Concept

Instead of continuously modifying the core system instructions (which breaks prompt caching), Arc injects dynamic content directly into the conversation history as "synthetic" text. This ensures that the AI remembers active skills and rules without degrading performance.

These synthetic injections are kept entirely separate from your actual messages. They are invisible in the user interface but fully visible to the AI.

## Types of Augmentations

### 1. Full Context (First Activation)

When you first use a skill (e.g., via a slash command), the full context of that skill is injected into the conversation history. This gives the AI all the necessary knowledge to execute the skill. Because this context is saved into the history, the AI will remember it for the rest of the conversation.

### 2. Ephemeral Reminders

When you assign a task to a specialized agent, or re-use a skill you've already activated, Arc doesn't need to inject the full context again. Instead, it attaches a small, temporary reminder to your current message. This reminder ensures the AI knows exactly what to do for that specific turn, without permanently cluttering the conversation history.

## How It Works in Practice

1. **Detection:** When you send a message, Arc checks if you are invoking a specific skill (like using a slash command) or assigning a task to an agent.
2. **Context Gathering:** Based on what it detects, Arc gathers the necessary instructions (either the full skill documentation or brief reminders).
3. **Injection:** Arc seamlessly attaches this context to your message before sending it to the AI.
4. **Clean UI:** When displaying the conversation back to you, Arc filters out all the injected context. You only see what you actually typed, while the AI sees the full picture.

## Handling Common Scenarios

- **Multiple Skills:** You can use different skills over the course of a conversation. Each new skill's context is added seamlessly without conflicting with previous ones.
- **Editing Messages:** If you edit a message and change the invoked skill or command, Arc automatically recalculates and applies the correct context for the edited message.
- **Branching:** If you branch a conversation, the context correctly follows the history of that specific branch, maintaining perfect isolation.
