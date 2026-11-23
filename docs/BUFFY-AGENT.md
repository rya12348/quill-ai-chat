# Buffy Code — Agent mode

Status: **spec, not built.** No code exists for this yet. Written 2026-11-19.

The owner's requirement, in their words: *"make it exactly like you — you reach the
browser, whatever way you reach the browser, add that; whatever way you code, read
files, search, terminal — everything."* And: **10–40 model calls per turn, for
everyone, not a gated feature.**

This document is that contract. It replaces nothing: Build mode stays exests.

---

## 1. What agent mode is

Today `POST /api/buffy/code` is a fixed pipeline: prompt → one edit call → apply →
`planVerification` (the single hardcoded command) → one repair → render pages. The
*plan* is compiled into the handler, so the model never chooses what happens next.

Agent mode moves the plan into the model at runtime:

```
prompt → [ model picks one action ] → execute → observe → repeat → finish
```

Output is a **transcript**: every action, its exit code, its output, and a final
answer. A webpage is one possible side effect, not the required shape of the
result. `kind: 'page'` stops being mandatory.

The loop itself already exists in this repository: `src/worker/browser-agent.ts`
runs snapshot → decide → act → snapshot with `MAX_STEPS = 24` and
`RUN_BUDGET_MS = 180_000`. Agent mode generalizes that same loop from browser
actions to any tool.

## 2. Non-goals

- Not a replacement for Build mode. Website requests still take the page pipeline.
- Not a deployer. `deploy` exists as a tool that requires explicit user approval.
- Not persistent between turns except through the workspace (files) and a short
  run summary. No long-term memory in v1.
- Not a way around `AGENTS.md`. The Ink cloud-browser session (`/api/browser/*`)
  is untouched and remains the AI Agent's alone.

## 3. Tool parity

Every tool the assistant has, mapped. "Exists" means the work is already in the
tree and only needs a dispatcher entry.

| Assistant tool | Buffy Code tool | Implementation | Status |
|---|---|---|---|
| `read_files` | `read_file` | `workspaceReadResults` | exists |
| `write_file` | `write_file` | `normalizeWorkspace` + limits | exists |
| `str_replace` / `apply_patch` | `patch_file` | `parseWorkspaceEdits` / `applyWorkspaceEdits` | exists |
| `glob` / `list_directory` | `list_files` | `workspaceTree` | exists |
| `code_search` | `search_files` | `grep -rn` inside the sandbox VM | new, small |
| `run_terminal_command` | `run_command` | `runWorkspaceSandbox` with a caller-supplied command | exists (needs one option) |
| `process_start` / `read` / `write` / `stop` | `process` (PTY) | persistent PTY in the VM | new, see §7.1 |
| `read_url` | `fetch_url` | `fetchReadablePage` (`src/worker/doc-fetch.ts`) | exists |
| rendered page → text | `web_read` | Browser Run `/markdown`, `/links`, `/scrape`, `/json` | new, binding |
| `web_search` | `web_search` | `researchNotes` (`src/worker/research.ts`) | exists |
| `preview_snapshot/click/type/press/scroll/navigate/screenshot/evaluate` | `browser` | `browser-agent.ts` action set, unchanged | exists |
| `spawn_agents` | `spawn_subagent` | recursive turn with a split budget | new |
| `generate_image` | `image` | Workers AI binding | new |
| deploy / hosting / DB | `deploy` | approval-gated, never autonomous | new |
| Gmail and other integrations | `gmail_*` etc. | user-granted OAuth | later |
| templates | `template` | `src/shared` template seeds | optional |

### 3.1 Full audit — everything else the assistant can do

The table above is the core. This is the rest of my toolset, audited one by one,
with a disposition for each. Nothing here is refused on principle; each item is
either built, or deferred with a reason.

