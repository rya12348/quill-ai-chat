# Proof Mode: artifact-first verification for free models

**Status:** draft for approval — revision 2
**Date:** 2026-11-08
**Scope:** replace Team with Proof, a free-only mode built around independently written checks and a portfolio of candidate artifacts.
**Supersedes:** revision 1 (one writer + one repair). That flow preserved the writer's ceiling; this revision is designed to raise it.

---

## 1. What changed, and why

Revision 1 said: one strong free writer, check the answer, repair once. That is a trust feature. It stops a bad answer from being labelled good, but it cannot make a weak answer strong, because the only thing that ever writes is the same single model.

Revision 2 moves the quality into the artifact and the check:

> The model is a candidate generator. The product is the verifier. Many cheap candidates are allowed; only an artifact that passes independently written checks is presented as the answer.

Three concrete changes from revision 1:

1. **The test suite is authored independently of the candidate.** The solver never sees the tests; the test author never sees the solver's code. This is the single largest source of measured gain in the literature and the direct fix for our C1 failure.
2. **The output is the candidate that passed, not a synthesis of all candidates.** Merging drafts averages away the best one. Selection keeps it.
3. **Checks run inside the generation loop, not only after it.** A failed run produces an exact failure report and a bounded repair, with the repaired artifact re-checked.

Everything else in revision 1 that still holds — the browser sandbox, source-date checking, the honesty states, the no-green-without-a-check rule — is retained and tightened.

---

## 2. Thesis

Free models are not short of opinions. They are short of consequences.

The measured result makes this concrete. On the three riskiest scorecard tasks, a single strong free model and a three-model team both scored 4/9, with zero wins and three ties:

| Task | Single model | Team | What actually failed |
|---|---:|---:|---|
| C1, two largest numbers | 1/3 | 1/3 | Both returned `[]` or `[42]` for a short list. Both knew the requirement; nothing executed it. |
| R2, latest iPhone | 0/3 | 0/3 | Both called the iPhone 17 the latest phone. All lanes shared the same stale 2025 search results. |
| M3, average speed | 3/3 | 3/3 | Both correct: 36 mph from 2 h + 3 h. |
| **Total** | **4/9** | **4/9** | **No wins. Three ties.** |

That result is not evidence that teams are useless in general. It is evidence that **adding opinions does not add evidence**. Both failures are evidence failures: one requirement was never executed, and one fact was never dated-checked. Neither is fixed by a fourth model, a debate round, or a confidence label.

The design therefore rests on three claims, each of which is falsifiable in the spike in §17:

- **C1.** An independently authored test suite catches requirements that a model review misses.
- **C2.** Selecting the passing artifact beats merging candidates into prose.
- **C3.** A portfolio only pays when the verifier is stronger than the candidates; without one it is expensive noise.

If C1 and C2 fail on the scorecard, Proof should not ship. That is a real possible outcome, and the gate is written so it can fail.

---

## 3. Evidence and its limits

The design is informed by published results, not by our own measurements beyond the three tasks above. These are cited claims, not local findings:

- **Test-based selection.** CodeT-style execution of generated tests and selection of the program that passes them reports large pass@1 gains over plain sampling (reported around +18.8 on HumanEval). The gain comes from the tests being independent of the candidate, not from more samples.
  <https://arxiv.org/abs/2207.10397>
- **Generated tests for bug fixing.** SWT-Bench reports that generated tests roughly doubled the precision of bug-fix filtering versus patch-only judgement.
  <https://arxiv.org/abs/2406.12952>
- **Program optimization on a fixed model.** DSPy-style optimization of prompts and pipelines produces substantial gains without changing the model.
  <https://arxiv.org/abs/2310.03714>
- **Voting is not truth.** Self-consistency helps where the final answer is checkable; it is a vote, not a proof.
  <https://arxiv.org/abs/2203.11171>
- **Debate is unreliable as a default.** Debate and multi-agent critique frequently lose to self-consistency at equal compute, and can reduce accuracy over rounds.
  <https://arxiv.org/html/2509.05396>
