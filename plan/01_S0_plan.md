## S0 — Monorepo & tooling bootstrap: Detailed Action Plan

### Objectives
- Establish a pnpm + Turborepo monorepo with initial app/package structure.
- Set up strict TypeScript, ESLint, Prettier, Vitest, and basic CI.
- Ensure repo installs, builds, and runs a placeholder test with zero type errors.

### Deliverables
- `pnpm` workspace with `apps/web`, `apps/desktop`. UI tokens/components live in `apps/web`.
- Shared `tsconfig` base; strict mode across workspace.
- ESLint + Prettier configured and runnable at root.
- Vitest configured at root and runnable across packages.
- Turborepo pipeline: build, lint, test, typecheck.
- Minimal CI workflow: lint + typecheck + test on push to `main`.
- `LICENSE` Apache-2.0 and base `README` with dev bootstrap steps.

### Step-by-step
1) Bootstrap monorepo
   - Initialize repo if needed; add `pnpm-workspace.yaml` with `apps/*` and `packages/*` globs.
   - Add root `package.json` with `packageManager`, `turbo`, and common scripts.
   - Add `.editorconfig`, `.gitignore`, and Prettier config.

2) Add workspace structure
   - Create `apps/web/` (empty placeholder), `apps/desktop/` (empty placeholder).
   - Add `package.json` to each with `type: module` and basic `build/test` scripts.

3) TypeScript strict
   - Root `tsconfig.base.json` with strict options (noImplicitAny, exactOptionalPropertyTypes, noUncheckedIndexedAccess, etc.).
   - Each project extends base; emit and module resolution set for Next/Electron as needed later.

4) Linting & formatting
   - ESLint at root with TS, import, React, and Jest/Vitest plugins; enable strict recommended rules.
   - Prettier config and ESLint-prettier integration.
   - Root scripts: `lint`, `format`, `format:check`.

5) Testing
   - Root Vitest config with jsdom + node environments support.
   - Add a placeholder test in `apps/web` to verify runner.

6) Turborepo
   - `turbo.json` with pipelines: `build`, `typecheck`, `lint`, `test` and cache configurations.
   - Wire root scripts to call `turbo run` tasks.

7) CI
   - Create `.github/workflows/ci.yml`: setup pnpm cache, install, run `lint`, `typecheck`, `test`.

8) Licensing & docs
   - Add `LICENSE` (Apache-2.0) and minimal `README.md` with install, build, test instructions.

### Scripts (root package.json)
```json
{
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### Verification (Exit criteria)
- `pnpm i && pnpm -w build` succeeds with 0 type errors.
- `pnpm -w test` runs a placeholder test and passes.
- CI run shows lint/typecheck/test all green.

### Risks & Mitigations
- Tooling version drift: Pin key tool versions and add Renovate later.
- Conflicting TS configs across apps: enforce extend from a single `tsconfig.base.json`.
- CI performance: enable pnpm + turbo caching; avoid redundant installs.

### Timebox
- 0.5–1 day including CI.