| Capability | Disposition |
|---|---|
| `glob` patterns (`**/*.ts`) | `glob_files` tool — new, a pattern filter over the workspace tree |
| per-command `cwd` and timeout | `run_command` args `cwd`, `timeoutMs` |
| interactive stdin (REPLs, prompt-driven CLIs) | `process` tool — persistent PTY in the VM, start/read/write/stop |
| user-visible terminal pane | not ported: the VM has no user shell; the timeline is the UI |
| admin elevation | n/a: there is no host to elevate on |
| file-change hooks (auto lint after edit) | replaced by an explicit `run_command`; anything that fires on every write silently eats the call budget |
| show a file to the user | `reveal` field on the result → an “open” button per changed file |
| viewport resize, dark mode | `browser` actions `resize`, `color_scheme` |
| record a session as video | deferred v1: needs storage plus ffmpeg in the VM |
| show the running dev server to the user | `previewUrl` on the result, from `sandbox.domain(port)` — the only way a person sees a live local preview |
| up to 6 parallel subagents | `spawn_subagent` takes a list; 3 concurrent, budget split |
| ask the user a question with options | `ask` tool → SSE `question`, the turn waits, a reply costs no model call |
| plan / todo list | `plan` tool, rendered above the timeline (`src/worker/plan.ts` already exists) |
| memory of earlier turns | `src/worker/memory.ts` summary injected as context, same as Build mode |
| read a user's uploaded file (PDF, CSV, image) | `attachment` tool: staged in the workspace, text read normally |
| look at an image | vision-capable lane only; otherwise a text fallback, never a silent guess |
| service discovery (my gravity index) | deferred v1: needs a hosted catalog and a key |
| per-account skills | deferred v1: no user skill store on this Worker |
| provision D1 / R2 / auth / realtime | `hosting` tool, approval-gated exactly like `deploy` |
| integrations (Gmail and the rest) | `integrations` behind per-user OAuth — later slice |
| starter templates | `template` tool — optional |
| a button or link in the answer | `ask` with options covers it |

Three rules that came out of this audit and are not negotiable in the
implementation:

- **A tool that runs on every write is a tool that breaks the budget.** This is why
  there are no file-change hooks: the model decides when to check, and every check
  is visible as a step.
- **Anything that leaves the VM is approval-gated.** Deploy, hosting, commit, push.
  Approval is a user click, never a model decision.
- **A capability with no disposition is a bug in this document.** If something is
  added to the assistant later, it gets a row here in the same change.

### Parity exceptions (physical, not policy)

1. **The user's computer.** The assistant runs commands on the real Windows machine
   and drives packaged Chrome as a GUI. Buffy Code gets a disposable Linux VM. Same
   terminal, different machine.
2. **The model.** Same tools and same loop, different model and context window.
   Tool parity is achievable; identical reasoning is not.
3. **Deploy.** The assistant deploys only when the user asks, per action. Buffy Code
   keeps that rule in code: `deploy` returns an approval prompt and never runs
   autonomously.

## 4. Step protocol

One model call returns exactly one JSON object. Nothing else — no prose, no fences.

```json
{ "tool": "run_command", "args": { "command": "node -e \"console.log(1+1)\"" }, "thought": "check the runtime" }
```

Rules:

- `tool` must be in the registry. An unknown name is a **hard step failure**, fed back
  as: `unknown tool "deploy_prod"; available: list_files, read_file, …`.
- `args` is validated against the tool's schema before execution. Wrong shape is a
  step failure with the expected shape in the message. Two consecutive malformed
  steps end the turn (`reason: 'protocol'`).
- `thought` is optional, ≤ 200 chars, shown in the UI, never sent to a shell.
- Tolerated tolerance for real models: strip a leading ```` ```json ```` fence, and
  accept a bare tool name only if the model sent no JSON at all *and* the tool takes
  no required args. Everything else is rejected rather than guessed.
- `finish` is the only graceful exit:

```json
{ "tool": "finish", "args": { "answer": "The tests pass; the failure was a stale fixture.", "status": "done" } }
```

`status` is `done` | `blocked` | `failed`. The UI shows it verbatim; the loop never
overrides it with a claim of success.

## 5. The loop

```
state = { files, transcript[], calls=0, startedAt }
budget = 24 calls / 300s wall / 40 commands   (see §6)
while calls < budget.calls and now < deadline and !aborted:
    call model with system + workspace tree + last 6 observations
    calls += 1
    step = parse(raw)                      // malformed → observe the error, continue
    if step.tool == 'finish': return result(step)
    outcome = execute(step)                // per §7, always returns {ok, output}
    transcript.push({ step, outcome })
    observe(truncate(outcome.output, 4_000))