- **Verifiers need to be real.** Generative verifiers and retrieval evaluators only help when they can actually reject bad candidates.
  <https://arxiv.org/abs/2408.15240>, <https://arxiv.org/abs/2403.03178>

Reading: the verifier is the ceiling. The best free model is only one candidate inside that ceiling.

---

## 4. The shape

```text
user request
  -> contract            task kind, must-haves, exact examples, freshness, checks
  -> evidence            retrieval only when the contract needs current facts
  -> portfolio           one candidate by default; 3-4 across providers when uncertain
  -> extraction          pull the artifact out of each reply (code, numbers, sources, structure)
  -> verifier battery    independent tests, execution, arithmetic, source dates, format
  -> selection           keep the artifact that passes; do not merge prose
  -> repair              bounded repair with the exact failing check (max 2)
  -> outcome             verified / warnings / failed / unverified
```

Two rules govern the whole flow:

- **Fail closed.** An unavailable check is `unknown`, never a pass. A surviving mutant invalidates the suite, not just the candidate.
- **No green without evidence.** The badge names the checks that ran. If none ran, the answer is unverified.

---

## 5. The contract

The contract is a small structured object derived from the request before generation. It is the specification the verifier grades against. It is not a second answer and it may not add requirements the user did not state.

```json
{
  "kind": "code",
  "asOf": "2026-11-08",
  "freshnessDays": null,
  "must": [
    { "id": "C1", "text": "returns the two largest values, duplicates included", "critical": true },
    { "id": "C2", "text": "lists with fewer than two numbers produce None or a clear error", "critical": true },
    { "id": "C3", "text": "includes three runnable examples", "critical": false }
  ],
  "examples": [
    { "input": "[5, 5, 1]", "output": "[5, 5]" }
  ],
  "code": { "language": "python", "entrypoint": "two_largest" }
}
```

Rules:

- **Deterministic extraction first.** Counts (“exactly five”), word limits, required sections, dates, “latest/current”, budget caps, units and “cite two sources” are parsed by rules, not by a model.
- **One small model call at most**, and only for implicit requirements the rules cannot express. It may not invent requirements.
- **Critical vs non-critical.** A critical check must pass for `verified`. A non-critical failure yields `warnings`.
- **Examples are executable.** Any example the user or the contract states is run verbatim.
- **The contract is visible.** The user sees the checks being attempted, so an unverified outcome has a stated reason.

### Task kinds

| Kind | Artifact | Real checks available | Portfolio |
|---|---|---|---|
| Code | program + test run | tests, execution, differential | yes |
| Math | final value + working | recomputation, units | no (one candidate, checked) |
| Research | answer + dated sources | page opens, date window, claim span | yes (query diversity) |
| Structured | answer + required parts | counts, sections, budget sum, units | no |
| Writing / general | answer | format only | no |

Writing and open-ended planning stay unverified where no external check exists. Proof does not claim frontier quality there, and does not spend a portfolio on it.

---

## 6. The test factory (core of the design)

This is the part that must be excellent. A weak suite makes the entire portfolio worthless and manufactures false confidence.

### 6.1 Separation of roles

Three independent calls, with no shared context beyond the contract:

1. **Solver.** Writes the artifact. Never sees the tests.
2. **Test author.** Writes the suite from the contract, the examples, and the request. Never sees the solver's artifact.
3. **Reference author.** Writes a second independent implementation from the contract only, for differential comparison. Different provider from the solver where possible.

If the same call wrote both the code and its tests, the suite tests what the code does, not what the request asked for. That is the failure mode this section exists to prevent.

### 6.2 What the suite must contain

Derived from the contract, in this order:

- **Stated examples, verbatim.** Every example in the request runs exactly as written.
- **Boundary and empty cases.** Empty input, one element, maximum size, zero, negative, duplicate values, missing optional fields, exactly-at-threshold values.
- **Property tests.** For “two largest”: `sorted(xs)[-2:]` equals the result for random lists with duplicates. For spend queries: the sum of grouped rows equals the ungrouped filtered sum. Properties catch whole classes of bug that example tests miss.
- **Failure-path tests.** The contract's stated error behavior: `None` vs raise, empty result vs error, short list vs crash.
- **Format assertions.** Length, counts, required sections, units.
- **No implementation-coupled tests.** No asserting on internal variable names, log lines, or exact wording the request did not require.

