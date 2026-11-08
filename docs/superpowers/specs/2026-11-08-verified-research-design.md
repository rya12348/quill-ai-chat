# Verified Research: free, cited reports

**Status:** draft for approval
**Date:** 2026-11-08
**Scope:** a free, web-grounded **Research** mode that returns a cited report with claim-level receipts.
**Not in v1:** PDF/CSV upload, charts, a separate SEO report site, paid APIs.

---

## 1. The paid thing we are giving away

Deep research is normally a paid-tier feature: Perplexity Pro, ChatGPT Plus and Gemini Advanced all put their best multi-source reports behind roughly $20/month. Quill already has the ingredients — web search, free model lanes, Proof, history, sharing and export — so the marginal feature is mostly orchestration, not a new paid service.

The promise is not "another chatbot." It is:

> Ask one question. Get a report with sources, disagreements and a list of what could not be verified. Free.

The differentiator is not "free research"; free research is becoming common. It is **free research with receipts**: every key finding points to a source that was actually opened, and unsupported claims are visibly marked.

This also gives Quill a homepage sentence that a chat box cannot:

> **Free research reports with sources. The $20/month workflow, without the subscription.**

---

## 2. What the user gets

A saved assistant message, 500–900 words, containing:

- **Bottom line** — three bullets.
- **What the sources say** — three to six key findings, each with inline `[n]` citations.
- **Where the sources disagree** — shown, not averaged away.
- **What I could not verify** — missing dates, thin evidence, pages that would not open.
- **Sources** — numbered title, publisher, date (when known) and URL.

Above the report: a `ResearchNote` bar with the outcome, source count and claim counts. Expanding it shows each key claim as **supported**, **single-source** or **unsupported**, with its source links. "Supported" means the cited source was opened and contains the named entity or value; it does not mean the claim is universally true.

The report can be downloaded as Markdown, printed to PDF, and shared with the existing read-only share link. Old reports stay readable offline. New research requires a connection.

---

## 3. Product flow

1. In the composer, the person turns on **Research**.
2. They ask a question. The placeholder becomes `Ask a research question…`; the bar says `Research uses 1 of your 3 daily reports.`
3. Status streams while evidence is gathered:
   - `Planning searches…`
   - `Searching: … (1 of 5)`
   - `Reading 5 sources…`
   - `Checking citations…`
   - `Writing the report…`
4. The report appears once, after the citation check, with the `ResearchNote` and source list.
5. The person can stop, retry, share, export, or ask a follow-up in the same conversation.

Research is intentionally not token-streamed. A half-written report with unchecked citations is worse than a short wait; status updates carry the progress.

---

## 4. UI integration

- Add **Research** to the existing compact toggle row in `Chat.tsx`, next to Proof and Deep. Icon: telescope or search.
- It is free-mode only (`mode !== 'api'`), mutually exclusive with Proof and Deep, and off by default. Persist the choice in `localStorage` as `research=on|off`.
- Changing to Research turns Proof and Deep off; changing to either of those turns Research off.
- The `Free model` badge becomes `Research` while the mode is active.
- Add `ResearchNote` to `AssistantMessage`, in the same slot as `ProofNote`. For research replies it owns the source list; hide the generic `Sources` panel to avoid duplicating the numbered sources in the report body.
- `ResearchNote` copy:
  - `Research · 6 sources · 7/8 claims supported`
  - `Research · checked with warnings · 2 single-source claims`
  - `Research · unverified · not enough sources`
  - `Research · failed · report could not be written`
- The panel lists claims with status dots, source links, the report's `as of` date and the models used. It never shows raw page text.
- Mobile: the toggle stays in the existing compact row; the panel is a normal collapsed disclosure.
- Add a report-only **Download .md** action to the panel. The existing chat export must also include the report and its sources. PDF is browser print, not a server-side renderer.
- Offline: saved `research` records render normally; starting a new research turn is disabled with the same offline messaging as other turns.

---

## 5. Backend flow

`POST /api/chat` accepts `strategy: 'research'`. It is available only when `aiConfigured(env)` is false and there are free lanes. If no free lane is available, return a clear error rather than falling back to a paid model.

Add `src/worker/research.ts` with one orchestration function:

1. **Frame the question.** Deterministic pass: detect freshness (`latest`, `current`, prices, releases), contested topics and required comparisons. No model call yet.
2. **Plan diverse queries.** One small free-lane call, bounded to 5 queries. Require at least one primary/official query and, for contested questions, one query for the opposing view. Add the current year for time-sensitive questions. Do not reuse the same query twice.
3. **Retrieve.** Reuse `fetchSearch` from `search.ts`: at most 5 searches, 8 unique results. Deduplicate by URL and title. Prefer official/primary domains, then independent reporting, then analysis.
4. **Read.** Open up to 5 result pages, using a new bounded page reader in `search.ts`:
   - `redirect: 'manual'`, at most 3 redirects, revalidate every hop.
   - 8s per page, 20s total, 1.5MB HTML and 200KB extracted text per page.
   - No cookies, no auth headers, no JavaScript rendering. If a page needs JS, keep the search snippet and mark it `snippet-only`.
   - Extract title, publication/update date when present, and short factual spans. Never store the page body.
