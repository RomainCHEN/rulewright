---
inclusion: always
---

# Product: Rulewright

## What this is

Rulewright turns a corpus of **before → after** corrections into a small set of **reviewable,
machine-checkable rules**, and then tries hard to kill those rules using the corpus itself.

The audience is anyone who maintains a house style: a teacher marking Cambridge exam items, an
editor enforcing a tone guide, a team maintaining a prompt or a rubric. They all have corrections
that keep recurring and no way to turn the pattern into something checkable.

## The loop

1. paste a corpus of corrected pairs (or point the CLI at a JSON file);
2. the engine diffs each pair, clusters the recurring edits, and proposes rules;
3. a **refuter** attacks every candidate with counterexamples from the same corpus;
4. a human accepts or rejects each surviving rule;
5. accepted rules run over a new draft and produce findings.

## Why the "refute" step exists

Any tool can mine frequent edits. What makes a rule trustworthy is knowing where it is wrong.
Rulewright's headline claim is that **a rule you cannot refute is a rule you can ship** — so the
refutation report is a first-class output, not a warning.

## Non-goals

- No LLM in the demo path. Everything is deterministic and runs offline.
- No accounts, no database, no server.
- Not a grammar checker: it learns only from the corpus it is given.