Budgets: at most 12 tests per suite, at most 5 seconds of runtime in the sandbox, at most 200 lines.

### 6.3 Hardening: the mutation gate

A suite is only trusted if it can reject plausible wrong solutions. Before it is used to judge the solver, the runner executes the suite against a small catalogue of **mutants**:

- off-by-one at a boundary;
- returns the wrong empty-case value (`[]` instead of `None`);
- deduplicates when it should not (or the reverse);
- ignores one clause of the request;
- hard-codes the stated examples;
- sorts ascending instead of descending;
- uses the wrong year or wrong column in a query;
- returns a plausible but unsupported value (for numeric tasks).

Mutants are generated once per contract (a cheap call, or a deterministic template for common shapes), not per candidate.

Gate:

- **All critical mutants must be killed.** If any survives, the suite is **not trusted**. The system does not silently lower the bar; it either repairs the suite once or marks the run `unverified` with a `weak tests` reason.
- The kill rate is recorded with the proof record, so the user and the eval can see whether a pass meant anything.
- A suite that fails the mutation gate cannot produce a `verified` outcome, regardless of what the candidate does.

This is the difference between “tests passed” and “tests were able to fail.” Only the second one is evidence.

### 6.4 Differential check

When a reference implementation exists:

1. Run both implementations on the property inputs.
2. If outputs agree, the suite's verdict is accepted.
3. If outputs disagree, the contract's tests are the tiebreaker.
4. If both pass the suite but disagree on an input the suite does not cover, the suite is treated as incomplete for that input: escalate to a second test round if budget allows, otherwise `warnings`, never `verified`.

Differential agreement is not proof, but disagreement is a reliable signal that something is under-specified. That is worth surfacing.

### 6.5 Test-author failure

The test author can be wrong too. Guard against it:

- A suite that does not parse or run is discarded, and the run downgrades to `unverified` — it does not fail the candidate.
- A suite that fails the reference implementation on a stated example is treated as a bad suite first, not a bad candidate.
- The repair message distinguishes “your code failed this check” from “the checks could not be trusted,” because the writer should not be asked to satisfy broken tests.

---

## 7. Portfolio and selection

### 7.1 When to spend more calls

Default: one candidate. Escalate only when the verifier cannot decide.

| Situation | Candidates |
|---|---|
| Trivial or conversational | 1 (no Proof) |
| Checkable, deterministic checks available | 1, checked |
| Code task with a trusted suite | 2 across providers |
| Check fails or differential disagrees | up to 4 |
| Research with freshness requirement | 2 query strategies, one answer |
| Writing / open-ended | 1, unverified |

The escalation rule is deliberately conservative: a portfolio is only worth its cost when there is a check that can choose between candidates. Four unchecked samples is the Team result again, with a larger bill.

### 7.2 Diversity

Candidates must come from different providers. Same-model samples share the same blind spots and the same stale retrieval; temperature does not buy independence. The lane picker prefers distinct hosts first, then fills.

### 7.3 Selection rule

Rank candidates by, in order:

1. number of critical checks passed;
2. suite strength (mutant kill rate, coverage of the contract);
3. fewer repair rounds;
4. shorter artifact;
5. provider health and latency, as a last tiebreak.

The winner is presented **as written**. There is no merge step. If the winner is missing a non-critical requirement, that becomes a warning, not a rewrite by a different model.

Exception, narrow and explicit: when two candidates each pass a **disjoint** set of checks and the contract requires both, the system may compose only the checked parts, and the composed result must be re-run through the full suite. If it cannot be re-checked, it is not composed. In practice this should be rare; the default is selection.

### 7.4 What a candidate is allowed to see

Each candidate sees the request, the contract's requirements, and the evidence. It does not see other candidates, the tests, the mutants, or the verifier's notes until a repair round. Independence is the point.

