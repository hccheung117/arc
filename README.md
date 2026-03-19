# Arc

An agentic desktop AI chat client for macOS and Windows. Bring your own providers, models, and workflow.

## Design

### Profiles are distributable

Most AI tools tie configuration directly to the app. API keys, model preferences, and custom prompts live in settings menus that every user has to fill out themselves. Arc takes a different approach by putting all of this into a **profile**: a portable directory that bundles providers, models, prompts, and skills together.

An expert can set up a profile once, and everyone else just imports it and starts chatting. There are no setup screens and no credential juggling. You can swap profiles to instantly switch between completely different AI configurations — one for your team, another for personal use, or one shared by a community.

### Skills without a dev environment

Agent skills in most tools inherently assume you're running them on a developer's machine with specific runtimes installed. Arc takes a different approach: skills themselves are simply markdown files with frontmatter, allowing them to be loaded with zero dependencies. 

When a skill does need to execute code, it leverages environments that are shipped with the OS or Arc itself. It can use Node.js (via the underlying Electron app for true cross-platform scripts), or Bash and PowerShell for OS-specific native capabilities. For the user, it remains a truly dependency-free experience—no dev environment required.

These skills load on demand through tool calls rather than being packed into the system prompt upfront. This keeps the system prompt small and stable, ensuring that provider-side prompt caching actually remains effective across turns.

### Prompts have a lifecycle

Most tools force you to write complex system prompts upfront before you even start chatting—the so-called "agent" approach. But this is unnatural. The best patterns and instructions usually only become clear *during* iteration. 

Arc implements a one-way flow that matches how people actually work. A prompt starts as a one-off experiment typed into a single conversation. As you refine it and find what works, you promote it to your personal collection. If it's worth sharing, you distribute it through a profile. You discover the prompt as you go, rather than guessing it at the start.

### Settings resolve in layers

Shareable configuration and personal preferences inevitably conflict. If you edit a shared profile to add your own preferences, you break it for others. Arc solves this by treating profiles as a baseline. 

A personal per-user config directory (the `@app` layer) overrides, extends, or cancels profile settings without ever touching the profile itself. Different settings use different merge strategies: model favorites can be added or canceled, task assignments (like which model handles title generation or transcription) can be nulled out, and prompts or skills resolve by name with the personal layer winning. The profile stays clean; your customization stays personal.

## Built With

Electron, React, Vercel AI SDK, TipTap, Tailwind, Zustand.