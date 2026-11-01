# Requirements — Rule distiller

## Requirements (EARS)

- **R1** — WHEN a pair of texts is diffed, THE System SHALL return only insert, delete or replace
  operations, with adjacent delete+insert runs merged into one `replace`.
- **R2** — WHEN an operation is produced, THE System SHALL attach at most 48 characters of context
  on each side, taken from the `before` text.
- **R3** — WHEN two pairs differ only in whitespace or letter case, THE System SHALL place them in
  the same cluster.
- **R4** — WHEN a cluster has fewer than `minSupport` corrections (default 2), THE System SHALL NOT
  propose it as a rule.
- **R5** — WHEN a `rewrite` rule's replacement still contains its trigger, THE System SHALL drop
  the rule at induction time (it could never settle).
- **R6** — WHEN rules are refuted, THE System SHALL report every rule whose trigger appears at
  least `minSightings` times but is corrected less than `minPrecision` of the time.
- **R7** — WHEN two rules match the same trigger with different outcomes, THE System SHALL report a
  `conflicts-with-accepted` refutation naming both ids.
- **R8** — WHEN rules are applied to a draft, THE System SHALL never emit two findings whose spans
  overlap.
- **R9** — WHEN rules are applied, THE System SHALL order findings by start offset, ascending.
- **R10** — THE System SHALL produce identical output for identical input (no clocks, no RNG).

## Property-based invariants

- **P1** — diffing a text against itself yields no operations, for any string.
- **P2** — the number of clusters never exceeds the number of operations.
- **P3** — applying a rewrite rule twice yields the same text as applying it once, when the
  replacement does not contain the trigger.
- **P4** — findings never overlap, for any text and any rule set.
- **P5** — rule ids are stable: the same (kind, find, replace) always produces the same id.