---

## 8. Execution and tools in the loop

Checks are not a final gate. The loop is:

```text
candidate -> extract -> run checks -> pass? finalize
                                   -> fail? exact failure report -> repair -> re-run (max 2)
                                   -> still fail? failed / warnings
```

### 8.1 Python runner

- Python only in v1.
- A dedicated `proof-runner` page in an opaque-origin iframe: `sandbox="allow-scripts"`, no `allow-same-origin`, no network, no storage, no cookies, no JS bridge.
- Pyodide pinned to a version, loaded lazily only for code proof.
- Fresh runner per run; the whole runner is terminated on timeout.
- Limits: 5 s wall clock, 64 MB output cap, 12 tests maximum.
- The Worker never executes generated code. The browser posts the result to a same-origin, owner-scoped endpoint.
- If the runner cannot load, the outcome is `unverified` with `code runner unavailable` — never a pass.

**Trust boundary, stated plainly:** the run result is client-attested. For a personal chat product this is acceptable — the client belongs to the person whose answer it is, and there is no incentive to forge a pass. It would not be acceptable for a shared or graded environment, and the design does not pretend otherwise.

### 8.2 Arithmetic

- Extract the claimed values and the expression; recompute with a bounded evaluator (no `eval`, no arbitrary code).
- Check units and the requested comparison (e.g., “why not 40 mph” is part of the contract for M3).
- Parse failure or ambiguity → `unknown`.

### 8.3 Tools are evidence providers

Search, the calculator, and the runner exist to produce evidence the model cannot argue with. They are not another place for a model to opine. A tool result is fed back verbatim; it is not summarized by a model before the verifier sees it.

---

## 9. Fresh retrieval and “latest”

The R2 failure was not a model failure. Every lane received the same 2025 snippet, so every lane was confidently wrong.

Changes:

- The contract carries `asOf` and `freshnessDays` for any “latest / current / price / who won / today” request.
- Queries include the current year **and** the entity's expected release cycle; a blind single query is not allowed for a freshness contract.
- The server opens up to three cited pages, not just snippets. Timeouts and byte caps apply.
- A current claim passes only if the URL opens, has a usable publication or update date, the date is inside the window, and the page contains the specific entity/value the claim names.
- **Staleness is a first-class failure.** A page dated before the window cannot support a “latest” claim. The answer is `unverified` and must say what it could not confirm.
- If sources disagree, the newer dated source wins, and the disagreement is shown.
- Search outages produce a notice and an unverified result, never a confident answer from memory.
- Queries for a portfolio are diversified (official source, hands-on review, pricing page) so candidates do not all inherit one bad result set.

This is deliberately a support check, not full entailment. It can confirm that the cited page is current and contains the named entity and value. It cannot prove that every sentence is entailed by the source, and the UI must not imply that it does.

---

## 10. Verified library

The only component that improves with use without a new model.

### 10.1 What is stored

Per user, in D1:

- **Verified exemplars:** contract signature → artifact → the suite that passed it → mutant kill rate → outcome.
- **Check recipes:** reusable, parameterized procedures, e.g. “resolve the latest version of a named product from a dated official page,” “validate a grouped spend query against a five-row fixture.”
- **Lane statistics:** which lane produced passing artifacts for which task kind, with counts.

### 10.2 Retrieval

- Signature = task kind + normalized intent + requirement shape (not raw text, to avoid storing conversation content unnecessarily).
- Retrieve the top 1–2 exemplars as few-shot context for the solver, and the matching recipe for the verifier.
- Never retrieve another user's artifact. The library is per-owner; a global library would leak conversation content and is out of scope.

### 10.3 Lifecycle

- An exemplar is written only after a `verified` outcome with a trusted suite.
- Promoted after 2 independent successes; demoted when its lane or recipe starts failing.
- Hard cap per user; oldest low-value entries evicted.
- Deleting a conversation or account deletes derived exemplars. The library is not a shadow history.

