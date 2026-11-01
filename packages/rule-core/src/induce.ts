import type { Cluster } from './cluster.js';
import type { Rule, RuleKind } from './types.js';
import { hashString } from './hash.js';

export interface InduceOptions {
  /** A rule needs at least this many corrections behind it. Default 2. */
  minSupport?: number;
  /** How many example contexts to keep per rule. Default 3. */
  maxExamples?: number;
}

const KIND_BY_CLUSTER: Record<Cluster['kind'], RuleKind> = {
  delete: 'forbid',
  replace: 'rewrite',
  insert: 'prefer',
};

/**
 * Turn clusters into candidate rules.
 *
 * Only clusters seen at least `minSupport` times become rules: a single edit is
 * an anecdote, not a rule. Clusters that would produce a rule whose replacement
 * re-introduces the trigger are dropped here rather than later, because such a
 * rule can never terminate.
 */
export function induceRules(clusters: readonly Cluster[], options: InduceOptions = {}): Rule[] {
  const minSupport = options.minSupport ?? 2;
  const maxExamples = options.maxExamples ?? 3;
  const total = clusters.reduce((sum, cluster) => sum + cluster.ops.length, 0) || 1;

  const rules: Rule[] = [];
  const seen = new Set<string>();

  for (const cluster of clusters) {
    const support = cluster.ops.length;
    if (support < minSupport) continue;

    const kind = KIND_BY_CLUSTER[cluster.kind];
    const findRaw = kind === 'prefer' ? cluster.afterSpan : cluster.beforeSpan;
    const replaceRaw = kind === 'prefer' ? '' : cluster.afterSpan;

    const find = findRaw.trim();
    const replace = replaceRaw.trim();
    if (find.length < 2) continue;
    if (kind === 'rewrite' && replace === '') continue;
    if (kind === 'rewrite' && replace.toLowerCase().includes(find.toLowerCase())) continue;

    const key = `${kind}|${find.toLowerCase()}|${replace.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rules.push({
      id: `r${hashString(key).toString(16).slice(0, 6)}`,
      kind,
      find,
      replace,
      support,
      confidence: Math.min(1, support / total),
      examples: cluster.ops.slice(0, maxExamples).map((op) => `${op.contextBefore}[${op.beforeSpan}]${op.contextAfter}`),
    });
  }

  return rules.sort((a, b) => b.support - a.support || (a.id < b.id ? -1 : 1));
}
