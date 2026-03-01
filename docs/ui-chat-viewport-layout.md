# UI Pattern: Chat Viewport Layout

## Purpose

This document outlines the standard layout pattern for the chat viewport. It resolves the classic conflict between two core requirements:
1. **Empty State Centering:** The empty state needs a fixed-height context (`h-full` or absolute) to be visually centered in the visible area.
2. **Stick-To-Bottom Scrolling:** The message flow requires flexible content heights (`min-h-full`) so that `ResizeObserver` can detect height changes and trigger auto-scroll behavior.

Combining both rules onto a single wrapper element causes regression loops (e.g., empty state drifting off-center vs. bottom messages being covered by the composer). This pattern solves the conflict using **split layout contracts**.

---

## The Pattern: Split Layout Contracts

Instead of using one container with complex CSS to handle both states, we branch the layout tree early. 

### 1. Global Viewport Setup

- **Composer:** Absolute positioned at the bottom of the screen. Its dynamic height is published as the CSS variable `--footer-h`.
- **Header:** Sticky positioned at the top. Its height is `--header-h`.
- **Scroll Container:** Must use `min-h-full` (never `h-full`) to ensure `use-stick-to-bottom` observers fire correctly as content grows.

### 2. The Empty State Contract

When `messages.length === 0`, we render a dedicated centering wrapper that calculates the exact visible space between the header and the composer overlay.

- **Wrapper:** Flex column, `flex-1` or `size-full`.
- **Top Inset:** Safe breathing space (e.g., `var(--content-px)`).
- **Bottom Inset:** Clear the composer *plus* safe breathing space (e.g., `calc(var(--footer-h) + var(--content-px))`).
- **Result:** The empty state naturally centers inside the visually available area, without getting pushed around by scrolling mechanics.

### 3. The Message Flow Contract

When `messages.length > 0`, we render a dedicated message list wrapper optimized for content streaming and scrolling.

- **Wrapper:** Flex column, `min-h-0` to yield to the parent scroll area.
- **Top Inset:** Safe breathing space below header.
- **Bottom Inset:** Exact composer clearance (`var(--footer-h)`).
- **Result:** Content shrinks/grows cleanly, triggering the `ResizeObserver` for auto-scrolling, and the last message is never covered by the absolute composer.

---

## Component Sketch

```jsx
<Conversation h-full>
  <ConversationContent min-h-full>
    <Header sticky />

    {isEmpty ? (
      /* EMPTY STATE CONTRACT */
      <EmptyViewport
        paddingTop="var(--content-px)"
        paddingBottom="calc(var(--footer-h) + var(--content-px))"
      >
        <CenteredContent />
      </EmptyViewport>
    ) : (
      /* MESSAGE FLOW CONTRACT */
      <MessageList
        paddingBottom="var(--footer-h)"
      >
        <Messages />
      </MessageList>
    )}
  </ConversationContent>
  <ScrollButton bottom="calc(var(--footer-h) + 1rem)" />
</Conversation>
```

---

## Invariants (Do Not Break)

1. **Never use `h-full` on `ConversationContent` or its direct scrolling children.** It will break the `use-stick-to-bottom` observer.
2. **Never merge the empty and message wrappers.** Keep them separate to decouple centering math from scroll clearance math.
3. **Always use `--footer-h` for bottom padding.** The composer height changes dynamically (autogrow, manual resize, prompts mode).

---

## Developer QA Checklist

When touching chat layout, verify these scenarios:

**1. Empty State Centering**
- [ ] Session has 0 messages.
- [ ] Type multiple lines into the composer so it grows.
- [ ] *Expectation:* The empty state text remains perfectly centered in the remaining visible space above the composer.

**2. Message Clearance**
- [ ] Session has enough messages to scroll.
- [ ] Scroll to the absolute bottom.
- [ ] Type multiple lines into the composer so it grows.
- [ ] *Expectation:* The last message pushes up and is never hidden behind the composer overlay.

**3. Stick-to-Bottom Behavior**
- [ ] Send a prompt that generates a long streaming response.
- [ ] *Expectation:* The view automatically scrolls down to keep the latest words in view.
- [ ] Scroll up manually while it's still generating.
- [ ] *Expectation:* The auto-scroll stops (user lock) and doesn't violently snap back to the bottom.