This is also the mechanism that makes routing measured rather than guessed: lane statistics are a by-product of normal use.

---

## 11. Honesty layer

Five states, with no confidence percentages:

- **Verified:** every critical check passed with a trusted suite.
- **Verified with warnings:** critical checks passed; at least one non-critical check failed or was unknown.
- **Failed:** a critical check still fails after the repair budget. Shown as a failed draft with the failing check named; withheld when the failure is dangerous (unsafe advice, wrong dosage, destructive command).
- **Unverified:** no reliable check was available or the check could not run. Still useful; never badged as checked.
- **Checking:** code is running. Never shows a pass badge.

The badge shows the count and, on expansion, each check with its evidence: tests passed, mutant kill rate, arithmetic result, source dates, format results. “Checked” is a claim about checks, not about truth.

What is explicitly banned:

- an LLM judge overriding a failed test or a stale source;
- a green badge when the suite failed the mutation gate;
- “high confidence” as a substitute for evidence;
- presenting a merged answer as verified when the merged text was never re-checked.

---

## 12. Product behavior and UI

- Composer: **Fast**, **Deep** (default), **Proof** (replaces Team).
- Old `team=on` setting is cleared on load so Team cannot stay active invisibly.
- Legacy Team messages stay readable with a “Legacy team” note; no new Team requests.
- Proof reply evidence line:
  - `Proof · 4/4 critical checks · tests verified against 3 mutants`
  - `Proof · 3/4 · 1 warning`
  - `Proof · unverified · no runnable check`
  - `Proof · failed · short-list case`
- The panel lists: contract requirements, checks, pass/fail/unknown, mutant kill rate, sources with dates, and the repair count. It does not show raw stdout in shares.
- Pending state: `Checking code…` with a cancel that leaves the reply unverified rather than hanging.
- Offline: saved proof records render; new code proofs are unavailable and labelled so.
- Mobile: the toggle stays in the existing compact control group.

---

## 13. Data and API shape

```ts
export type ProofStatus = 'checking' | 'verified' | 'warning' | 'failed' | 'unverified'
export type ProofCheckStatus = 'pass' | 'fail' | 'unknown'
export type ProofKind = 'code' | 'math' | 'research' | 'structured' | 'general'

export interface ProofCheck {
  id: string
  label: string
  status: ProofCheckStatus
  critical: boolean
  detail?: string        // short, user-safe; no stdout or page bodies
}

export interface ProofInfo {
  status: ProofStatus
  kind: ProofKind
  checks: ProofCheck[]
  attempts: number
  candidates: number
  mutants: { total: number; killed: number } | null
  models: string[]       // display names only
  asOf: number
  reason?: string        // e.g. 'weak tests', 'runner unavailable'
}
```

- `Message.proof?: ProofInfo`; `SharedMessage.proof?: ProofInfo`.
- `ChatEvent` gains `{ type: 'proof'; proof: ProofInfo }`.
- `ChatRequest.strategy: 'fast' | 'deep' | 'proof'` (`team` accepted only as a legacy alias that maps to deep, then removed).
- New tables:
  - `message_proof (message_id PK, owner_sub, content, created_at)` — joins in conversation, share, regenerate, delete, and account deletion paths, exactly like `message_team`.
  - `proof_runs (id, owner_sub, kind, outcome, models, checks, mutants_killed, mutants_total, attempts, latency_ms, created_at)` — statistics, no message content.
  - `proof_library (id, owner_sub, signature, kind, content, successes, failures, created_at, updated_at)` — verified exemplars and recipes.
- New endpoint `POST /api/proof/:messageId/result`: same-origin, signed-in owner, message must be in `checking` and belong to the caller, single use, payload cap, validated shape. It stores the run result; it never executes anything.
- Code proof timing: draft streams and persists with `status:'checking'`; the client runs and posts; the Worker finalizes, optionally repairs. If the client disappears, the record expires to `unverified` — never to a pass.

---

## 14. Budgets

