import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyRules,
  clusterOps,
  diffCorpus,
  diffPair,
  induceRules,
  refuteRules,
  tokenize,
  type EditPair,
  type Rule,
} from '../src/index.js';

const corpus: EditPair[] = [
  { id: 'p1', before: 'The team have finished the report.', after: 'The team has finished the report.' },
  { id: 'p2', before: 'Our group have finished the survey.', after: 'Our group has finished the survey.' },
  { id: 'p3', before: 'The team have left already.', after: 'The team has left already.' },
  { id: 'p4', before: 'She go to school every day.', after: 'She goes to school every day.' },
];

describe('tokenize', () => {
  it('keeps words, punctuation and spacing apart', () => {
    expect(tokenize("Don't stop.")).toEqual(["Don't", ' ', 'stop', '.']);
  });
});

describe('diffPair', () => {
  it('reports a single replace for have -> has', () => {
    const ops = diffPair(corpus[0]!);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.kind).toBe('replace');
    expect(ops[0]!.beforeSpan.trim()).toBe('have');
    expect(ops[0]!.afterSpan.trim()).toBe('has');
  });

  it('reports an insert when text is only added', () => {
    const ops = diffPair({ id: 'x', before: 'She goes school.', after: 'She goes to school.' });
    expect(ops.some((op) => op.kind === 'insert' && op.afterSpan.includes('to'))).toBe(true);
  });

  it('reports a delete when text is only removed', () => {
    const ops = diffPair({ id: 'y', before: 'It was very unique.', after: 'It was unique.' });
    expect(ops.some((op) => op.kind === 'delete' && op.beforeSpan.trim() === 'very')).toBe(true);
  });

  it('returns nothing for an unchanged pair', () => {
    expect(diffPair({ id: 'z', before: 'Same text.', after: 'Same text.' })).toEqual([]);
  });

  it('keeps context around the change', () => {
    const ops = diffPair(corpus[0]!);
    expect(ops[0]!.contextBefore).toContain('team');
  });
});

describe('clusterOps + induceRules', () => {
  const clusters = clusterOps(diffCorpus(corpus));
  const rules = induceRules(clusters);

  it('clusters the three have->has corrections together', () => {
    const cluster = clusters.find((c) => c.beforeSpan === 'have' && c.afterSpan === 'has');
    expect(cluster?.ops).toHaveLength(3);
  });

  it('never produces more clusters than ops', () => {
    const ops = diffCorpus(corpus);
    expect(clusters.length).toBeLessThanOrEqual(ops.length);
  });

  it('drops rules whose replacement contains the trigger (they would never settle)', () => {
    // "go -> goes" is rejected: "goes" contains "go", so the rule could loop.
    const goRule = induceRules(clusterOps(diffCorpus([corpus[3]!])), { minSupport: 1 });
    expect(goRule).toHaveLength(0);
  });

  it('requires minSupport before calling something a rule', () => {
    const single = induceRules(clusterOps(diffCorpus([corpus[0]!])));
    expect(single).toHaveLength(0);
    const loosened = induceRules(clusterOps(diffCorpus([corpus[0]!])), { minSupport: 1 });
    expect(loosened).toHaveLength(1);
    expect(loosened[0]!.find).toBe('have');
  });

  it('induces a rewrite rule for have -> has', () => {
    const rule = rules.find((r) => r.find === 'have');
    expect(rule?.kind).toBe('rewrite');
    expect(rule?.replace).toBe('has');
    expect(rule?.support).toBe(3);
  });
});

