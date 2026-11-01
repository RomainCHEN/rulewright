# Tasks — Rule distiller

- [x] 1. Tokeniser + word-level LCS diff
- [x] 2. Merge adjacent delete+insert into `replace`, keep 48 chars of context
- [x] 3. Cluster ops by (kind, before, after), rank by support
- [x] 4. Induce rules with guards: minSupport, trivial spans, looping replacements
- [x] 5. Refuter: looping / over-broad / conflicting rules
- [x] 6. Apply rules with non-overlapping, ordered findings
- [x] 7. 23 unit + property tests (P1–P5)
- [ ] 8. Studio page: corpus editor, cluster view, refutation report, draft checker
- [ ] 9. CLI: `rulewright distill corpus.json > rules.yaml`
- [ ] 10. Kiro CLI audit of the core against this spec
- [ ] 11. Run the `rule-refuter` agent on a real corpus and keep the transcript
- [ ] 12. Demo video, README with screenshots, deploy to Pages