5. **Build the evidence table.** Each source gets a stable id, URL, title, publisher, date (or unknown), snippet, quote (≤300 characters), and `opened: true|false`.
6. **Write once.** The strongest healthy free lane writes the report from the evidence table. It must not add facts from memory. It writes numbered citations that map to `sourceOrder`.
7. **Check.** Deterministic checks first; then the strongest healthy free lane from a different host checks claim-to-source support. The checker may downgrade a claim, never upgrade a deterministic failure.
8. **Repair once.** If a key finding is uncited or a citation does not match, send the exact issue back to the writer for one bounded repair. Re-run the checks. If it still fails, publish with warnings or as unverified.
9. **Persist.** Save the report text, sources, research metadata and metrics. The report is one assistant message; a normal message-limit count applies, plus one research slot.

Search failure is not a reason to write from memory. With fewer than two usable sources, return no report and a clear `Research could not gather enough sources` message. Do not invent a report to fill the silence.

---

## 6. Citation and freshness rules

### Claim states

- **Supported** — the claim cites at least one source that was opened and contains the claim's named entity or numeric value.
- **Single-source** — supported, but only one independent source contains it.
- **Unsupported** — no citation, or no cited source contains the named fact. The report must flag it; a central unsupported claim blocks `verified`.

The checker compares normalized entities and numbers against the opened page text. It does not claim full entailment. UI copy says "cited source contains the named fact," not "this is true."

### No green without checks

`verified` requires all of the following:

1. At least 3 opened sources from at least 2 registrable domains.
2. Every key finding has at least one citation that resolves to a source in `sourceOrder`.
3. Every cited URL was actually opened in this run; snippet-only sources make the result `warning`, not `verified`.
4. No central unsupported claim remains after the repair.
5. For a "latest/current/price/release" question, at least one source has a usable date inside the freshness window (30 days by default; 365 for annual topics). An undated source cannot satisfy it.

Otherwise use `warning` (report is usable but weaker) or `unverified` (not enough evidence). `failed` means no report could be written. `checking` is never shown as a pass.

Do not average conflicting sources into a false consensus. Show the disagreement and the newer dated source first. Do not let a model judge override a missing source, a stale date or an invented URL.

---

## 7. Data and API shape

```ts
export type ResearchClaimStatus = 'supported' | 'single-source' | 'unsupported'

export interface ResearchClaim {
  id: string
  text: string
  sourceUrls: string[]
  status: ResearchClaimStatus
}

export interface ResearchInfo {
  status: 'checking' | 'verified' | 'warning' | 'unverified' | 'failed'
  question: string
  queries: string[]
  /** URLs in citation order; [1] is sourceOrder[0]. */
  sourceOrder: string[]
  claims: ResearchClaim[]
  counts: { sources: number; supported: number; singleSource: number; unsupported: number; conflicts: number }
  models: string[]
  asOf: number
  reason?: string
}
```

- Add optional `publishedAt?: number` to `Source`; existing sources ignore it.
- `Message.research?: ResearchInfo`; `SharedMessage.research?: ResearchInfo`.
- `ChatEvent` gains `{ type: 'research'; research: ResearchInfo }`. Sources are sent with the existing `sources` event before the report text; the final `done.message.research` is the persisted copy.
- `ChatRequest.strategy` gains `'research'`.
- New table `message_research` follows the `message_proof` pattern: `(message_id PK, owner_sub, content, created_at)`. Join it anywhere proof is joined:
  - `routes/conversations.ts` (read, orphan cleanup, delete)
  - `routes/shares.ts` (shared payload)
  - `routes/chat.ts` (save and regenerate cleanup)
  - `routes/account.ts` (delete all)
- `message_sources` stores the source list. `ResearchInfo.sourceOrder` preserves the report's numbering.
- New `research_runs` table for metrics only: outcome, source/claim counts, latency, models, created_at. No question or report text.
- `parseResearch` validates stored JSON and drops malformed records the way `parseProof` does.

No new public endpoint is needed. Sharing uses the existing token and `SharedChat` page; add `research` to the shared message and render `ResearchNote` there.

---

## 8. Limits and cost

- **Research limit:** 3 reports per UTC day per user, separate from the 50-message limit. A completed report also counts as one normal reply.
- Reserve the research slot at start; release it if the turn is stopped before the writer call. A writer call that has started counts the slot even if the user stops it.
- Retrieval budget: 5 searches, 8 results, 5 page opens, 20 seconds.
- Generation budget: 1 writer, 1 checker, 1 repair. Hard stop at 90 seconds; target p50 ≤ 60 seconds.
- Writer and checker must be distinct healthy free lanes where possible; the checker cannot be the writer. Small local Ollama models are not eligible for the checker.
- No paid model fallback. If the free lanes are exhausted, the result is `unverified` or an honest failure.
- No cross-user report cache in v1. Keep the existing 10-minute search cache; do not persist page bodies. A private question must not become another user's cached report.
- Add `RESEARCH_ENABLED` (default off) so the mode can be tested before it appears for everyone.

