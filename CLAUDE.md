# Code of Conduct

We write software that feels intentional. Beauty, composure, and clarity matter because readers inherit every decision we make.

## Code Style Hierarchy

Our hierarchy prevents churn and maintains a unified voice:

1. **Elegant** – Solutions should feel crafted, not improvised.
2. **Simple** – Favor the obvious path; cleverness is a last resort.
3. **Clean and clear** – Structure code so intent is unmistakable.
4. **Concise** – Remove redundancy without obscuring meaning.
5. **Short** – Compress only after hitting the points above.

## Design Principles

- Default to **elegant, minimal technical design**.
- Compose systems so each module has one purpose and one truth.
- Optimize for readability first; performance or novelty comes later.
- When uncertain, choose the option that future readers will understand fastest.
- **Never consider backward compatibility.** We're in rapid prototyping—always aim for the best design and avoid compromises driven by legacy concerns.
- **Never carry tech debt.** Fix it now or don't ship it. Debt compounds faster than velocity—every shortcut becomes a tax on future work.

## Documentation & Best Practices

- **Always use context7 for official documentation.** Pull current recommendations, API contracts, and migration notes before committing to an approach.
- Confirm every external dependency against context7 to stay aligned with the latest ecosystem guidance.
- Prefer verifiable sources over intuition; assumptions drift, documentation grounds us.

## Module Organization

- **Barrel files are forbidden.** Import directly from the defining module to protect the dependency graph and compiler performance.
- Keep each module responsible for its own exports; duplication violates the single-source-of-truth rule.

## Package Management

- **Always use npm.** Consistency in package management prevents lock file conflicts and ensures reproducible builds across the team.

## Comment & Rationale Guidelines

- Write self-documenting code; names and structure carry the narrative.
- Use comments sparingly and intentionally to **capture rationales**:
  - Explain **why a decision was made**, especially when alternatives were viable.
  - Record **architectural trade-offs** so future work builds on context, not guesswork.
  - Provide **breadcrumbs for future AI agents and teammates** when choices affect broader strategy.
- Avoid restating what the code already shows. If the behavior needs narration, refactor until it speaks for itself.

## Agent Skills

- **Always invoke the [`writing-typescript`](.claude/skills/writing-typescript/SKILL.md) skill** before writing or editing TypeScript code. This skill defines our type philosophy and coding standards.
