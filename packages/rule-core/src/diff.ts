import type { EditOp, EditPair } from './types.js';

/** How many characters of context are kept on each side of a change. */
export const CONTEXT = 48;

/** Split text into word/punctuation/space tokens so diffs stay human-sized. */
export function tokenize(text: string): string[] {
  return text.match(/\s+|[A-Za-z0-9']+|[^\sA-Za-z0-9']/g) ?? [];
}

interface LcsTable {
  table: Uint32Array;
  width: number;
}

function lcsTable(a: readonly string[], b: readonly string[]): LcsTable {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + (j + 1)] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + (j + 1)] ?? 0);
    }
  }
  return { table, width };
}

interface RawChange {
  kind: 'equal' | 'insert' | 'delete';
  text: string;
  beforeIndex: number;
}

function walkDiff(a: readonly string[], b: readonly string[]): RawChange[] {
  const { table, width } = lcsTable(a, b);
  const changes: RawChange[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      changes.push({ kind: 'equal', text: a[i] ?? '', beforeIndex: i });
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + (j + 1)] ?? 0)) {
      changes.push({ kind: 'delete', text: a[i] ?? '', beforeIndex: i });
      i += 1;
    } else {
      changes.push({ kind: 'insert', text: b[j] ?? '', beforeIndex: i });
      j += 1;
    }
  }
  while (i < a.length) {
    changes.push({ kind: 'delete', text: a[i] ?? '', beforeIndex: i });
    i += 1;
  }
  while (j < b.length) {
    changes.push({ kind: 'insert', text: b[j] ?? '', beforeIndex: j });
    j += 1;
  }
  return changes;
}

function contextAround(tokens: readonly string[], at: number): { before: string; after: string } {
  const before = tokens.slice(Math.max(0, at - 12), at).join('');
  const after = tokens.slice(at, at + 12).join('');
  return {
    before: before.slice(-CONTEXT),
    after: after.slice(0, CONTEXT),
  };
}

/**
 * Word-level diff of one pair, collapsed into insert / delete / replace ops.
 *
 * Adjacent delete+insert runs are merged into a single `replace` so a reviewer
 * sees "had → has", not two separate edits.
 */
export function diffPair(pair: EditPair): EditOp[] {
  const beforeTokens = tokenize(pair.before);
  const afterTokens = tokenize(pair.after);
  const raw = walkDiff(beforeTokens, afterTokens);

  const ops: EditOp[] = [];
  let pendingDeleted = '';
  let pendingInserted = '';
  let pendingIndex = 0;
  let seenChange = false;

  const flush = () => {
    if (pendingDeleted === '' && pendingInserted === '') return;
    const { before, after } = contextAround(beforeTokens, pendingIndex);
    const kind = pendingDeleted === '' ? 'insert' : pendingInserted === '' ? 'delete' : 'replace';
    ops.push({
      kind,
      beforeSpan: pendingDeleted,
      afterSpan: pendingInserted,
      contextBefore: before,
      contextAfter: after,
      pairId: pair.id,
      index: pendingIndex,
    });
    pendingDeleted = '';
    pendingInserted = '';
  };

  for (const change of raw) {
    if (change.kind === 'equal') {
      flush();
      seenChange = false;
      continue;
    }
    if (!seenChange) {
      pendingIndex = change.beforeIndex;
      seenChange = true;
    }
    if (change.kind === 'delete') pendingDeleted += change.text;
    else pendingInserted += change.text;
  }
  flush();

  return ops;
}

/** Diff every pair in a corpus. */
export function diffCorpus(pairs: readonly EditPair[]): EditOp[] {
  return pairs.flatMap((pair) => diffPair(pair));
}