return result({ status: 'budget' })
```

- Observations are truncated, not summarized by another model call — every call is
  budget.
- The workspace tree is re-sent each call, changed files only by diff marker, so the
  model does not re-read what it already wrote.
- A repeated identical action (same tool + same args) three times in a row is short-
  circuited: the observation becomes `you already ran this; it returned X` and the
  call still counts. `browser-agent.ts` already does this with
  `actionSignature`/`MUTATING_TOOLS`.
- `spawn_subagent` divides the remaining budget: the child gets `floor(remaining × 0.4)`
  and the parent keeps the rest. No child may exceed depth 2. It accepts a list of
  up to 3 tasks, run concurrently, and their observations are merged in order.
- **Continuations.** A turn that ends `budget` is not a dead end: `POST /code` with
  `resume: true` keeps the files and the last 12 transcript steps and grants a fresh
  budget. At most 3 continuations per conversation, so a loop cannot be extended
  forever by asking again.
- **Cancellation is immediate.** The abort signal reaches the in-flight model call,
  the running command, and every process; the `finally` blocks still run.

### 5.1 When it goes wrong, the loop recovers before it gives up

Most "the agent errored / stopped / did nothing" reports had one of six causes,
and each is now handled rather than reported:

| What happened | Why | What the loop does now |
|---|---|---|
| "It did nothing" | The model called `finish` first, describing work it never did | one push: an observation saying nothing has run yet, then it takes the answer |
| "Not the step format" | Prose instead of JSON; two strikes was too few | three strikes, and the rejection quotes the reply's own opening words |
| Empty reply from a lane | A lane blip counted as bad formatting | retried as a dropped call, costing the same budget slot |
| "Unknown tool \"bash\"" | Right intent, wrong spelling | alias table (`bash`/`shell`/`execute` → `run_command`, `grep` → `search_files`, …) |
| Empty command from `{"tool":"run_command","command":"ls"}` | Flat arguments rejected | flat args are read as the arguments |
| Turn died mid-task | A throwing sandbox call escaped the loop | one replacement VM, files re-synced into it; two failures still end it |

A failed sandbox call also no longer escapes `runCommand`: a thrown connection
error is a dead-VM signal, not an exception that ends the turn.

## 6. Budget

The owner's decision: **10–40 calls per turn, everyone.**

| Limit | Value | Why |
|---|---|---|
| `calls` | 20 default, 40 hard ceiling, allowance never configured below 10 | the owner's range, defaulted down for the subrequest cap below |
| wall clock | 300s | longer than the browser agent's 180s, because builds exist |
| commands | 40 | a script counts as one, but a runaway loop must still stop |
| per command | 90s | `SANDBOX_LIMITS.commandMs` |
| sandbox total | 240s | `SANDBOX_LIMITS.totalMs` |
| observation | 4 000 chars | keeps the context from being eaten by one stack trace |
| subagent depth | 2 | recursion without a fork bomb |

### The real ceiling is the platform, not this table

Measured on production: a 30-step request died at step 23 with **"Too many
subrequests by single Worker invocation"**. Cloudflare Workers on the free plan
allow **50 subrequests per invocation**, and a step costs about two — one model
call and one sandbox command — plus the sandbox boot and any file sync. So a
24-call budget is not reachable on a free Worker no matter what this table says.

Three consequences, all shipped:

- File syncs are batched into one command instead of one per file (a five-file
  project used to spend five subrequests before a single command ran).
- A subrequest-cap error ends the turn immediately with a plain explanation; it
  is not retried, because a capped Worker cannot fetch again.
- The default is **20** rather than 24, which leaves headroom under 50. On a paid
  plan (1000 subrequests) raising it back to 24–40 is a one-line change.

**There is no minimum usage.** 10 is the floor of the *allowance*, not a quota to spend.
A turn ends the moment the model calls `finish` — after 2 calls if that is all the task
needed. A simple question is 0 calls; a one-file fix is 1–3; 20–40 only appears on
multi-file work. Padding a turn to reach a number would waste money and make the
result slower for no gain.

A "call" is one model completion. A turn that only writes and runs a script uses 3.

Budget exhaustion is a normal ending, not an error: the result carries
`status: 'budget'`, the transcript is kept, the files are kept, and the UI says how
many calls were used. Half-finished work is shown as half-finished.

Per-IP limits (`rateLimit`, `RATE_WINDOWS`): 6 agent turns / 10 min, and sandbox
runs keep their existing 8-per-window cap. The cap that bites is the sandbox, not
the tokens.

## 7. Tools

All paths go through `safeWorkspacePath`. Output is truncated to `trimOutput`'s
limits before it reaches the model.

| Tool | Args | Returns | Notes |
|---|---|---|---|
| `list_files` | — | tree | `workspaceTree` |
| `read_file` | `path`, `offset?`, `limit?` | numbered lines | 400 lines max per read; `absent` paths from a repo import are named as such |
| `search_files` | `pattern`, `glob?` | `path:line: text` | `grep -rn`, 60 hits max |
| `write_file` | `path`, `content` | created/updated | workspace limits enforced |
| `patch_file` | `path`, `search`, `replace` | applied/rejected | exact-match, fails loudly |
| `run_command` | `command`, `timeoutMs?` | `exitCode`, `output` | `sh -lc` in the VM; network per §8 |
| `fetch_url` | `url` | text (≤ 8 000 chars) | `fetchReadablePage`; refuses `file:`, `data:`, private IPs. Shipped |
| `web_read` | `url`, `format` | markdown/html/links/json | Browser Run Quick Action. Not shipped |
| `web_search` | `query` | titles + URLs + snippets | `webSearch` + `searchPrompt`. Shipped |
| `browser` | `action`, plus per-action args | observation | snapshot, click, type, press, scroll, wait, navigate, screenshot, evaluate, **logs** — two backends, see §8 |
| `spawn_subagent` | `tasks[]` (≤ 3) or `task`, `tools?` | child answers | concurrent, split budget, depth ≤ 2 |
| `image` | `prompt`, `aspect` | file written to workspace | Workers AI |
| `deploy` | — | approval prompt | never runs without an explicit user click |
| `finish` | `answer`, `status` | ends the turn | required |
| `glob_files` | `pattern` | matching paths | `**/*.{ts,tsx}`; new |
| `process` | `op` (`start`/`read`/`write`/`stop`), `id?`, `command?`, `data?` | output ring buffer, alive | persistent PTY in the VM; max 3 running |
| `git` | `op` (`status`/`diff`/`log`/`clone`), `args` | output | `clone` allowed; `commit` needs approval; `push` never |
| `attachment` | `path` | text, or an image reference | files the user uploaded, staged in the workspace |
| `ask` | `question`, `options?` | the user's answer | pauses the turn; no model call consumed |
| `plan` | `items[]` | rendered checklist | no side effects; shown above the timeline |

**Shipped so far (slice 1 + 2a + memory + browser):** `list_files`, `search_files`,
`read_file`, `write_file`, `patch_file`, `run_command`, `fetch_url`, `web_search`,
`browser`, `notes`, `finish`. Everything else in the table above is the design for slices
3–4, not a promise about today.

Both web tools spend one subrequest each and share a hard allowance of **4 per
turn** (`AGENT_WEB_MAX`), because the free plan's 50 subrequests are the binding
constraint. A URL read twice in a turn is served from the turn cache, and a
fragment (`#section`) is stripped before comparing, since it never changes what is
served. When the allowance is gone the tool says so and the model has to work with
what it has.

### 7.0 Memory: notes, and how much one step shows

The narrowest thing about the first loop was not its tools: 20 calls that each
show 4 000 characters forget the plan before the task is done. Three changes,
none of which costs a subrequest:

- **`NOTES.md`.** The `notes` tool replaces a plan file the model keeps: two to
  five lines of plan before the first edit, updated when a step changes it, plus
  what it learned. The file is an ordinary workspace file, so it is saved with the
  project and is already on disk next turn; the route also seeds the turn's first
  message with it (`AGENT_NOTES_PATH`, 4 000 characters). A short transcript stops
  being fatal when what matters is written down instead of remembered.
- **24 000 characters per observation** (`AGENT_OBSERVATION_CHARS`, was 4 000,
  then 10 000). 4 000 is about sixty lines — enough to cut a test failure off
  before the error and a file off mid-function. 24 000 is a whole source file or a
  400-line slice of one. `trimOutput` keeps the head and the tail, and a compiler
  puts the reason at the tail.
- **A character budget instead of "the last N steps"** (`AGENT_HISTORY_CHARS`
  48 000). The newest step is always whole, because that is the one being reasoned
  about; older steps shrink to a head-and-tail of 1 500 characters each until the
  budget is spent, and stop at ten steps whatever their size. A fixed window was
  wrong in both directions: it wasted the prompt on six small steps and dropped
  the big one that mattered.
- **The notes ride in the system message on every call**, so the plan survives the
  history budget and a step that goes badly. They are labelled as coming from an
  earlier turn, because a plan from a different task is worse than no plan: the
  first version presented stale notes as this task's plan and the model answered
  in prose instead of a step.
- **`search_files`.** `grep -rnI --include=<glob> -e <pattern>`, 150 hits, one
  command. Reading five files to find one name is what used to burn the memory.

Measured on production: a 400-line, ~19 000-character file could be read and line
380 quoted exactly — impossible when an observation was 4 000 characters.

### 7.1 Process control

`run_command` is one-shot. Real terminal work needs a process that stays alive and
can be talked to: a REPL, a prompt-driven CLI, a watcher, a dev server whose output
you read later. So `process` wraps a PTY in the same VM:

```
process start  "npm run dev"        → id=p1, output streaming
process read   p1                  → last 4 000 chars
process write  p1 "q"              → answer its prompt
process stop   p1
```

Limits: 3 concurrent processes, a 64 KiB ring buffer per process, every process
killed in the sandbox's `finally` block whether the turn succeeded or not. A
process that outlives its turn is a leak, and leaks are how a free tier dies.

### 7.2 Files the user brings

An uploaded file lands at `uploads/<name>` in the workspace, so it is readable by
`read_file` and by any command. Text and structured formats are read normally.
Images go to a vision-capable lane only; if the lane cannot see images, the turn
says so rather than describing a picture it never saw. Nothing uploaded is executed,
and uploads never survive the turn unless they are written into the workspace
proper.

### 7.3 Asking instead of guessing

When a decision is genuinely the user's — which of two designs, whether to overwrite
a file, which account to use — the agent calls `ask`. The SSE stream emits
`question: { id, text, options[] }` and the turn blocks. An answer arrives as a
normal `POST /code` with `answer: { id, value }`, and it costs **no model call** —
it is user input, not a completion.

If no answer arrives within 120s the turn returns `blocked` with the question in the
transcript. It does not pick for the user. Guessing is how an agent ruins work that
was fine.

### 7.4 The one change the tools need in the sandbox

`run_command` needs one change in `src/worker/sandbox.ts`: accept
`{ command: { label, steps, network } }` and skip `planVerification`. The rest of the
create/write/run/stop plumbing is reusable as-is.

## 8. Browser: Browser Run, not Steel

`AGENTS.md` is explicit — only `Browser.tsx` and `BrowserView.tsx` may call
`/api/browser/*`, and the Steel session is three shared, hourly-billed slots. Agent
mode does not touch it.

Instead, in order of cost:

1. **`fetch_url`** — plain fetch, no browser, no quota. Tried first.
2. **`web_read`** — Cloudflare Browser Run Quick Actions via the `env.BROWSER`
   binding (`quickAction()`), no API token, compatibility date ≥ **2026-03-24**.
   Endpoints: `/markdown`, `/content`, `/links`, `/scrape`, `/json`, `/screenshot`,
   `/snapshot`.
3. **`browser`** — a real Chrome, in one of two places (§8.1). Never Steel.

Caching is part of the design, not an optimization: Quick Actions bill in browser
hours and the free allowance is 10 minutes/day. `web_read` results are cached in D1
keyed by `sha256(url + format)`, TTL 6h, so a popular page costs one render.

`browser` actions are restricted to an allowlist of hosts for anonymous users. A
host outside the list returns `not allowed for this session`, not a silent failure.

**Verify before depending on this:** that the `browser` binding and the
2026-03-24 compatibility date work on the Pages deployment (`ink-jo3`). If the
binding is unavailable, `web_read` falls back to `fetch_url` + readability and the
`browser` tool reports `browser unavailable` instead of pretending.

**State today.** Steps 1 and 3 are live: `fetch_url`/`web_search` on the four-request
allowance, and `browser` driving a real Chrome through `env.BROWSER` with
`@cloudflare/puppeteer` (8 actions per turn, one session per turn, closed however
the turn ends). The binding is declared in `pages/wrangler.jsonc`,
`pages-alt/wrangler.jsonc` and `wrangler.jsonc`, and `/api/ready` reports
`browser: true` when it resolves. Measured on production: open example.com → click
"Learn more" → read the URL and title of iana.org/help/example-domains.

`web_read` (the old step 2) is not needed: the browser tool renders JavaScript far
better than Quick Actions would. Only step one of the original list, `fetch_url`,
remains. The compatibility date is already
2026-09-29, but `pages/wrangler.jsonc` declares **no `browser` binding**, so
`web_read` is not wired and the agent is not offered it. Live acceptance for 2a:
"read the Cloudflare limits page and write the number to a file" finished in 4
steps with 3 web requests (page, `#subrequests` fragment, search) and the correct
answer, 50. Jumping to 2b means: add the binding, redeploy, verify it resolves,
and accept that each render eats one of the four requests.

### 8.1 How it physically tests what it built

This is the part a remote browser cannot do. Browser Run and Steel both run outside
the sandbox, so neither can open `http://127.0.0.1:3000` inside the VM. Testing the
site it just wrote needs the browser **in the same VM**:

```
run_command: npm run dev &   (detached, log to /tmp/dev.log)
browser navigate http://127.0.0.1:3000      → in-VM Chrome
browser logs                                → console errors + failed requests
browser snapshot                            → accessibility tree
browser click / type / press                → real DOM events
browser screenshot                          → file in the workspace
browser evaluate '<js>'                     → assert on real state
```

So `browser` has two backends, chosen by the target URL, not by the caller:

| Target | Backend | Why |
|---|---|---|
| `127.0.0.1`, `localhost`, or a `sandbox.domain()` port | **in-VM headless Chromium** (Playwright, CDP on a loopback port) | only thing that can see the dev server; no browser-hour billing |
| any public host | Browser Run session | no Chromium install, JS rendering, concurrency-managed |

The in-VM backend needs work the first time: Amazon Linux has none of Chromium's
shared libraries, so a fresh VM wants `dnf install` of the system deps plus a
browser install. That is slow (tens of seconds) and it would land inside the 300s
turn. Two mitigations, cheapest first:

1. **Reuse the session.** Boot one VM per turn, install once, keep it for the whole
   turn. Fits slice 3.
2. **A pre-baked snapshot.** Build a Vercel Sandbox snapshot with Chromium and its
   libs already present, then every turn starts in sub-second. This is the documented
   pattern and the version to do before this ships to real users.

Chromium in a microVM launches with `--no-sandbox`: the container's renderer
sandbox needs user namespaces the VM does not provide, and the hypervisor is the
isolation boundary here, not Chrome's sandbox.

**Screenshots are not observations by default.** A screenshot is written to the
workspace and shown to the user. The model's observation is the accessibility tree
plus `logs`, because not every lane accepts images, and a text tree is what the
loop can reason about. If the selected lane is vision-capable, the screenshot may be
attached as an extra observation — never as the only one.

### 8.2 Verifying a deploy

`AGENTS.md` requires shipping to and verifying against
`https://www.inkbrowser.dpdns.org`. So `deploy` is two steps, not one: the approval
prompt, then — after the deploy succeeds — `browser navigate <production URL>` and
the same console/network/snapshot checks the local preview got. A deploy with no
verification is reported as `deployed, unverified`, never as working.

### 8.3 Full action set, and where it differs from the assistant

Every action `browser-agent.ts` already implements is available to the loop:

- **Observe:** `snapshot` (accessibility tree), `screenshot`, `logs` (console +
  network requests), `evaluate` (run JS, return JSON).
- **Act:** `navigate`, `back`, `forward`, `reload`, `click`, `dblclick`, `type`,
  `fill`, `select`, `check`, `hover`, `press`, `scroll` (to element), `wait`
  (selector | text | network-idle | ms).
- **Page-level:** `edit_page` (mutate the live DOM to try a fix) and
  `run_page_code` (execute in page context) — inherited from the agent, kept behind
  the same mutating-action guard.

Parity with the assistant's browser, item by item:

| Capability | Assistant | Agent mode v1 | Note |
|---|---|---|---|
| Open, click, type, scroll, key press | yes | **yes** | same actions |
| Read console + network after acting | yes | **yes** | `logs`, added in §8.1 |
| Evaluate JS and assert on state | yes | **yes** | `evaluate` |
| Screenshot | yes, and I can look at it | **saved + shown** | the model reasons on the tree unless its lane takes images |
| Multiple tabs | yes | **v1.5** | one context, up to 4 pages, `tabs` action; until then one page per turn |
| A logged-in session reused across turns | yes, tabs persist | **no** | fresh browser each turn; cookies die with the VM. Persisting sessions means storing someone's credentials — a decision, not an oversight (see §16) |
| File upload (`input[type=file]`) | yes | **no** | needs a staging path from workspace → browser; small, unscheduled |
| Downloads captured to the workspace | partial | **no** | `page.waitForEvent('download')` in the VM, then write to workspace |
| Cross-origin iframes | partial — I hit this limit with Ink's proxy | **partial** | same-origin frames are in the tree; cross-origin frames need a CDP frame target to pierce |
| CAPTCHA / bot check | no | **no** | neither of us solves it. The turn ends `blocked` with what it saw |
| 2FA / phone verification | no | **no** | human step, always |
| Long unattended flows | yes | **capped** | 60s page timeout, 300s turn |

Two honest notes on the remote backend:

- **Cloudflare's IPs get challenged more than your home IP.** Sites behind bot
  protection will sometimes serve a wall to Browser Run and not to you. That is a
  property of where the browser sits, not a bug in the loop.
- **The free tier's 60s page timeout** is short for a heavy SPA. `browser` reports
  `timed out` instead of a half-loaded tree; a paid tier raises it.

So: **doing things on public websites — yes, at parity on every action.** What it
does not have is your browser's *memory* (logins, tabs, history) or your network
reputation, and those two cause most of the "why does it work for you and not for
it" moments.

## 9. Result

`BuildInfo` gains one kind and one field:

```ts
kind?: 'page' | 'embed' | 'task'
/** Agent mode: what it did, in order. */
steps?: AgentStep[]

