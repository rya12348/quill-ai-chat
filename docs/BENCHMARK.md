# Live model benchmark: Team vs single models

Measured on 2026-11-08 against the real local SSE endpoint
(`http://127.0.0.1:5180`). No model path was mocked: every answer below came from
the app's `/api/chat` stream, using the free-tier lane configuration. All ten
tasks were run in all three modes.

## Verdict

**The claim that the Team is materially stronger than the best single free model
is not supported by the complete benchmark.**

- **Team and the best single both pass 10/10 tasks.** Team wins **zero** tasks
  against the best single and ties all ten.
- The legacy single passes **9/10**; it loses only M3. Team beats the legacy
  single on that one task and ties the other nine.
- Team averages **31.9 s** per answer, the best single **7.7 s**, and the legacy
  single **9.3 s**. Team is **4.1x slower than the best single** with no measured
  quality gain.
- Research is not a differentiator in this sample: all three modes pass both R1
  and R2. Team's research answers are much slower (54.8 s and 70.4 s versus
  14.5 s and 16.0 s for the best single).
- Team is more reliable than the previously documented Team result (**4/9** on
  C1/R2/M3). On those same three tasks the rebuilt Team now passes **3/3**,
  including R2 after the freshness fix. That is a real improvement over the old
  Team, but the best single also passes all three.

The defensible conclusion is: **the rebuilt Team is reliable and broad, but it
is not the best default on free-tier latency or measured quality. The best
single lane is. Team is justified only when its independent drafting, review and
verification trail is worth the added latency.**

## Setup

| Item | Value |
|---|---|
| Tasks | 10-task executable subset of `SCORECARD.md`: C1, C2, M1, M3, I1, I2, L1, F1, R1, R2 |
| Team mode | `strategy: "team"` |
| Best single | `nvidia/nemotron-3-super-120b` (BlockRun), chosen by a 3-task calibration |
| Legacy single | `command-a-plus-05-2026` (Cohere) |
| Calibration | BlockRun 3/3 at 6.6 s avg; Cohere 3/3 at 7.9 s; Groq 2/3; Mistral 2/3 |
| Live data at benchmark start | 20 original conversations / 57 messages; 24-of-50 replies used |
| Scoring | Hidden Python tests for code, exact checks for JSON/lines/dates/needle, manual rubric for R1/R2 |

The two research answers (R1 and R2) are manually graded because their factual
accuracy and source quality cannot be reduced to a deterministic check. The
automatic checks are recorded alongside the manual grade in
`bench/manual-grades.json`.

## Results

### Task matrix

| Task | Area | Team | Best single | Legacy single | Team | Best | Legacy |
|---|---|---:|---:|---:|---:|---:|---:|
| C1 | code edge cases | PASS | PASS | PASS | 28.7 s | 7.5 s | 3.8 s |
| C2 | code correctness | PASS | PASS | PASS | 30.7 s | 1.8 s | 2.7 s |
| M1 | multi-step reasoning | PASS | PASS | PASS | 38.1 s | 13.3 s | 5.4 s |
| M3 | average-speed reasoning | PASS | PASS | FAIL | 28.7 s | 4.7 s | 4.2 s |
| I1 | strict JSON | PASS | PASS | PASS | 9.7 s | 8.6 s | 3.2 s |
| I2 | strict five-line format | PASS | PASS | PASS | 15.7 s | 2.8 s | 2.7 s |
| L1 | long-context recall | PASS | PASS | PASS | 13.4 s | 0.8 s | 0.8 s |
| F1 | date freshness | PASS | PASS | PASS | 28.2 s | 7.5 s | 9.9 s |
| R1 | research (manual) | PASS | PASS | PASS | 54.8 s | 14.5 s | 43.4 s |
| R2 | current-product research (manual) | PASS | PASS | PASS | 70.4 s | 16.0 s | 16.6 s |

### Totals

| Mode | Objective 8 | Research 2 | Total | Pass rate | Avg latency |
|---|---:|---:|---:|---:|---:|
| New Team | 8/8 | 2/2 | **10/10** | 100% | **31.9 s** |
| Best single | 8/8 | 2/2 | **10/10** | 100% | **7.7 s** |
| Legacy single | 7/8 | 2/2 | **9/10** | 90% | **9.3 s** |

Against the best single: **0 wins, 10 ties, 0 losses**.
Against the legacy single: **1 win (M3), 9 ties, 0 losses**.

The old 20-task scorecard's pass mark requires 12 wins in 20 and no more than
five slow answers. This 10-task subset cannot decide the full pass mark, but the
measured direction is clear: Team has no quality win over the best single and is
slow on every task relative to it.

## Manual research grades

All six R1/R2 answers were graded against the same rubrics used by the harness.

### R1 — EU AI Act facial recognition

All three modes **PASS**: each correctly separates the Article 5(1)(h)
real-time, law-enforcement, publicly accessible spaces prohibition from narrow
exceptions, avoids a total-ban claim, and cites two official EU sources.

- **Best single** also gives the exact applicability date, **2 February 2025**.
- **Team and legacy** give the applicability stage (“six months after entry into
  force”) but not the exact calendar date. That is the only rubric nuance; the
  current stage and two openable official sources are present.

### R2 — latest iPhone

All three modes **PASS**: each names the **iPhone 18 Pro/Pro Max** as current,
compares it with the iPhone 17 Pro, gives three concrete changes, and cites a
hands-on review. No answer treats the iPhone 17 as the latest model.

## What the Team actually did

All final Team rows carry a real attribution event. The composition varied with
provider health; this is the measured roster, not a planned one.

