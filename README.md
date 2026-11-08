# AI chat

A chat app on the Freebuff API: conversations in a sidebar, streamed replies
rendered as Markdown, a model picker in the composer, stop and regenerate, and a
daily limit per user. It runs on Freebuff Sites with Sign in with Freebuff and D1, and
everything is scoped to the signed-in user. The API key stays on the server.

Most customisation is one file: `src/shared/config.ts` holds the name, the
assistant's instructions, the models people may pick, the limits and the
suggestions on an empty chat.

## Attachments

The plus button in the composer attaches up to four files to one message; a
screenshot can also be pasted straight into the textarea with Ctrl/Cmd+V.
Images (PNG, JPG, WebP and GIF) are shrunk in the browser to a readable 1,600px preview
before sending; text and code files up to 20,000 characters are copied into the
prompt with their filenames. You can send an image without a caption.

Image turns are routed only through vision-capable free lanes (OpenRouter's
Nemotron 3.5 VL, Gemma 4 31B, Nemotron Omni and free router, plus Gemini or the
marked Workers AI vision lanes when configured). If no vision lane is available
the message is refused instead of being sent to a model that cannot see it.
Attachments are stored with the message in D1; image bytes are served through an
owner-checked route, and through a live share link when the chat is shared. Analyze keeps its table in browser storage
and returns only the generated result. The Freebuff API key path is still
text-only, as described below.

## Analyze

Analyze is a fourth free-only composer mode, enabled with `ANALYZE_ENABLED=1`
(add it to `.env.local` locally). Attach one CSV, TSV or XLSX, then ask a
question. The browser keeps the full table in IndexedDB and sends only the
column names, row count and a small sample; the free lanes write a short pandas
program. The browser runs it in an opaque, sandboxed Pyodide iframe against the
local copy, then returns stdout and an optional matplotlib chart. The reply
shows the code, the table/chart, execution status and a **Rerun in this browser**
button. Data is not stored in D1, and shared links contain only the generated
result, not the dataset. The mode is capped at three analyses per UTC day and
uses only free lanes. A saved analysis can rerun without the original tab while
the dataset remains in that browser profile.

## Build

Build is a fifth free-only composer mode, enabled with `BUILD_ENABLED=1` (add
it to `.env.local` locally). Describe a website, landing page, portfolio, tool,
game or demo and a free lane returns one self-contained HTML document. Generated
pages are previewed in a sandboxed iframe with scripts but no same-origin access
or cookies. They may load HTTPS images, but cannot use external scripts, fonts,
fetch/XHR/WebSocket, storage or a backend. The reply can be downloaded as a
single `.html` file and is included in shares.

Build also has a live-site path. If the request asks to show, run, open, play or embed a public
address (for example “run poki.com” or “show poki.com live”),
Build fetches the real HTML and serves it through a token-scoped, read-only
preview proxy. This is a live page, not a screenshot or emulator: the page's own
scripts and assets load in a sandboxed iframe without app cookies or same-origin
access. The proxy blocks private hosts, non-public redirects, non-HTML responses
and form submission. Sign-in, payments, service workers and some cross-origin
APIs may not work, and the original site should be used for those. A live preview
is reachable by anyone with its capability URL and is included in a shared chat.
The full-screen **Expand** button opens either kind of preview at page size. Build
is text-only and capped at three builds per UTC day.

## Canvas

