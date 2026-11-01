/**
 * Domain types for Rulewright.
 *
 * A corpus is a list of (before, after) pairs — the same sentence before and
 * after a human corrected it. The engine turns recurring corrections into
 * candidate rules and then tries to refute them against the corpus.
 */

export interface EditPair {
  id: string;
  before: string;
  after: string;
}

export type OpKind = 'insert' | 'delete' | 'replace';

export interface EditOp {
  kind: OpKind;
  /** Text removed from `before` ('' for an insert). */
  beforeSpan: string;
  /** Text added in `after` ('' for a delete). */
  afterSpan: string;
  /** Up to CONTEXT characters immediately before the span. */
  contextBefore: string;
  /** Up to CONTEXT characters immediately after the span. */
  contextAfter: string;
  pairId: string;
  /** 0-based word index where the change starts. */
  index: number;
}

export type RuleKind = 'rewrite' | 'forbid' | 'prefer';

export interface Rule {
  id: string;
  kind: RuleKind;
  /** Text the rule looks for (exact, case-insensitive by default). */
  find: string;
  /** Replacement; '' for forbid, the preferred text for prefer. */
  replace: string;
  /** How many corpus pairs produced this rule. */
  support: number;
  /** 0..1 — support divided by the size of the cluster's candidate pool. */
  confidence: number;
  /** Example contexts taken from the corpus, for review. */
  examples: string[];
}

export interface Refutation {
  ruleId: string;
  /** Corpus pair that refutes the rule. */
  pairId: string;
  reason: 'fires-but-was-not-corrected' | 'conflicts-with-accepted' | 'replacement-reintroduces-find';
  detail: string;
}

export interface Finding {
  ruleId: string;
  start: number;
  end: number;
  match: string;
  suggestion: string;
  kind: RuleKind;
}