Show the limit in the Research toggle title and in the 429 response; do not let a user write a long question only to discover the limit at submit time.

---

## 9. Security, privacy and source handling

Source pages and snippets are **untrusted data**, never instructions.

- Ignore any instruction found in a page, snippet, title or metadata. Only extract factual spans.
- Allow `http:` and `https:` only. Block `localhost`, `.local`, `0.0.0.0`, `[::1]`, private/link-local/metadata IP ranges, and credentials in URLs. Revalidate every redirect.
- Send no cookies, authorization headers or user identifiers to source sites. Use the existing Quill user agent.
- Cap response size and time. Treat non-HTML content as a source only if the snippet is usable.
- Store at most 300-character quotes and the extracted snippet, never the full page. Link to the original.
- The report is owner-scoped until the person explicitly shares it. Deleting the conversation or account removes `message_research`, sources and `research_runs` rows that belong to it.
- No generated code runs for this feature; the Worker only searches, reads, writes and checks text.

Prompt injection in a source must not be able to change the report's instructions, call tools, reveal keys or add uncited claims. The checker only sees extracted spans and the claim, not the page's imperative text.

---

## 10. Growth loop

The existing share page is the v1 distribution surface:

- Shared reports show `Research · 6 sources · citations checked`, the claim receipts and a `Research your own question` link back to Quill.
- The share page already is read-only and token-gated; do not index private chats. Public indexing of shared reports is a phase-2 decision, not a default.
- A report-only Markdown download makes the output portable to a doc, email or client update.
- The homepage and empty state should lead with the artifact, not the chat box: an example report with visible sources, then the free/paid comparison.
- Track `research_started`, `research_completed`, `research_unverified`, `research_shared`, `research_exported`, `source_click` and 7-day repeat research. Do not log question text or page bodies in metrics.

Success targets for the first 100 reports: p50 under 60 seconds, fewer than 2% of reports marked `verified` after manual audit finds a central unsupported claim, and at least 15% of completed reports shared or exported.

---

## 11. Acceptance criteria

1. Research is visible only in free mode, is mutually exclusive with Proof and Deep, persists across reloads, and does not change their behavior.
2. A normal question produces a report with at least 3 opened sources from 2 domains, inline citations and claim receipts — or an explicit `unverified`/failure state.
3. A seeded fake URL or citation is caught; it cannot appear as `verified`.
4. A "latest" report uses a source dated inside the freshness window; a stale or undated source produces `warning`/`unverified`, never a green badge.
5. Search failure produces no fabricated report and no sources.
6. The report survives reload, is included in Markdown export, and renders on the shared page with its sources and receipts.
7. The 3/day limit, abort path and normal 50-message limit work; a stopped turn does not leave a half-report marked verified.
8. Private-host/redirect SSRF tests pass; page prompt-injection tests cannot change instructions or add uncited claims.
9. No paid API key, client-side secret or paid fallback is introduced.
10. Mobile layout, keyboard use and screen-reader labels work; Proof, Deep, history, sharing and offline reading do not regress.

---

## 12. Test plan

- **Unit:** citation parser, claim splitter, entity/number normalization, date parser, URL/file-type guards, SSRF range checks, dedupe, source-order mapping, limit accounting.
- **Integration (mocked search):** three sources from two domains, one stale source, one duplicate, one fake URL, one snippet-only page; assert `verified`, `warning` and `unverified` transitions and persisted/share payloads.
- **Live:** six questions covering a current release, a price, a scientific claim, a contested policy, a comparison and a thin-evidence topic. Measure source count, claim support, latency and failures.
- **Adversarial:** a page containing "ignore previous instructions", a redirect to a private host, a 1.5MB page, an undated "latest" page, a source that contradicts another, and a report with an invented `[7]`.
- **Manual audit:** 20 reports checked for invented citations and central unsupported claims before enabling for everyone.

---

## 13. Rollout

1. Build behind `RESEARCH_ENABLED`; keep Research off by default.
2. Run the live and adversarial suites; manually audit 20 reports.
3. Enable for free users; update the homepage/empty state to show a real report.
4. Only then add PDF/CSV uploads, charts and public report pages. Those are separate specs, not v1.

### Open decisions before build

- 3 reports/day vs 5 (recommend 3; it protects free lanes).
- 5 page opens vs snippet-only (recommend 5; snippets alone are too weak for receipts).
- 500–900 word reports vs longer (recommend the shorter range; it is a report, not a book).
- Public indexing of shared reports (recommend no by default; explicit share only).
- Whether research accepts attachments in v1 (recommend no; web-first keeps the citation contract clean).
