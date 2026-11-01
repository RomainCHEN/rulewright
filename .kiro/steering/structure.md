---
inclusion: always
---

# Structure

| Path | Responsibility |
|---|---|
| `packages/rule-core/src/diff.ts` | word-level diff → insert/delete/replace ops with context |
| `packages/rule-core/src/cluster.ts` | group recurring ops into clusters |
| `packages/rule-core/src/induce.ts` | cluster → candidate rule (guards for trivial/looping rules) |
| `packages/rule-core/src/refute.ts` | counterexample search; the reason a rule is trustworthy |
| `packages/rule-core/src/apply.ts` | run accepted rules over a draft, non-overlapping |
| `apps/studio` | one page: corpus → clusters → rules → refutations → findings |
| `.kiro/` | steering, spec, hooks, custom agent — must stay at the repo root |

A new capability goes in the core first (with a property test), and only then into the studio.