Canvas is a sixth free-only composer mode for study material. Ask for
flashcards or a quiz on a topic ("flashcards for cell biology basics", "quiz me
on the French Revolution") and a free lane returns a strict JSON study set. The
reply renders an interactive card: tap a flashcard to flip it, or answer a
quiz question to reveal the correct choice and a short explanation. The set can
be reset or downloaded as Markdown, and it is included in shares. Canvas is
text-only and reuses the free-lane completion path, so it counts against the
daily reply limit rather than a separate mode cap.

## Verified Research

Research is a third free-only composer mode, enabled for a deployment with
`RESEARCH_ENABLED=1` (add it to `.env.local` locally). It plans searches, opens
public pages, writes a cited brief and checks each key finding against the
opened text. Reports show claim-level receipts with source links and statuses
(`supported`, `single-source`, `unsupported`). A report is **verified** only when
at least three public pages were opened across two domains and every extracted
finding has two independent supporting sources; otherwise it is shown with a
warning or as unverified, never as a pass. The mode is capped at three reports
per UTC day, does not accept attachments in v1, and always runs the report
through free lanes rather than model memory alone.

## Run it

```sh
bun install
bun run dev        # http://127.0.0.1:5180 with local D1 (Miniflare)
bun run build      # dist/client (assets) + dist/ai_chat/index.js (Worker)
```

The development URL is always **http://127.0.0.1:5180**. Another local project
owns `127.0.0.1:5173`, so Quill uses its own fixed port and `strictPort`
refuses to start somewhere else silently.

No API key is needed, by you or by anyone using the app. Without one, replies
come from the free chain in `src/worker/public-ai.ts`: BlockRun's keyless
Nemotron 3 Super 120B, OpenRouter free variants, LLM7 turbo models, Cohere
trial, Groq, Mistral, Workers AI, Z.ai, and keyless LLM7 and Pollinations
fallbacks. The chain is ordered by a capability prior, not by provider order, so
the best reachable lane answers first. The picker lists every configured lane.
Every key is optional, and every keyed lane is free to create; Cohere uses trial
credits rather than unlimited free usage. A rate limit makes that lane rest
while the next one answers, so one busy provider does not fail the message.The thread shows a **Free model** badge, or **Proof** when Proof is on; the
model picker in the composer lists every lane.
Replies can be rated helpful or not helpful, and the rating is stored with the
message. `OPENAI_API_KEY` still takes priority when present.

On localhost without a `FREEBUFF_CLIENT_ID`, the app signs you in as a local
development user and seeds one sample conversation.

## The free chain

`public-ai.ts` holds an ordered list of lanes and streams from the first one
that answers:

- **OpenRouter** — nine free routes: Nemotron 3 Ultra 550B, Nemotron 3.5
  Super, Nemotron 3.5 Lightning, Gemma 4 31B, North Mini Code, Nemotron 3 Nano
  Omni, Xing4.0 29B, Flint and the `openrouter/free` router. Needs
  `OPENROUTER_API_KEY`; `OPENROUTER_MODELS` replaces the list.
- **LLM7** — its free token reaches the **turbo** models only: GPT-OSS 20B,
  Codestral and Mistral Nemo. The older DeepSeek/Kimi/GLM pro ids return
  `401`/`400` on a free token, so they are no longer in the free chain. The same
  turbo models work anonymously when no token is set.
- **Groq** — GPT-OSS 120B, GPT-OSS 20B and Qwen 3.8 27B with `GROQ_API_KEY`.
- **Mistral** — Mistral Large 4, Codestral and Ministral 14B with
  `MISTRAL_API_KEY`.
- **Cloudflare Workers AI** — GLM-5.3, GLM-5.3 Flash, DeepSeek V4 Flash 0731,
  GPT-OSS 120B, Qwen 3.8 27B, Nemotron 3 120B, Gemma 4 26B, Llama 4 Scout and
  Mistral Small 3.1 on the free daily allowance.
- **Z.ai** — GLM-4.5 Flash with `ZAI_API_KEY`; newer GLM models need paid
  credits.
- **BlockRun** — keyless Nemotron 3 Super 120B and Nemotron 3.5 Bolt. The
  120B lane is a strong, reliable default; it is not a frontier model, but it
  handles the edge-case coding and reasoning that the old fallback referee
  missed.
- **Pollinations** — keyless GPT-OSS 20B; `POLLINATIONS_API_KEY` adds Kimi K3
  (or `PUBLIC_AI_MODEL`) through the keyed endpoint.
- **Optional** — NVIDIA NIM (`NVIDIA_API_KEY`), Ollama Cloud
  (`OLLAMA_API_KEY`), SambaNova (`SAMBANOVA_API_KEY`), ModelScope
  (`MODELSCOPE_API_KEY`) and Google AI Studio (`GEMINI_API_KEY`).
- **Local Ollama** — opt in with `OLLAMA_LOCAL_URL` and
  `OLLAMA_LOCAL_MODELS` (comma-separated, defaults to `qwen2.5-coder:3b` and
  `qwen2.5-coder:7b`). This is for local development only: a deployed Worker
  cannot reach the computer running Ollama.

A Cohere trial key adds **Command A+** through Cohere's OpenAI-compatible
endpoint; it uses trial credits, not unlimited free usage.

A lane that is busy, blocked or empty before its first token is skipped, and
the reply comes from the next one. Once text is flowing a failure is shown
rather than spliced with another model's answer. A rate-limited or broken lane
rests for a few minutes before it is tried again. LLM7's anonymous quota and
Pollinations' 30-second rule still apply, so a burst of messages can be refused;
the app says so instead of pretending the model failed.

A free key from <https://enter.pollinations.ai> adds **Kimi K3**. A free NVIDIA
NIM key (<https://build.nvidia.com>) adds **DeepSeek V4.1 Flash**, **GLM-5.3
Flash** and **Nemotron 3 Ultra** at up to 40 requests a minute. A free Ollama
Cloud key (<https://ollama.com/settings/keys>, no card) adds its hosted
DeepSeek V4 Pro, Kimi K3, GLM-5.3, MiniMax M3 and DeepSeek V4 Flash while the
monthly starter credits last. SambaNova
(<https://cloud.sambanova.ai>) adds DeepSeek V3.2, DeepSeek V3.1, GPT-OSS 120B
and MiniMax M2.7 on a tight free daily cap. ModelScope (<https://modelscope.cn>)
adds another DeepSeek V4.1 Flash lane. A free key from
<https://console.groq.com> adds **GPT-OSS 120B**; OpenRouter
(<https://openrouter.ai/keys>) adds **Nemotron 3 Ultra 550B** and **Nemotron 3.5
Super**; Mistral (<https://console.mistral.ai>) adds **Mistral Large 4**; Google
AI Studio (<https://aistudio.google.com/apikey>) adds **Gemini Flash**; and a
Cloudflare account id plus a Workers AI token adds **GLM-5.3 Flash** and
**DeepSeek V4 Flash**. A free LLM7 token
(<https://dash.llm7.io/#/api-keys>) raises its rate limits on the same turbo
models; it does not unlock the pro models. A Z.ai key (<https://z.ai>) adds
**GLM-4.5 Flash**; newer GLM models need paid credits. They are rate-limited per
account rather than per IP, and stay on the server: no key ever reaches browser
code.

## Provider health

The free lanes cool down inside a single Worker isolate, which is fast but
forgets everything on a restart. The last known result is also kept in D1, in
the `provider_health` table, one row per owner and provider:

- status: `healthy`, `degraded`, `down` or `unknown`
- the last success and the last failure, with the error code and message
- a latency sample, the consecutive failure count and when it was last checked
- `next_probe_at`, the persisted backoff

`GET /api/providers` returns that state for the providers this deployment can
use, merged with what the current configuration exposes. It never probes, so a
fresh page load shows the last known status immediately. The model picker and
Settings read it. The picker only lists models with a successful check; if
nothing has succeeded yet it falls back to usable lanes rather than an empty
list. Down and misconfigured models stay hidden.

`POST /api/providers/probe` refreshes at most two providers that are due, the
one named in the body, or every provider that is not already healthy when
`{"all": true}` is passed (Settings uses this for **Check all**). Successful and
failed sends update the same rows, so the status is consistent everywhere it is
shown. A failure raises the status after three consecutive misses and schedules
the next automatic probe further out (30 s, doubling, up to 30 minutes); the next
success clears the error and the counter. Nothing probes in a loop: reads are
free, a bulk check skips healthy lanes and runs in batches of eight, and every
probe has a 20-second timeout so slow local Ollama models are not marked down.

## Getting closer to frontier quality

The free models are smaller than the paid frontier, so the app spends extra
compute per question instead of extra money:

- **A plan first.** Deep questions get a short plan from the strongest
  available lane: the sub-questions, the facts or calculations needed, and the
  likely pitfalls. Every draft starts from that plan instead of improvising its
  own.
- **Adaptive depth.** A greeting goes to one model. Ordinary questions get two
  independent drafts. Long, technical or multi-part questions get a plan, three
  drafts and a review pass. **Effort** sets the reasoning budget without forcing
  every message through the deep pass.
- **Proof mode.** The **Proof** switch runs the answer through checks instead
  of opinions. Code gets an independently written test suite (the solver never
  sees it), and that suite must first reject deliberately wrong programs before
  it is trusted; the Python runs in a sandboxed browser iframe, never in the
  Worker. Arithmetic is recomputed, and a current-facts answer must cite pages
  that were actually retrieved, with dates inside a freshness window. A failed
  check gets one bounded repair. The reply stores the checks themselves — no
  model-reported confidence — so the badge survives reloads and share links.
  **Deep** stays adaptive and on by default; **Proof** is off by default because
  it spends several free calls per question.
- **Artifacts, not merged prose.** In Proof, two lanes may write a program, but
  the answer shown is the candidate that passed the tests. The drafts are never
  averaged into a third answer that nothing checked.
- **Diverse drafts.** Each draft uses a different lens (direct, careful,
  sceptical) and temperature, from different providers where possible. Drafts
  disagree in useful ways; the disagreements are what expose a single model's
  mistakes.
- **A reviewer, not a second answer.** The second-strongest lane reads the
  drafts and lists factual errors, missing constraints, arithmetic mistakes and
  conflicts. For math, logic or code it independently re-derives the result,
  including edge cases, rather than trusting the drafts.
- **Synthesis, then verification.** The strongest available lane writes one
  answer from the drafts and the review, resolving disagreements and dropping
  unsupported claims. In deep replies a different strong lane then
  checks the finished answer; if it finds a material error, the referee repairs
  it before anything is shown. This catches mistakes introduced during synthesis,
  which the old draft-only review could not see.
- **Reliability.** A rate-limited or broken lane rests while the next one
  answers, so one free provider's daily cap does not fail a message.

This is test-time compute / mixture-of-agents. It narrows the gap on reasoning,
writing and factual work and usually beats any single free model in the chain.
It cannot make a 20B model match a frontier model on every task, and a deep or
deep reply spends seven or eight free calls instead of one; the per-user daily
limit still applies.

The honest limit is the model, not the orchestration. No free keyless endpoint
is a frontier model. The strongest free *near-frontier* lanes are the keyed
ones: Gemini 3.8 Flash, NVIDIA DeepSeek V4.1/GLM-5.3 Flash, Ollama Cloud's
starter models and OpenRouter's Nemotron 3 Ultra. Add one free key and the deep pass
uses it as the planner, referee and verifier; without one, BlockRun's 120B and
the OpenRouter free variants are the strongest lanes available.

Standing instructions in Settings are stored with the account and added to
every new reply, so a preferred tone, format or language carries across chats.
They are capped at 2,000 characters and deleted with the account.

## Sharing

The share button in a chat creates a 192-bit random token and a `/s/<token>`
link. The public endpoint returns only that conversation's title, messages,
model names, reasoning, sources and the Proof record when one exists: no
conversation or message ids, owner, feedback, settings or other chats. It is
read-only, cached with `no-store`,
and revocation deletes the token immediately. Deleting the conversation or
the account also removes its share.

## Install and offline

The built app is a PWA. `public/manifest.webmanifest` names it Quill (standalone,
`/` start, cream theme, 192/512 PNG icons plus a maskable 512), and
`src/main.tsx` registers `/sw.js` in production builds. `scripts/postbuild.mjs`
replaces `__QUILL_VERSION__` with a digest of the build, so every deploy gets
fresh cache names and the previous ones are deleted on activate: nobody is left
on a dead shell.

Caching strategy in `public/sw.js`:

- **Navigations** are network-first. A live visit always gets the current HTML;
  only a failed fetch falls back to the cached page or the cached shell.
- **API GETs** are network-first and cached best-effort for offline reading.
  Online reads are never stale. Cached responses carry `x-quill-offline: 1`,
  which is what makes the offline banner appear.
- **API writes and the chat stream** pass through untouched online. If the
  network is down the Worker returns a JSON 503. The app stores the draft per
  conversation, queues one send and retries it when the browser comes online.
  The send carries a client-generated message id, so the Worker refuses a
  duplicate instead of adding the same message twice.
- **Hashed assets** (JS, CSS, fonts, icons) are precached during service-worker
  install. The first offline load therefore has the complete app, not just the
  HTML shell.

Offline, the shell, the chat list and any conversation opened before are
readable; one never opened shows **Not available offline** instead of crashing
or a blank page. A message typed offline stays visible in the composer, survives
a reload, and sends once when the connection returns. Search and Settings
changes still need the network. The service worker runs only in the built app
(`npm run build`), not under `vite dev`; run the built Worker to try install and
offline behaviour.

## Long conversations

The newest 24 messages always go to the model verbatim. Once a turn falls
outside that window, the Worker folds it into a rolling memory stored with the
conversation in D1. The memory keeps names, decisions, constraints and other
early details, and each update only processes turns that have newly fallen out
of the window rather than re-summarizing the whole history. It survives a
browser reload and a Worker restart, and it is internal: it is never added to
the visible thread, the conversation API, a Markdown export or a share link.

## Projects

Projects group related chats in the sidebar. Create one with the plus button,
then use the folder button in a chat header to move that chat into or out of a
project. Selecting a project filters the sidebar and starts new chats inside
it. Projects are owner-scoped, names can be renamed, and deleting a project
keeps its conversations in **All chats** instead of deleting them. Deleting a
conversation removes its project assignment. Project names and ids are never
included in a share link or a Markdown export.

## Web search and reasoning

Grounding works with no key at all. `search.ts` uses `EXA_API_KEY` first when it
is set, then falls back to keyless sources: DuckDuckGo web results and instant
answers, Google News RSS, Wikipedia, Stack Exchange and Hacker News, with GDELT
and freenewsapi.ai as a last-resort news fallback. Questions whose answers
change — news, prices,
releases, scores, dates — are looked up before the model answers. The Worker
fetches a handful of snippets, injects them into the system prompt and asks the
model to cite sources inline as Markdown links. The retrieved results are sent
to the browser and saved in a collapsible **Sources** panel; links that do not
match a retrieved URL are flagged. Search is built into every model: there is no
separate switch.

The lookup is planned rather than one blind query. `plan.ts` asks the answering
model — or the first free lane — for up to three focused queries, runs them,
merges and deduplicates the snippets, and only when the first round found fewer
than three results asks once more for up to two refined queries. The plan and
each query appear as progress steps while the turn runs. They are transient:
they are not stored with the reply, so the finished transcript, share JSON and
Markdown export contain only the answer and its public Sources panel.
Straightforward questions skip planning entirely and answer directly.

The stage is bounded: at most two planning calls, five searches, 6 s per
planning call, 4 s per search and 12 s overall. If search is unavailable, times
out or returns nothing, the reply still streams with a non-fatal notice instead
of an error. Results are cached for ten minutes, and only the question and the
planned queries are sent: no account details and no conversation history.

`SEARCH_BASE_URL` replaces the built-in sources with an owner-run endpoint:
`GET <base>?q=<query>` must return `{ "results": [{ "title", "url", "snippet" }] }`.
`SEARCH_API_KEY` is sent as a bearer token. This is how the local mock search is
wired up in tests, and it works with a small SearxNG-style bridge.

The **Effort** button beside **Deep** shows the current level — **Default**
initially — and opens a slider with **Low**, **Default** and **Max**. It sets the
free lanes' reasoning budget. **Low** skips the extra reasoning pass for the
quickest reply, **Default** asks supported lanes for medium effort, and **Max**
asks for high effort. OpenRouter lanes receive the matching reasoning effort,
and Z.ai lanes turn thinking on for Default and Max. In advanced modes, reasoning
streams into a collapsible **Thinking** panel above the answer, labelled with how
long it reasoned. It is stored with the reply and shown again in history. With
every mode switch off, Quill is in plain Fast chat: the model may still reason
internally, but raw reasoning is neither streamed nor stored, and old Thinking
panels are hidden until an advanced mode is selected. **Deep** controls the extra
drafts and review separately, so Effort does not force every question through
the expensive pass. **Proof** is a separate switch; it and Deep are mutually
exclusive, and Proof is off by default. The output cap is 4,096 tokens. Turn both
off and select Low for the quickest reply; the Thinking panel stays hidden.

## The API key (optional)

Setting `OPENAI_API_KEY` switches every reply to the Freebuff API instead of the
free lane. The key is a live credential that spends the owner's prepaid credits:

- Never ask for it in chat, print it, log it, commit it, or put it in browser
  code. The app only ever tells the browser whether a key is set.
- Locally it lives in `.env` (see `.env.example`), which Git ignores and
  Wrangler reads. Do not add a `.dev.vars` file: when one exists, Wrangler
  stops reading `.env`.
- The owner creates and funds a key at <https://freebuff.com/account/api>
  (Freebuff Desktop: Account → Developer API). Desktop can write the key into
  this project's `.env` from that page. In Freebuff Cloud, the owner adds it as
  a project secret named `OPENAI_API_KEY` in the project's settings; it reaches
  the dev server through `.env.local` on the next turn.
- On Freebuff Sites, after the first deploy, the owner sets `OPENAI_API_KEY` in
  Sites → Secrets (or you use `sites_set_secret` with a file the owner provided,
  without reading it). Deploy once before setting secrets.
- Suggest a monthly spend limit on the key, named after this app. The key's
  limits are the hard ceiling; the app's limits below are the soft one.

`OPENAI_BASE_URL` is optional and defaults to `https://freebuff.com/api/v1/paid`.

## How the Freebuff API works

It is OpenAI-compatible: `POST {base}/chat/completions` with `model`,
`messages`, `max_tokens` and optionally `stream`, authenticated with
`Authorization: Bearer fb_live_…`. `GET {base}/models` (no auth needed) lists
the models with `capabilities.streaming`; only some stream, and `stream: true`
on one that does not is a 400, so `src/worker/ai.ts` checks first and yields
the whole reply at once when streaming is off. Unknown request fields are
rejected; images, audio and embeddings are not supported.

Errors come as `{ "error": { "code", "message" } }`: `401 invalid_api_key`,
`402 insufficient_funds`, `403 key_disabled`/`model_not_allowed`,
`404 model_not_found`, `429 rate_limit`/`spend_limit`, `503` when a model is
unavailable. `ai.ts` maps each to a sentence the app can show. Requests are
billed from the key owner's prepaid balance by tokens, at the rates the
dashboard shows per model; a reply the API refuses costs nothing.

## Connect it to Freebuff Sites

1. `sites_create`, then `sites_add_storage` for D1 named `DB`.
2. `sites_enable_auth` (pass `http://127.0.0.1:5180` as the local origin while
   developing). Put the development variables in `.env` to use real accounts
   locally.
3. `bun run build`, then `sites_deploy` with `deploy.json`.
4. The owner sets `OPENAI_API_KEY` in Sites → Secrets. Until then the deployed
   app shows the setup card.

Sign in with Freebuff is required on a deployed site: without it nobody can
chat, because every reply spends the owner's credits.

## Where things are

- `src/shared/config.ts`: name, tagline, system prompt, `MODELS` (the picker
  and the server-side allowlist), `DEFAULT_MODEL`, `DAILY_MESSAGE_LIMIT`,
  context and length caps, suggestions.
- `src/worker/` is the Hono API. `ai.ts` talks to the Freebuff API (model
  capabilities, streaming, error mapping). `public-ai.ts` streams the free hosted
  lanes and rests ones that hit a rate limit; `blend.ts` runs the adaptive deep
  pass (plan, drafts, review, synthesis); `search.ts` combines keyless sources
  and optional Exa results; `plan.ts` turns a search-worthy question into a few
  bounded, refined queries; `proof.ts` builds the contract and runs the
  deterministic checks and the independent test factory; `routes/proof.ts`
  accepts the browser's run report and applies the verdict.
  `routes/chat.ts` is one turn: it
  checks the limits, stores the question, streams the reply as server-sent
  events and stores it when done, keeping a stopped reply's partial text;
  `memory.ts` incrementally condenses turns that have left the context window.
  `routes/conversations.ts` lists, renames, moves and deletes chats;
  `routes/projects.ts` owns project CRUD and assignment; `routes/account.ts`
  serves `/me` (capabilities and today's usage) and `/models`. `db.ts` owns the schema (created on first request), `auth.ts`
  the Freebuff integration and the loopback-only development user, `seed.ts`
  the sample conversation.
- `src/app/` is the React app. `pages/Chat.tsx` is the thread and composer;
  `lib/turn.ts` holds the reply in flight so it survives the move from `/` to
  `/c/:id`; `lib/stream.ts` reads the event stream; `components/Markdown.tsx`
  renders replies (no raw HTML, links open in a new tab); `components/ui.tsx`
  holds the primitives.
- `public/proof-runner.html` is the opaque-origin Pyodide runner for Proof's code
checks; it loads a pinned Pyodide build and never has app storage or cookies.
`src/styles.css` holds the design tokens and the reply typography.
  Everything rounded is a squircle via `corner-shape`; true circles use the
  `round` class.

## Security notes

Every `/api/*` route requires a signed-in user and scopes queries by
`owner_sub`; mutations must be same-origin. The Worker refuses any model that is
not in `MODELS`, caps messages at `MAX_MESSAGE_CHARS`, sends at most
`MAX_CONTEXT_MESSAGES` of history and `MAX_OUTPUT_TOKENS` per reply, and allows
`DAILY_MESSAGE_LIMIT` replies per user per UTC day (counting stopped and
regenerated ones; refused requests are free). Keep these when extending the
app, and keep the development user loopback-only: on a deployed origin it must
never activate. Personalised responses are `Cache-Control: private, no-store`. When web search
is enabled, the user's question is sent to Exa; keys stay server-side.
