# Engineering Standards & Guidelines

## 1. Core Philosophy

- **Forward Momentum**: We are in rapid prototyping. Always aim for the best design. **NEVER** consider backward compatibility or compromise for legacy concerns.
- **Zero Tech Debt**: Fix it now or remove it. **NEVER** knowingly carry tech debt.
- **Documentation Grounding**: Assumptions drift; documentation grounds us. Prefer verifiable sources over intuition.

## 2. Documentation & Dependencies

- **Context7 is Authority**: Always use `context7` for official documentation, API contracts, and migration notes before committing to an approach.
- **Dependency Verification**: Confirm every external dependency against `context7` to ensure alignment with the latest ecosystem guidance.

## 3. Technology Standards

### Package Management
- **Use npm**: Maintain consistency to prevent lock file conflicts and ensure reproducible builds.

### TypeScript
**Philosophy: Let the compiler infer. Minimize manual type writing.**

- **Inference**: Trust TypeScript's inference. Every hand-written type is a maintenance burden.
- **Annotations**:
  - **REQUIRED**: Function parameters, class properties, uninitialized variables.
  - **FORBIDDEN**: Return types, intermediate variables, callback parameters (when inference suffices).
- **Modeling**: Prefer composition (`{ user: User; isAdmin: boolean }`) over extension. Derive types from implementations (`ReturnType`, `z.infer`) rather than duplicating.
- **Justification Test**: If the compiler can infer it, delete the manual type.

## 4. Communication & Rationale

- **Self-Documenting Code**: Names and structure should carry the narrative.
- **Strategic Commenting**: Use comments *only* to capture **rationale**:
  - **Why**: Explain decisions where alternatives were viable.
  - **Trade-offs**: Record architectural trade-offs to inform future work.
  - **Breadcrumbs**: Provide context for future AI agents and teammates on broader strategy.