- Contract: deterministic first; at most one small model call.
- Candidates: 1 by default, 2 on a code task with a trusted suite, up to 4 only on uncertainty; distinct providers.
- Test author: 1 call. Reference implementation: 1 call. Mutant generation: 1 call per contract shape, cached.
- Repairs: at most 2, each with the exact failing check.
- Retrieval: at most 5 queries, 3 page opens, 12 s overall.
- Runner: 5 s, 12 tests, output cap.
- Server checks: ~8 s, bounded.
- Daily limit: one user reply counts once, regardless of internal calls.
- Proof is opt-in; Deep remains the default. Version 1 targets median ≤ 12 s for code proof and ≤ 6 s for non-code proof, measured, not assumed.

If the budget cannot fit a trusted suite, the answer is `unverified`. It is never “verified because we ran out of time to check.”

---

## 15. Security and privacy

- Generated code runs only in the browser sandbox, never in the Worker, never in a database, never at a paid API.
- Opaque-origin iframe, no same-origin, no storage, no cookies, no network, no JS bridge, fixed package set, hard timeout.
- Source pages are untrusted data. Instructions in a page are ignored; only factual spans are used.
- Worker fetches at most three pages, with size and time caps; no page bodies are stored.
- Proof records contain labels and outcomes, not stdout, page text, or private ids.
- All new routes require a signed-in owner and a same-origin mutation check.
- Library entries are per-owner and deleted with the account. No cross-user retrieval.
- No new keys, no paid execution service, no frontier fallback.

---

## 16. What is deliberately not in v1

- Languages other than Python.
- JavaScript, SQL, or shell execution (SQL is checked statically and via a fixture only).
- Full entailment or claim-level fact checking; v1 checks dates, entities, and values.
- Theorem proving; numeric and simple symbolic checks only.
- A global shared skill library.
- Runtime learning or fine-tuning.
- Debate, self-critique rounds, self-consistency voting, or prose synthesis of candidates.
- Frontier fallback. Held as an explicit future option, not a silent path.

---

## 17. Measurement gate

No product code ships unless the spike clears this. The spike is three arms on the same 20 scorecard tasks, same tools, same time limits, blind grading.

| Arm | Description |
|---|---|
| **A. Single** | The strongest fixed free lane, existing Deep pipeline. |
| **B. Naive portfolio** | 4 candidates across providers, no checks, pick by a model judge. |
| **C. Proof** | This design: contract, independent hardened tests, execution, selection, bounded repair. |

Pass mark for C:

1. **≥ 4 more wins than A**, and **≥ 8 more points out of 60**.
2. **≥ 3 more wins than B** — otherwise the verifier is not paying for itself.
3. **No more zeros than A.**
4. **No more than 5 slow answers**; median latency within 2.5× A.
5. **Zero false confidence:** no task where the system reports `verified` while the graded answer fails a claim that a check was supposed to cover.
6. **Suite soundness:** on the code tasks, mutant kill rate ≥ 95% for the critical catalogue.
7. **Coverage:** at least 12 of 20 tasks have at least one real (non-format) check. If coverage is below that, the gains are coming from luck and must not be claimed.

Kill criteria, written before the run:

- If C fails 1 or 3, the design is wrong, not the models. Do not ship; return to the single lane plus the cheapest tool.
- If C passes 1 but fails 2, the checks work but the portfolio does not: ship the verifier with one candidate.
- If C passes 1–3 but fails 5, the honesty layer is broken and nothing else counts.

Also recorded, not gated: per-task check coverage, repair success rate, the share of `unverified` outcomes, and which checks never fire. These decide what Phase 4 keeps.

The gate must be re-run after any change to the test factory, because the factory is the treatment.

---

## 18. Phases

### Phase 1 — Contract, deterministic checks, freshness

- Contract extraction with deterministic rules; one optional model call.
- Math recomputation; format/count/unit checks; budget sums.
- Date-aware retrieval: `asOf`, freshness windows, page opening, stale rejection.
- Outcome states, evidence panel, history/share plumbing.
- No code execution yet.

**Exit:** C1 remains unverified (no runner), but R2 and M3 are handled correctly, and no green badge appears without a check.

