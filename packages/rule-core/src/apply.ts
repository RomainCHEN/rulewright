import type { Finding, Rule } from './types.js';

export interface ApplyResult {
  findings: Finding[];
  /** Text after applying every rewrite/forbid rule once, left to right. */
  text: string;
}

/**
 * Run the accepted rules over a draft.
 *
 * Matches are found left to right and never overlap: once a span is claimed by a
 * rule, later rules skip it. This keeps the result independent of rule order for
 * non-overlapping rules and makes the output easy to diff.
 */
export function applyRules(text: string, rules: readonly Rule[]): ApplyResult {
  const findings: Finding[] = [];
  const claimed: Array<[number, number]> = [];
  const lowerText = text.toLowerCase();

  for (const rule of rules) {
    const needle = rule.find.toLowerCase();
    if (needle === '') continue;
    let at = lowerText.indexOf(needle);
    while (at !== -1) {
      const end = at + needle.length;
      const overlaps = claimed.some(([start, finish]) => at < finish && start < end);
      if (!overlaps) {
        claimed.push([at, end]);
        findings.push({
          ruleId: rule.id,
          start: at,
          end,
          match: text.slice(at, end),
          suggestion: rule.kind === 'forbid' ? '' : rule.replace,
          kind: rule.kind,
        });
      }
      at = lowerText.indexOf(needle, end);
    }
  }

  findings.sort((a, b) => a.start - b.start);

  let out = '';
  let cursor = 0;
  for (const finding of findings) {
    out += text.slice(cursor, finding.start);
    out += finding.suggestion;
    cursor = finding.end;
  }
  out += text.slice(cursor);

  return { findings, text: out };
}
