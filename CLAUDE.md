# Code of Conduct

## Code Style Hierarchy

**Mandatory code style priority (in order):**

1. **Elegant** - Code should be beautiful and well-composed
2. **Simple** - Code should be straightforward and easy to understand
3. **Clean and clear** - Code should be readable and maintainable
4. **Concise** - Code should be brief without sacrificing clarity
5. **Short** - Code should be compact when all above criteria are met

## Design Principles

- Always default to **elegant, minimal technical design**
- Prioritize beauty and composition in code architecture
- Simplicity takes precedence over cleverness
- Clarity is more important than brevity
- When in doubt, choose the more elegant solution
- **Single source of truth** - Enforce single source of truth anytime anywhere to prevent duplication and maintain consistency

## Documentation & Best Practices

- **Always use context7 for official documentation** - Before implementing features or making architectural decisions, consult the latest official documentation via context7
  - Get current best practices and conventions for any library or framework
  - Verify API usage and patterns against up-to-date sources
  - Ensure alignment with the latest official recommendations
- **Prefer official sources over assumptions** - When uncertain about implementation details, query context7 rather than relying on potentially outdated knowledge
- **Stay current with ecosystem changes** - Libraries and frameworks evolve; use context7 to access the most recent documentation and migration guides

## Module Organization

- **Strictly forbid barrel files** - Never create files that re-export multiple items from other modules (e.g., `export * from './module'`)
  - Barrel files slow down builds by forcing the compiler to parse them for side-effects
  - Import directly from source modules instead: `import { X } from './module/source'` not `import { X } from './module'`
  - Each module should be imported explicitly from its own file
  - This rule applies to the entire monorepo without exception

## Comment Style

- **Code should be self-documenting** - Write code that explains itself through clear naming and structure
- **Comments are for specific purposes only:**
  - Explain **why**, never **what** - Rationales and reasoning, not code behavior
  - Document **architectural decisions** - Why certain approaches were chosen over alternatives
  - Provide **context for future AI agents** - Inform consistent thinking and decision-making
- **Avoid code-explaining comments** - They are redundant when code is properly written
- **Do not add comments beyond the stated purposes** - If the code needs explanation, refactor it to be clearer