### Phase 2 — Test factory and runner

- Browser Pyodide sandbox and result protocol.
- Independent test author, suite budgets, mutation gate.
- Execution loop with a bounded repair (max 2) and a re-check.
- Code proof end to end.

**Exit:** C1 passes with a suite that kills the short-list mutant; mutation gate demonstrably rejects a weak suite.

### Phase 3 — Portfolio, selection, library

- Candidate escalation by uncertainty; provider-diverse sampling.
- Selection ranking; no merge.
- Verified exemplar and recipe storage with promotion/demotion.
- Legacy Team removal from the composer; old records stay readable.

**Exit:** C beats B on the code tasks; library retrieval measurably reduces repairs on repeated task shapes.

### Phase 4 — Measurement and optimization

- Full 20-task three-arm run.
- Offline prompt/program optimization of the contract, test-author, and repair prompts against the scorecard.
- Measured routing from `proof_runs` lane statistics.
- Only then decide the default and whether Proof replaces Deep anywhere.

---

## 19. Rejected approaches

- **One writer + one repair (revision 1).** Preserves the writer's ceiling; cannot exceed it. Retained only as the failure path when no suite is trusted.
- **Debate / multi-agent critique.** Evidence is mixed at best; our own run produced ties, not wins.
- **Majority voting / self-consistency.** Votes are not evidence; three wrong answers agree.
- **Prose synthesis of candidates.** Averages away the winning artifact and launders unchecked claims into a confident answer.
- **Model-judge-only verification.** It cannot run the requirement, and it shares the model's blind spots.
- **Frontier fallback.** Would raise the ceiling, but contradicts the free-only constraint. Named explicitly so it is a decision, not an accident.

---

## 20. Risks

- **Weak tests are worse than no tests**, because they produce false confidence. Mitigation: mutation gate, differential check, and `unverified` when the suite is not trusted.
- **Pyodide is large and slow.** Mitigation: lazy load, pinned version, hard timeout, never block ordinary chat.
- **Browser sandboxing is not a formal proof.** Opaque origin, no bridge, no network, fresh runner. Treat as defense in depth, not a guarantee.
- **Latency.** A portfolio plus tests can blow the time budget. Mitigation: escalate only on uncertainty; strict caps; Deep remains default.
- **Overfitting to the scorecard.** The 20 tasks become the training set if prompts are tuned on them. Mitigation: hold out 6 tasks for the final gate, tune only on the other 14.
- **Stale sources still slip through** when a page hides its date. Mitigation: unknown is not a pass.
- **The library can rot.** Mitigation: success tracking and demotion; hard caps.
- **Free-lane outages.** Fallback lanes remain; a failed proof degrades to unverified, not to an error page.

---

## 21. Acceptance criteria

1. A code answer that misses a stated requirement is caught by a test derived from the request, not by a model's opinion.
2. A suite that cannot reject the short-list mutant produces `unverified`, never `verified`.
3. Two independent implementations that disagree produce a warning or escalation, never a silent pass.
4. A “latest” answer either cites a source dated inside the window that contains the named entity, or is unverified.
5. Arithmetic is recomputed, and a wrong final value cannot be badged.
6. No green badge appears for unchecked, unknown, or untrusted work.
7. The presented answer is a single candidate that passed, not a merge of candidates.
8. Generated code never executes in the Worker.
9. Old Team messages render and share; Fast, Deep, history, sharing, offline reading, and the daily limit do not regress.
10. The app works with no new key and no paid service.
11. The three-arm gate in §17 has been run and its result recorded before Proof is made a default.

---

## 22. Builder calls (not user decisions)

- Exact Pyodide version and fixed package set.
- Concrete mutant catalogue per task shape.
- Property-input generator and seeds.
- Exact source-date extraction and official-domain preferences.
- Arithmetic evaluator and supported units.
- Evidence-panel layout and copy.
- Whether `team` remains a server alias for one release.

---

## Approval

This document is the design. No product code is written until it is approved. After approval, the implementation plan is written separately, and the spike in §17 runs before any of it becomes the default.