type AgentStep = {
  tool: string
  label: string          // "run_command: npm test"
  status: 'done' | 'error'
  detail: string         // ≤ 400 chars for the UI; full text stays server-side
  ms?: number
  call?: number
}
```

A `task` result still carries `files` (the workspace after the turn) so Build mode
can pick up where Agent mode stopped. `html` is a small note, exactly like the
existing `buildWorkspaceReceipt`.

## 10. Events

Reuses the existing SSE channel and event names, so the client needs no new
transport:

| Event | Payload | When |
|---|---|---|
| `status` | `{ text }` | existing; the model's `thought` and phase changes |
| `tool_call` | `{ id, label, detail, state }` | before each execution (existing shape) |
| `tool_result` | `{ id, state, detail }` | after (`done` / `error`) |
| `budget` | `{ used, limit }` | after each call, so the meter is live |
| `done` | `{ text, build }` | final; `build.kind === 'task'` |

No new endpoint. `POST /api/buffy/code` takes `mode: 'agent'` (default `'build'`).

## 11. Route branch

In `src/worker/routes/buffy.ts`, before the edit pipeline:

```
if (mode === 'agent') → runAgentTurn()
else if (looksLikeTask(prompt) && workspaceFiles.length) → runAgentTurn()
else → existing pipeline
```

`looksLikeTask` is deliberately narrow, because the page pipeline is better at
pages: it fires on an explicit shell/terminal/test/debug/script verb **and** the
absence of a build verb (`isBuildRequest`). Ambiguity goes to Build mode.

Workspace writes are persisted exactly as an edit turn persists them, so `reset` and
`revert` keep working. `revert` restores the pre-turn snapshot.

## 12. UI

- A **Build / Agent** toggle in Buffy Code, Build default.
- Agent result pane: timeline rows (`▸ run_command · npm test · exit 1 · 2.1s`),
  expandable output, final answer, and a `12 / 24 calls` meter.
- A **Stop** button that aborts the controller — same path as today's cancel.
- Empty-workspace Agent turns start from nothing, not from a generated page.
- Failure copy is literal: `Stopped after 24 calls. Here is where it got to.` No
  "done" on a budget exit.

## 13. Abuse surface

**`AGENT_UNLIMITED=1` is an owner-only switch.** It lifts the per-turn calls,
browser actions, web requests, commands, wall clock, the per-hour sandbox limit
and the daily turn limit — for the deployment owner and nobody else.
`isDeploymentOwner()` matches `OWNER_SUB` (the account, when auth is on) or an
address listed in `AGENT_OWNER_IPS` (when the deployment runs as guests, which is
how `ink-harbor-2f9` runs today: auth is off, so every visitor is a guest and
`OWNER_SUB` can never match). With neither configured, nobody matches — the safe
default for a switch that removes spending limits.

Verified on production: the owner's machine reports
`agentUnlimitedForCaller: true`, a request through a proxy from another address
reports `false`, and `/api/ready` shows both the flag and the caller's own
address, so the allowlist can be filled in without guessing.

- Anonymous users get a shell in a disposable VM: no host filesystem, no
  persistence, torn down in `finally`.
- Network: the agent shell is registry-only — `allowedDomains` is the npm
  registries (`SANDBOX_NETWORK_DOMAINS`), so `npm install` works and every other
  host is blocked. The one-shot verifier keeps the same allowlist when it plans
  an install and `deny-all` otherwise. `web_read` and `fetch_url` are the only
  open-network paths, and both are SSRF-guarded (no private ranges, no `file:`).
- Nothing pushes, publishes, or deploys without an explicit approval step.
- Every limit is server-side. The client sends `mode`, never budgets.
- **Secrets never leave.** `run_command` output is scrubbed for secret shapes
  (`sk-`, `ghp_`, `AKIA`, long hex) before it reaches the model or the UI, `.env`
  contents are never echoed into the transcript, and a secret read is reported as
  `redacted` rather than shown.
- **Git is read-only by default.** `clone` and `status`/`diff`/`log` are free;
  `commit` needs approval; `push` does not exist as a tool.

## 14. Cost

- **Model calls:** 24 calls/turn default, 40 ceiling. This is the dominant cost and
  the reason the ceiling exists. Free lanes keep it near zero dollars and raise
  latency; Duck cannot serve this loop at all (one single-use proof per request).
- **Sandbox:** one boot per turn, existing 8/window cap.
- **Browser hours:** 10 min/day free, then $0.09/hr. Cached reads are what keep this
  from being the bill.

## 15. Build order

Each slice ships and is measured on its own.

1. **Shell.** `run_command`, `write_file`, `read_file`, `list_files`, `finish`.
   Loop + result + timeline. Accept: "write a script that prints the first 10 primes
   and run it" completes in ≤ 5 calls with real output.
2. **Web.** `fetch_url`, `web_search`, `web_read` + D1 cache. Accept: "read this URL
   and summarize it in 5 bullets" with a JS-rendered page.
   *(2a shipped: `fetch_url` + `web_search`, 4-request allowance, live-tested on
   prod. 2b — `web_read` plus the D1 cache — waits on the `browser` binding and
   the subrequest headroom a browser render costs.)*
3. **Browser.** `browser` tool, both backends: in-VM Chromium for a local dev
   server, Browser Run for public pages, plus `logs`. Accept: (a) the browser
   benchmark's existing task set through this loop, and (b) "start the dev server,
   open it, click the button, and tell me what the console said" passes with zero
   hand-holding.
4. **Depth.** `spawn_subagent`, `search_files`, long-running processes. Accept: "find
   where this string is used and change all of it" across 20 files.

## 16. Open decisions

1. Which image/browser credentials are funded (Workers AI, Browser Run paid tier).
2. Whether `deploy` ships at all, or stays out of v1.
3. Whether anonymous users get `browser` at all, or only signed-in accounts.
4. Session persistence: does a workspace keep a browser cookie jar between turns
   (convenient, and it means storing session cookies), or does every turn start
   signed out (safe, and every login is repeated)? v1 is signed out.
5. `ask` blocks the turn for up to 120s. Is that acceptable on a public endpoint, or
   should the agent always decide and report the assumption?
6. Continuations: 3 per conversation is a guess. It multiplies the worst-case cost
   of a single user's session by four.
4. Whether Build mode's page pipeline becomes callable as a `build_page` tool from
   inside the loop (recommended: yes, in slice 4).
