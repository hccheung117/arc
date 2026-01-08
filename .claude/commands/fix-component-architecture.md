---
description: Diagnose and fix component architecture issues by tracing styling bugs to structural root causes
argument-hint: [component-or-area]
---

# Fix Component Architecture

You are diagnosing a component architecture issue. The user has identified a problem area (likely a styling bug or layout issue). Your job is NOT to patch the symptom—it's to find and fix the root cause.

## Core Philosophy

> Bugs and mess are usually just symptoms, not the disease. A buggy styling system is rotted from the root: style is by accident, not by design; it's a by-product during dev in previous mindset.

## Your Process

### Phase 1: Study Current State

Analyze the component area: `$ARGUMENTS`

1. **Map component hierarchy**: What components exist? How are they nested?
2. **Map style hierarchy**: What CSS/Tailwind classes are applied at each level?
3. **Identify parallel paths**: Are there multiple rendering paths for the same semantic concept?

Create ASCII diagrams showing:
- Current component tree structure
- Where styling decisions are made at each level
- Any divergent paths that should be unified

### Phase 2: Diagnose Root Cause

Ask yourself:
- Are components correctly abstracted? (Single responsibility)
- Are they in correct hierarchy? (Parent-child relationships make sense)
- Is there good composition? (Components compose without fighting)
- Are there parallel rendering paths for the same concept?

The styling problem is almost certainly a SYMPTOM of one of these structural issues.

Create a diagram showing:
- The semantic model (what the user sees/expects)
- The component model (what code does)
- Where they diverge

### Phase 3: Rethink Component Structure

**Ignore styling completely.** Design the ideal component hierarchy based on:
- What are the semantic concepts? (e.g., "a group of items", "an indented child")
- What should own what? (e.g., "indent wrapper owns offset, item owns internal padding")
- Where should decisions be made? (e.g., "parent decides child position, child decides internal layout")

Create a diagram showing:
- Proposed component hierarchy
- What each component is responsible for
- How they compose

### Phase 4: Redesign Styling (Top-Down)

Now—and only now—design the styling:

1. **Define spacing tokens**: Name them semantically (e.g., `--indent-size`, not `mx-3.5`)
2. **Assign ownership**: Each token owned by exactly one component level
3. **Ensure composability**: Child spacing shouldn't conflict with parent spacing

Create a diagram showing:
- The spacing token system
- Which component owns which token
- How they compose visually

## Output Format

Always produce:

1. **Current State Diagram**: Component + style hierarchy as-is
2. **Problem Diagnosis Diagram**: Where structure diverges from semantics
3. **Proposed Structure Diagram**: Ideal component hierarchy
4. **Proposed Styling Diagram**: Top-down spacing token system
5. **Implementation Roadmap**: Concrete steps to refactor

## Remember

- The fix is NOT adding more CSS to patch symptoms
- The fix is unifying structure so styling falls out naturally
- If you need `translate-x-px` or magic numbers, the structure is wrong
- Fewer spacing tokens = better design (aim for 3-5 per component area)