describe('refuteRules', () => {
  const rules = induceRules(clusterOps(diffCorpus(corpus)));

  it('kills a rule whose replacement re-introduces the trigger', () => {
    const looping: Rule = { id: 'bad', kind: 'rewrite', find: 'have', replace: 'have not', support: 5, confidence: 1, examples: [] };
    const refutations = refuteRules([looping], corpus);
    expect(refutations.some((r) => r.reason === 'replacement-reintroduces-find')).toBe(true);
  });

  it('flags an over-broad rule that the corpus does not support', () => {
    const overBroad: Rule = { id: 'broad', kind: 'rewrite', find: 'the', replace: 'a', support: 2, confidence: 1, examples: [] };
    const refutations = refuteRules([overBroad], corpus);
    expect(refutations.some((r) => r.reason === 'fires-but-was-not-corrected')).toBe(true);
  });

  it('leaves a well-supported rule alone', () => {
    const have = rules.find((r) => r.find === 'have');
    expect(have).toBeDefined();
    const refutations = refuteRules([have!], corpus);
    expect(refutations).toHaveLength(0);
  });

  it('detects two rules fighting over the same trigger', () => {
    const a: Rule = { id: 'a', kind: 'rewrite', find: 'have', replace: 'has', support: 3, confidence: 1, examples: [] };
    const b: Rule = { id: 'b', kind: 'rewrite', find: 'have', replace: 'had', support: 2, confidence: 1, examples: [] };
    const refutations = refuteRules([a, b], corpus);
    expect(refutations.some((r) => r.reason === 'conflicts-with-accepted')).toBe(true);
  });
});

describe('applyRules', () => {
  const rules: Rule[] = [
    { id: 'r1', kind: 'rewrite', find: 'have', replace: 'has', support: 3, confidence: 1, examples: [] },
  ];

  it('rewrites matches and reports them', () => {
    const result = applyRules('The team have left.', rules);
    expect(result.text).toBe('The team has left.');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.match).toBe('have');
  });

  it('is idempotent when the replacement does not contain the trigger', () => {
    const once = applyRules('have have have', rules).text;
    expect(applyRules(once, rules).text).toBe(once);
  });

  it('never lets two findings overlap', () => {
    const result = applyRules('have', [
      rules[0]!,
      { id: 'r2', kind: 'forbid', find: 'ha', replace: '', support: 2, confidence: 1, examples: [] },
    ]);
    const spans = result.findings.map((f) => [f.start, f.end] as const);
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1]);
    }
  });

  it('deletes text for a forbid rule', () => {
    const result = applyRules('It was very unique.', [
      { id: 'r3', kind: 'forbid', find: 'very ', replace: '', support: 2, confidence: 1, examples: [] },
    ]);
    expect(result.text).toBe('It was unique.');
  });
});

describe('properties', () => {
  it('P1: diff of identical texts is always empty', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 120 }), (text) => {
        expect(diffPair({ id: 'p', before: text, after: text })).toEqual([]);
      }),
    );
  });

  it('P2: cluster count never exceeds op count', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 60 }), { maxLength: 6 }), (texts) => {
        const pairs = texts.map((t, i) => ({ id: `p${i}`, before: t, after: `${t} ok` }));
        const ops = diffCorpus(pairs);
        expect(clusterOps(ops).length).toBeLessThanOrEqual(ops.length);
      }),
    );
  });

  it('P3: applying rewrite rules twice equals applying them once', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (text) => {
        const rules: Rule[] = [{ id: 'r', kind: 'rewrite', find: 'aa', replace: 'bb', support: 2, confidence: 1, examples: [] }];
        const once = applyRules(text, rules).text;
        expect(applyRules(once, rules).text).toBe(once);
      }),
    );
  });

  it('P4: findings never overlap, for any rule set', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (text) => {
        const rules: Rule[] = [
          { id: 'a', kind: 'rewrite', find: 'a', replace: 'b', support: 1, confidence: 1, examples: [] },
          { id: 'b', kind: 'forbid', find: 'b', replace: '', support: 1, confidence: 1, examples: [] },
        ];
        const spans = applyRules(text, rules).findings.map((f) => [f.start, f.end] as const);
        for (let i = 1; i < spans.length; i += 1) {
          expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1]);
        }
      }),
    );
  });
});
