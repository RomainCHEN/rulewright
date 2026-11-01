import type { EditPair, Refutation, Rule } from './types.js';

export interface RefuteOptions {
  /** A rule is over-broad when it corrects fewer than this share of its sightings. */
  minPrecision?: number;
  /** Below this many sightings, precision is not judged at all. */
  minSightings?: number;
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let count = 0;
  let at = lowerHay.indexOf(lowerNeedle);
  while (at !== -1) {
    count += 1;
    at = lowerHay.indexOf(lowerNeedle, at + lowerNeedle.length);
  }
  return count;
}

/**
 * Try to kill each rule using the corpus itself.
 *
 * Three failure modes are checked:
 *
 * 1. the replacement re-introduces the trigger (the rule can never settle);
 * 2. the trigger appears in many `before` texts that nobody corrected, so the
 *    rule would fire on correct prose ("over-broad");
 * 3. two accepted rules match the same span with different replacements.
 */
export function refuteRules(
  rules: readonly Rule[],
  pairs: readonly EditPair[],
  options: RefuteOptions = {},
): Refutation[] {
  const minPrecision = options.minPrecision ?? 0.4;
  const minSightings = options.minSightings ?? 3;
  const refutations: Refutation[] = [];

  for (const rule of rules) {
    if (rule.kind === 'rewrite' && rule.replace.toLowerCase().includes(rule.find.toLowerCase())) {
      refutations.push({
        ruleId: rule.id,
        pairId: '*',
        reason: 'replacement-reintroduces-find',
        detail: `"${rule.replace}" still contains "${rule.find}", so applying the rule never settles`,
      });
      continue;
    }

    let sightings = 0;
    let corrected = 0;
    const uncorrectedExample: string[] = [];

    for (const pair of pairs) {
      const seen = countOccurrences(pair.before, rule.find);
      if (seen === 0) continue;
      sightings += seen;
      const wasCorrected = countOccurrences(pair.after, rule.find) < seen;
      if (wasCorrected) corrected += seen;
      else if (uncorrectedExample.length === 0) uncorrectedExample.push(pair.id);
    }

    if (sightings >= minSightings && corrected / sightings < minPrecision) {
      refutations.push({
        ruleId: rule.id,
        pairId: uncorrectedExample[0] ?? '*',
        reason: 'fires-but-was-not-corrected',
        detail: `"${rule.find}" appears ${sightings} times but was only corrected ${corrected} times (${Math.round(
          (corrected / sightings) * 100,
        )}%)`,
      });
    }
  }

  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const a = rules[i];
      const b = rules[j];
      if (!a || !b) continue;
      const sameTrigger = a.find.toLowerCase() === b.find.toLowerCase();
      const differentResult = a.replace !== b.replace || a.kind !== b.kind;
      if (sameTrigger && differentResult) {
        refutations.push({
          ruleId: b.id,
          pairId: a.id,
          reason: 'conflicts-with-accepted',
          detail: `both ${a.id} and ${b.id} match "${a.find}" with different outcomes`,
        });
      }
    }
  }

  return refutations;
}
