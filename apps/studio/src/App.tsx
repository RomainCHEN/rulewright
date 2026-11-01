import { useMemo, useState } from 'react';
import {
  applyRules,
  clusterOps,
  diffCorpus,
  induceRules,
  refuteRules,
  type EditPair,
  type Rule,
} from '@rulewright/core';

const SAMPLE = `The team have finished the report. => The team has finished the report.
Our group have finished the survey. => Our group has finished the survey.
The team have left already. => The team has left already.
It was very unique. => It was unique.
That design was very unique too. => That design was unique too.
It was very clear from the start. => It was very clear from the start.
That is very clear to me. => That is very clear to me.
The rules are very clear here. => The rules are very clear here.
Everyone was very clear about it. => Everyone was very clear about it.`;

/** Parse "before => after" lines, ignoring blank lines and comments. */
function parseCorpus(text: string): EditPair[] {
  const pairs: EditPair[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;
    const at = trimmed.indexOf('=>');
    if (at === -1) return;
    pairs.push({
      id: `p${index + 1}`,
      before: trimmed.slice(0, at).trim(),
      after: trimmed.slice(at + 2).trim(),
    });
  });
  return pairs;
}

const REFUTATION_COPY: Record<string, string> = {
  'replacement-reintroduces-find': 'the replacement still contains the trigger — this rule never settles',
  'fires-but-was-not-corrected': 'fires on prose nobody corrected — this rule would nag',
  'conflicts-with-accepted': 'two rules disagree about the same span',
};

export function App(): JSX.Element {
  const [corpusText, setCorpusText] = useState(SAMPLE);
  const [draft, setDraft] = useState('The team have finished the survey, and the results was very clear.');
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const pairs = useMemo(() => parseCorpus(corpusText), [corpusText]);

  const analysis = useMemo(() => {
    const ops = diffCorpus(pairs);
    const clusters = clusterOps(ops);
    const candidates = induceRules(clusters);
    const refutations = refuteRules(candidates, pairs);
    return { ops, clusters, candidates, refutations };
  }, [pairs]);

  const refutedIds = useMemo(
    () => new Set(analysis.refutations.map((r) => r.ruleId)),
    [analysis.refutations],
  );

  const accepted = useMemo(
    () => analysis.candidates.filter((rule) => !refutedIds.has(rule.id) && !rejected.has(rule.id)),
    [analysis.candidates, refutedIds, rejected],
  );

  const check = useMemo(() => applyRules(draft, accepted), [draft, accepted]);

  const toggleReject = (id: string) => {
    setRejected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className="rw-shell">
      <header className="rw-header">
        <p className="rw-eyebrow">Rulewright</p>
        <h1 className="rw-title">Rules you can refute.</h1>
        <p className="rw-subtitle">
          Paste sentences before and after a human corrected them. Rulewright finds the edits that
          keep recurring, proposes them as rules, and then tries to kill each one with
          counterexamples from the same corpus. What survives is a rule you can ship.
        </p>
        <p className="rw-badge">
          {pairs.length} pairs · {analysis.ops.length} edits · {analysis.clusters.length} clusters ·{' '}
          {analysis.candidates.length} candidate rules · {analysis.refutations.length} refuted
        </p>
      </header>

      <section className="rw-panel">
        <div className="rw-panel-head">
          <h2>Corpus</h2>
          <span className="rw-muted">one correction per line: before =&gt; after</span>
        </div>
        <textarea
          className="rw-textarea"
          value={corpusText}
          spellCheck={false}
          onChange={(event) => setCorpusText(event.target.value)}
          rows={9}
        />
      </section>

      <section className="rw-panel">
        <div className="rw-panel-head">
          <h2>Candidate rules</h2>
          <span className="rw-muted">refuted rules stay visible — that is the point</span>
        </div>
        <ul className="rw-rules">
          {analysis.candidates.map((rule: Rule) => {
            const refutation = analysis.refutations.find((r) => r.ruleId === rule.id);
            const isRejected = rejected.has(rule.id);
            return (
              <li
                key={rule.id}
                className={`rw-rule ${refutation ? 'rw-rule-dead' : ''} ${isRejected ? 'rw-rule-off' : ''}`}
              >
                <div className="rw-rule-head">
                  <span className={`rw-kind rw-kind-${rule.kind}`}>{rule.kind}</span>
                  <code className="rw-find">{rule.find}</code>
                  <span className="rw-arrow">→</span>
                  <code className="rw-replace">{rule.replace || '(remove)'}</code>
                  <span className="rw-support">×{rule.support}</span>
                </div>
                {refutation ? (
                  <p className="rw-refutation">
                    <strong>{refutation.reason}</strong> — {REFUTATION_COPY[refutation.reason] ?? refutation.detail}
                  </p>
                ) : (
                  <p className="rw-example">{rule.examples[0] ?? ''}</p>
                )}
                <button
                  type="button"
                  className="rw-toggle"
                  onClick={() => toggleReject(rule.id)}
                  disabled={Boolean(refutation)}
                >
                  {refutation ? 'refuted' : isRejected ? 'rejected — undo' : 'accepted — reject'}
                </button>
              </li>
            );
          })}
          {analysis.candidates.length === 0 ? (
            <li className="rw-empty">No rule repeats yet. A single correction is an anecdote.</li>
          ) : null}
        </ul>
      </section>

      <section className="rw-panel">
        <div className="rw-panel-head">
          <h2>Check a draft</h2>
          <span className="rw-muted">{accepted.length} accepted rules</span>
        </div>
        <textarea
          className="rw-textarea rw-textarea-short"
          value={draft}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
        />
        <div className="rw-check">
          <p className="rw-check-label">Findings</p>
          {check.findings.length === 0 ? (
            <p className="rw-empty">Nothing to report.</p>
          ) : (
            <ul className="rw-findings">
              {check.findings.map((finding, index) => (
                <li key={`${finding.ruleId}-${finding.start}-${index}`}>
                  <code>{finding.match}</code> → <code>{finding.suggestion || '(remove)'}</code>
                  <span className="rw-muted"> at {finding.start}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="rw-check-label">Rewritten</p>
          <pre className="rw-output">{check.text}</pre>
        </div>
      </section>

      <footer className="rw-footer">
        Rulewright — deterministic, offline, MIT. Built spec-first in Kiro for Kiroween 2026.
      </footer>
    </main>
  );
}
