---
inclusion: always
---

# Tech

- TypeScript (strict, `noUncheckedIndexedAccess`), ES2022, ESM.
- npm workspaces; Vitest for tests; fast-check for property tests.
- `packages/rule-core` is pure: no DOM, no React, no I/O, no `Date.now()`, no `Math.random()`.
- The UI is one page (React + Vite) that imports the core directly; it never re-implements logic.
- Determinism rules: every ordering is explicit and stable; ties break on a stable key, never on
  object key order or file order.

## Commands

```bash
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # builds the studio into dist/
```
