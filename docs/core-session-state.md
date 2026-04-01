# Architecture Pattern: Unified Session State

## Overview

Session state in Arc (chat messages, LLM streaming status, prompt drafts, etc.) uses a strict **Unidirectional Data Flow** with a **Single Source of Truth (SSOT)** living entirely in the main process. 

Renderers (browser windows, popouts) do not hold authoritative state and do not accumulate streaming chunks. They are purely stateless projections that subscribe to state updates broadcasted by the main process.

## The Problem with Split Authority

In traditional Electron chat apps, authority is often split:
- **Disk/Main Process:** Authoritative for historical, saved messages.
- **Renderer Process:** Authoritative for in-flight streaming state while an LLM is generating.

This split creates significant complexity: stale disk reads overwriting live streams during window reloads, lost streams when windows close mid-generation, and complex arbitration logic (e.g., "is the LLM busy?") when syncing state between multiple popout windows.

## The Solution: Main-Process Authority

Arc solves this by moving the accumulation of streaming data and the lifecycle of the session into a centralized store in the main process. 

### 1. Main Process: The Store
The main process maintains a map of active session states. It is responsible for:
- Loading saved sessions from disk.
- Managing the LLM stream and accumulating chunks into finalized messages.
- Broadcasting state changes to all listening renderers.
- Handling abort signals to cancel ongoing streams.

### 2. The Broadcast Channel
The main process pushes state to renderers using a unified IPC channel with typed events:

- **Snapshot:** Sends the entire session state (messages, active branch, prompt input, status). Sent when a renderer connects, switches branches, or when a stream finishes.
- **Tip:** Sends *only the full, accumulated text* of the currently generating assistant message. Sent on every meaningful chunk during streaming.
- **Status:** Sends transition states (e.g., `ready` → `streaming` → `ready/error`).

*Note on Tips:* The main process broadcasts the *entire* accumulated message so far, rather than just deltas. This ensures renderers remain entirely stateless; if a renderer drops a message or connects late, the next tip immediately corrects its state without complex delta-reconstruction logic.

### 3. Renderers: Stateless Projections
Renderers subscribe to the broadcast channel and use a simple reducer to apply incoming events to their React context. 
- When a `snapshot` arrives, they replace their local state entirely.
- When a `tip` arrives, they replace just the last message in their array. React handles the DOM diffing.

When a user interacts (sends a message, edits, or switches branches), the renderer makes a fire-and-forget IPC call to the main process and waits for the resulting `snapshot` or `tip` to flow back down the broadcast channel.

## Architectural Benefits

By centralizing the SSOT in the main process, we unlock several capabilities by default:

- **Background Streaming:** A user can close the window mid-stream. The stream continues running in the main process, accumulates the response, and saves it to disk. When the user reopens the app, the complete message is waiting for them.
- **Multi-Window Sync:** A main window and a detached popout window can view the exact same session simultaneously. Since both simply subscribe to the same main-process broadcast channel, their UIs update in lockstep during LLM generation without any peer-to-peer renderer synchronization.
- **Trivial Rehydration:** If a popout opens while a stream is in progress, it immediately receives a `snapshot` followed by the ongoing `tip` events, seamlessly joining the stream mid-flight.
