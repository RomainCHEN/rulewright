# Design — Rule distiller

## Pipeline

```
corpus (before/after pairs)
   │  diff.ts      word-level LCS diff → ops with 48 chars of context
   ▼
ops        insert | delete | replace
   │  cluster.ts   key = kind + normalised(before) + normalised(after)
   ▼
clusters   ranked by support (how many corrections back it)
   │  induce.ts    cluster → rule, with guards (minSupport, trivial spans, loops)
   ▼
candidate rules
   │  refute.ts    counterexample search over the same corpus
   ▼
surviving rules + refutation report  →  human accepts
   │  apply.ts     non-overlapping, left-to-right findings on a new draft
   ▼
findings
```

## Why the guards live in induction, not refutation

A rule that can never terminate ("go → goes": the replacement contains the trigger) is a *shaping*
problem, not a judgement problem, so it is dropped before a human ever sees it. The refuter is
reserved for rules that are well-formed but might be wrong.

## Ordering and determinism

- Clusters are ranked by support descending, ties broken by the cluster key.
- Rules are ranked the same way, ties broken by id.
- Ids are `r` + a 24-bit FNV-1a hash of `kind|find|replace` (lowercased), so a rule keeps its id
  across runs and across machines.

## The refuter's three checks

| Check | What it means | Why it matters |
|---|---|---|
| `replacement-reintroduces-find` | the rule would loop | the tool would be unusable |
| `fires-but-was-not-corrected` | the trigger appears in correct prose | the rule would nag on good text |
| `conflicts-with-accepted` | two rules disagree about the same span | the human must choose |

## Trade-offs

- Character/substring matching, not grammar. The tool claims only "the corpus supports this".
- Clustering is exact after normalisation: near-duplicates ("have" vs "has") stay apart, which
  keeps the rule surface honest at the cost of more clusters.
