import type { EditOp, OpKind } from './types.js';

export interface Cluster {
  key: string;
  kind: OpKind;
  beforeSpan: string;
  afterSpan: string;
  ops: EditOp[];
}

/** Normalise a span so trivial whitespace/case differences do not split a cluster. */
export function normalise(span: string): string {
  return span.replace(/\s+/g, ' ').trim().toLowerCase();
}

function dominant(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = '';
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Group edit ops that represent the same correction.
 *
 * A cluster is keyed by (kind, normalised before span, normalised after span), which
 * is the coarsest grouping that still keeps "had → has" apart from "had → had not".
 * Within a cluster the most common raw span becomes the rule's surface form.
 */
export function clusterOps(ops: readonly EditOp[]): Cluster[] {
  const groups = new Map<string, EditOp[]>();

  for (const op of ops) {
    const before = normalise(op.beforeSpan);
    const after = normalise(op.afterSpan);
    if (before.length < 2 && after.length < 2) continue;
    const key = `${op.kind}|${before}|${after}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(op);
    else groups.set(key, [op]);
  }

  const clusters: Cluster[] = [];
  for (const [key, group] of groups) {
    const first = group[0];
    if (!first) continue;
    clusters.push({
      key,
      kind: first.kind,
      beforeSpan: dominant(group.map((op) => op.beforeSpan.replace(/\s+/g, ' ').trim())),
      afterSpan: dominant(group.map((op) => op.afterSpan.replace(/\s+/g, ' ').trim())),
      ops: group,
    });
  }

  return clusters.sort((a, b) => b.ops.length - a.ops.length || (a.key < b.key ? -1 : 1));
}
