---
description: Guided development workflow for apps/desktop/src/main/. USE PROACTIVELY when developing features, refactoring, or making significant changes in the main process.
argument-hint: [task-description]
---

# Develop Main

Architecture: [architecture.md](./architecture.md)

## Phase 0: Setup

Create todos using TodoWrite to track this workflow:
- [ ] Research & Exploration
- [ ] Gap Analysis & Clarification
- [ ] Design & Approval
- [ ] Implementation Planning
- [ ] Execution
- [ ] Quality Review

## Phase 1: Research & Exploration

1. Read relevant documentation (use context7 for external docs)
2. Understand the task requirements
3. Explore codebase using **parallel Explore agents** with specific questions

Update todo on completion.

## Phase 2: Gap Analysis

1. Identify gaps in understanding
2. Ask clarification questions using AskUserQuestion
3. Present conclusion and justification
4. Wait for user confirmation before proceeding

Update todo on completion.

## Phase 3: Design & Approval

1. Design the final solution based on findings
2. Present concisely:
   - Components to create/modify
   - Data flows
   - Key decisions
3. **Wait for explicit user approval**

Update todo on completion.

## Phase 4: Implementation Planning

**Mandatory**: Add sub-todos based on approved solution:
- One per file/component
- Include dependencies
- Track throughout execution

## Phase 5: Execution

1. Execute the approved plan
2. Use **parallel general-purpose agents** for focused code editing
3. Keep todos up to date as work progresses

## Phase 6: Quality Review

1. Run **parallel review agents** for:
   - Code quality
   - Architecture compliance
   - Convention compliance
2. Summarize and fix issues
3. Mark workflow complete

---

**Reminder**: Use tools and agents proactively! Keep todos synchronized throughout.
