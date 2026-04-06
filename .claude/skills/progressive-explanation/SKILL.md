---
name: progressive-explanation
description: Walk the user through a concept from fundamentals, one small step at a time, checking understanding after each step. Use this when the user says they don't understand a diagram or explanation, asks to "walk me through from basics", says they're "not familiar with" the terms involved, or otherwise signals the previous explanation pitched above their current level. Typically follows the diagramming skill — the diagram gets shown, the user can't follow it, and this skill takes over.
argument-hint: [topic to explain]
---

Walk the user through a concept from wherever they currently are, building up one piece at a time, confirming understanding after each piece before moving on.

Topic (if specified): $ARGUMENTS

## When this skill kicks in

The trigger is almost always a user saying some version of "I don't get it" after a diagram or dense explanation. Signals include:
- "I can't understand"
- "not familiar with [terms]"
- "walk me through from basics"
- "ELI5" / "explain it simply"
- "one thing at a time"
- long silence or a confused follow-up question that misses the frame of what you said

When you see this, do NOT just re-explain the same thing with different words. Switch into the progressive mode below.

## The flow

### Step 1 — Probe their starting level with a quick MCQ

Before explaining anything, find out what they already know. Ask a single multiple-choice question (3-4 options) aimed at the most foundational concept involved in the topic. The options should span from "knows nothing about this area" to "already knows the basics."

The goal is diagnostic, not a test — phrase it gently. The user's answer tells you where to start. Don't start higher than their answer suggests; slightly lower is fine and often better.

Example format:
```
Quick check so I pitch this right — which of these is closest to where you are?

  A) Never heard of [foundational concept]
  B) Heard of it, couldn't explain it
  C) Roughly know what it is, fuzzy on details
  D) Comfortable with it, the confusion is about [specific higher thing]
```

If the topic has multiple independent foundations, you can ask one MCQ per foundation — but usually one is enough to calibrate.

### Step 2 — Build up one concept per section

Once you know their level, explain one concept at a time. Each section should:

- Introduce **one** idea (not two, not a bundle)
- Be short — a few sentences, maybe a small ASCII sketch
- Use behavioral language (see diagramming skill principles — describe what *happens*, not what code is called)
- End with an explicit check: "**Check:** clear on X?"

Then **stop and wait**. Do not continue to the next section in the same message. The user's confirmation (or correction) is what tells you it's safe to proceed.

### Step 3 — Handle the response

**If they confirm ("yes", "clear", "got it"):** proceed to the next section. Keep the momentum — don't re-summarize what they just confirmed.

**If they correct or push back:** treat the correction as load-bearing. Update the example, acknowledge the fix briefly, and re-run the check on the *same* section. Do not move on until the corrected version lands. A correction usually means your example was slightly wrong in a way that would compound later — fix it now.

**If they ask a tangent question ("but why not X?", "does that mean Y?"):** address the tangent fully before returning to the main arc. Curiosity branches are signals that their mental model is forming — feed them. After answering, either pick up where you left off or, if the tangent reshaped things, acknowledge that and adjust.

**If they seem lost or the check goes unanswered:** back up. The section was probably too big or assumed something they don't have. Try a smaller piece or a different angle.

### Step 4 — Recap at the end

Once the full arc is covered, give a short numbered recap — the chain of ideas from foundation to conclusion. This consolidates the sequence and gives them a mental index to refer back to.

## Style guidelines

**One idea per message.** The core discipline of this skill is restraint. It's tempting to pack three sections into one message to save turns; don't. The waiting-for-confirmation is the mechanism — it's what lets the user catch misunderstandings before they compound, and it's what lets you calibrate pace.

**Personify components when explaining behavior.** Saying "the popup manager thinks 'there's a `/` near the cursor — open!'" builds understanding faster than "the plugin's activation predicate returns true." This is from the diagramming skill and applies here too.

**Small ASCII sketches are welcome** but not required for every section. Use them when a picture genuinely clarifies a relationship or sequence; skip them when prose is cleaner.

**Keep examples concrete and grounded in the user's actual situation** when possible. If the explanation is about a bug in their codebase, use names and scenarios from their code, not generic `foo`/`bar`. This is also why corrections matter so much — a wrong concrete example pollutes the rest of the arc.

**Don't hedge or over-qualify.** "This might be kind of like sort of..." wastes the user's attention. State the idea directly, then check.

## What this skill is NOT

- **Not a lecture.** If you find yourself writing three paragraphs without a check-in, stop and cut.
- **Not a glossary dump.** Don't define ten terms upfront. Introduce each term only when you need it.
- **Not a replacement for the diagramming skill.** Diagrams are still great — use them within sections. This skill controls the *pacing and interaction*, not the visual format.
- **Not for users who already understand.** If the user seems to be following fine, don't downshift into this mode unprompted. It can feel patronizing.