| Task | Drafters | Referee | Verifier | Repaired |
|---|---|---|---|---|
| C1 | Mistral Large 4, GPT-OSS 120B (Groq) | Nemotron 3 Super 120B (BlockRun) | Command A+ (Cohere) | yes |
| C2 | Mistral Large 4, GPT-OSS 120B (Groq), GPT-OSS 120B (Workers AI) | Nemotron 3 Super 120B (BlockRun) | Command A+ (Cohere) | yes |
| M1 | Mistral Large 4, GPT-OSS 120B (Groq), GPT-OSS 120B (Workers AI) | Nemotron 3 Super 120B (BlockRun) | Command A+ (Cohere) | no |
| M3 | GPT-OSS 120B (Workers AI), Nemotron 3.5 Bolt (BlockRun), GPT-OSS 20B (Pollinations) | Command A+ (Cohere) | GPT-OSS 120B (Groq) | no |
| I1 | Qwen 3.8 27B (Groq), GPT-OSS 120B (Workers AI) | Command A+ (Cohere) | GPT-OSS 120B (Groq) | no |
| I2 | GPT-OSS 120B (Workers AI), Nemotron 3.5 Bolt (BlockRun) | Command A+ (Cohere) | GPT-OSS 120B (Groq) | no |
| L1 | GPT-OSS 120B (Groq), GPT-OSS 120B (Workers AI), Nemotron 3.5 Bolt (BlockRun) | Nemotron 3 Super 120B (BlockRun) | Command A+ (Cohere) | no |
| F1 | GPT-OSS 120B (Groq), GPT-OSS 120B (Workers AI), Nemotron 3.5 Bolt (BlockRun) | Nemotron 3 Super 120B (BlockRun) | Command A+ (Cohere) | yes |
| R1 | GPT-OSS 120B (Groq), GPT-OSS 120B (Workers AI), Nemotron 3.5 Bolt (BlockRun) | Nemotron 3 Super 120B (BlockRun) | Command A+ (Cohere) | no |
| R2 | GPT-OSS 120B (Groq), GPT-OSS 120B (Workers AI), Nemotron 3.5 Bolt (BlockRun) | Nemotron 3 Super 120B (BlockRun) | Command A+ (Cohere) | yes |

I2 was scored PASS while the verifier returned `verified: false`; the deterministic
five-line check still passed. That is recorded as a verifier disagreement, not a
silent pass.

## Failures found and fixed while proving this

1. **Conversation GET returned 404 for every row.** The route had six cleanup
   `DELETE`s before the conversation/message `SELECT`s, but its destructuring
   skipped only five results. `conversation` was therefore a DELETE result.
   The fix adds the missing offset and a regression comment. The endpoint now
   returns the conversation and its messages.
2. **Team requests silently used the ordinary blend.** The post-Proof chat route
   no longer passed `team` to `blendComplete`, and it never passed `onTeam`.
   Requests said `strategy: "team"` but produced two-draft blends with no lane
   attribution. Both handoffs are restored; every final Team row shows three
   drafters, a referee and a verifier.
3. **Freshness was stale.** The first R2 answer described the iPhone 17 as the
   latest model (the current model is the iPhone 18). The planner now receives
   today's date, the refiner asks for current-year queries, and `fetchSearch`
   appends the current year to `latest/current` queries. Every final R2 answer
   produced the iPhone 18 Pro with a hands-on source.
4. **Verifier prose caused bogus repairs.** Only explicit `PASS` or `FIX:` is
   accepted now; verbose verifier reasoning is ignored.
5. **M1 omitted the requested comparison.** The task now explicitly requires the
   flat-35% result ($52) as well as the sequential result ($54).
6. **L1 exceeded the 8,000-character message limit.** The original 8,707-character
   prompt was rejected by design; the reduced 26-section prompt passes with the
   exact buried code.
7. **M3's checker was too literal.** It now accepts the correct 5-hour total
   while still rejecting a 40 mph average.

## Verification

- `npm run typecheck` — passed.
- `npm run build` — passed (`vite build` and `node scripts/postbuild.mjs`; Vite
  warned that the client bundle is 686 kB, above its 500 kB warning threshold).
- `GET /api/conversations/:id` — 200 after the read-path fix.
- Generated `dist` output was removed after verification.

## Data preservation

- Original data: **20 conversations / 57 messages**.
- Final live state after the user created and used additional chats during the
  run: **26 conversations / 68 messages / 27-of-50 replies**.
- No benchmark-created conversations from this pass remain. The six additional
  conversations are user-created chats; they were not deleted. Two older
  conversations with the same iPhone prompt predate this pass and are part of
  the original dataset; they were left untouched as well.
- The benchmark captures before/after snapshots, deletes each test conversation
  in `finally`, and retries cleanup. `bench/inflight.json` is absent.
- The final single-mode research run logged a snapshot warning because the user
  added a message while it ran; the four task rows completed and are saved in
  `bench/singles-research.json`. This is a snapshot-stability warning, not a model
  failure.

## Evidence and limitations

- Raw runs: `bench/team-a.json`, `team-b.json`, `team-m3.json`, `team-c.json`,
  `team-l1.json`, `team-final.json`, `singles-b.json`, `singles-d.json`,
  `singles-research.json`, `best-a.json`, `baseline-a.json`, plus
  `bench/manual-grades.json`.
- This is a 10-task executable subset, not the full 20-task `SCORECARD.md`.
- Free-tier provider health changed during the run. BlockRun was intermittently
  degraded; composition and latency reflect that, not an idealized roster.
- Research grading was done directly against the rubric, not blind; no second
  grader was used.
- This is a local benchmark (`127.0.0.1:5180`), not a production deployment.
- One sample per task. Latency and provider composition are expected to vary.
- No screenshots were taken; this is an API-level benchmark.
