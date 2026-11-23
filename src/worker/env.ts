import type { FreebuffUser } from '@freebuff/auth'

export interface Env {
  ASSETS: Fetcher
  // Attached by Freebuff Sites once provisioned (sites_add_storage). Optional so
  // the app can explain what is missing instead of crashing.
  DB?: D1Database
  // Attachment bytes live in R2; D1 keeps only their metadata. Optional so
  // local development still works with the legacy D1 fallback before storage
  // is provisioned.
  FILES?: R2Bucket
  // "1" lifts Buffy Code's own per-turn and per-day caps, for the deployment
  // owner only (OWNER_SUB, or an address in AGENT_OWNER_IPS when auth is off).
  // Temporary switch; it does not lift platform limits.
  AGENT_UNLIMITED?: string
  /**
   * Comma-separated model substrings the agent should try first, best first —
   * e.g. "gpt-oss-120b,qwen3.8". A lane that is not listed keeps its normal
   * order after the listed ones. Empty means the built-in order.
   */
  AGENT_LANE_PREFERENCE?: string
  /** Comma-separated addresses that count as the owner when auth is off. */
  AGENT_OWNER_IPS?: string
  // Cloudflare Browser Rendering. Present when pages/wrangler.jsonc declares
  // the binding; the coding agent's `browser` tool uses it. Not the Steel
  // session behind /api/browser/*.
  BROWSER?: unknown
  // Optional override: "browserbase", "hyperbrowser" or "steel". Browserbase
  // is the default when configured because it is the more reliable session path.
  BROWSER_PROVIDER?: string
  // Optional model id for browser planning only. The default is a fast
  // Qwen 3.8 lane; set this to pin another browser-capable model.
  BROWSER_MODEL?: string
  // Optional last-resort browser planner. With OPENAI_API_KEY it defaults to
  // Sable (claude-sonnet-5-5); without a key it uses the free Sable lane.
  // Fast Qwen-class lanes run first. Set "off" to disable the last resort.
  BROWSER_ASSISTANT_MODEL?: string
  // The Freebuff API key. Locally from `.env`; on Sites from Sites → Secrets.
  // It is read here and nowhere else, and never leaves the Worker.
  OPENAI_API_KEY?: string
  // Optional override of the API origin; defaults to the Freebuff API.
  OPENAI_BASE_URL?: string
  // Optional loopback bridge that runs @codebuff/sdk for the Buffy chat page
  // and the Buffy Agent model row. Defaults to
  // http://127.0.0.1:8766 on a loopback development origin.
  BUFFY_BRIDGE_URL?: string
  // Set to 1 only on the developer machine; a deployed Worker cannot reach
  // the local bridge, so production must not advertise its rows.
  BUFFY_BRIDGE_LOCAL?: string
  // Optional shared secret sent to the bridge as a bearer token.
  BUFFY_BRIDGE_TOKEN?: string
  // Optional Vercel Sandbox. With both VERCEL_TOKEN and VERCEL_PROJECT_ID set,
  // the coding agent runs its build/test command in a disposable microVM and
  // reads the output (the free Hobby allowance). Without them nothing runs.
  // VERCEL_TEAM_ID or VERCEL_TEAM_SLUG scopes a team account; SANDBOX_RUNTIME
  // overrides the runtime image (default node24).
  VERCEL_TOKEN?: string
  VERCEL_PROJECT_ID?: string
  VERCEL_TEAM_ID?: string
  VERCEL_TEAM_SLUG?: string
  SANDBOX_RUNTIME?: string
  // Optional Sapling API key for detector-guided rewrite selection. Kept on the
  // server; the browser never sees it.
  SAPLING_API_KEY?: string
  // Optional free Pollinations key (enter.pollinations.ai). With it the free
  // hosted lane serves Kimi K3; without it, the keyless lane serves GPT-OSS 20B.
  POLLINATIONS_API_KEY?: string
  // Optional override of the free lane's model id.
  PUBLIC_AI_MODEL?: string
  // Optional free AIHubMix key (aihubmix.com). Adds its zero-cost Kimi K3
  // coding route, limited to 100 requests/day and 5/minute per account.
  AIHUBMIX_API_KEY?: string
  // Optional free Groq key (console.groq.com). GROQ_MODEL adds a preferred
  // model before the free defaults; the person chatting still needs no key.
  GROQ_API_KEY?: string
  GROQ_MODEL?: string
  // Optional OpenRouter key (openrouter.ai). Adds free variants as hosted
  // lanes; override the list with comma-separated OPENROUTER_MODELS.
  OPENROUTER_API_KEY?: string
  OPENROUTER_MODELS?: string
  // Optional Mistral key (console.mistral.ai). MISTRAL_MODEL adds a preferred
  // model before the free defaults.
  MISTRAL_API_KEY?: string
  MISTRAL_MODEL?: string
  // Optional free NVIDIA NIM key (build.nvidia.com). Defaults to Step 5
  // Preview, DeepSeek V4.1 Flash, GLM-5.3 Flash, MiniMax M3.1 Flash,
  // Nemotron 3.5 Super VL and Nemotron 3 Ultra, free to prototype with.
  NVIDIA_API_KEY?: string
  NVIDIA_MODEL?: string
  // Optional DeepSeek API key (platform.deepseek.com). `deepseek-flash` is
  // served by DeepSeek V4.1 Flash; DEEPSEEK_MODEL can pin another checkpoint.
  DEEPSEEK_API_KEY?: string
  DEEPSEEK_MODEL?: string
  // Optional free LLM7 token (dash.llm7.io). Free tokens reach LLM7's "turbo"
  // models only (GPT-OSS 20B, Codestral, Mistral Nemo); the pro ids need a paid
  // plan. Without a token, the anonymous turbo lanes are still available.
  LLM7_API_KEY?: string
  // Optional free ModelScope token (modelscope.cn). Adds its hosted DeepSeek.
  MODELSCOPE_API_KEY?: string
  MODELSCOPE_MODEL?: string
  // Optional Alibaba Cloud Model Studio key (Singapore, no card). Adds Qwen 3.8
  // Max, DeepSeek V4 Pro and GLM 5.3. New accounts get 1M free tokens per model
  // for 90 days; enable "Free Quota Only" so an exhausted quota cannot bill.
  // DASHSCOPE_MODELS overrides the comma-separated list.
  DASHSCOPE_API_KEY?: string
  DASHSCOPE_MODELS?: string
  // Optional Cohere trial key (cohere.com). Adds Command A+ through Cohere's
  // OpenAI-compatible endpoint; trial keys have limited credits, not unlimited
  // free usage. COHERE_MODEL overrides the model.
  COHERE_API_KEY?: string
  COHERE_MODEL?: string
  // Optional free Z.ai key (z.ai). Adds GLM-4.5 Flash; ZAI_MODEL overrides the
  // model. Newer GLM models need paid credits on the same key.
  ZAI_API_KEY?: string
  ZAI_MODEL?: string
  // Optional free Google AI Studio key (aistudio.google.com/apikey). Adds a
  // Gemini lane; the person chatting still needs no key.
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  // Optional Ollama Cloud key (ollama.com/settings/keys), free starter credits,
  // no card. Adds its hosted open models, including DeepSeek V4 Pro and Kimi K3.
  OLLAMA_API_KEY?: string
  OLLAMA_MODEL?: string
  // Optional local Ollama endpoint, e.g.
  // http://127.0.0.1:11434/v1/chat/completions. This only works while Ink
  // runs on the same computer as Ollama; a deployed Worker cannot reach it.
  OLLAMA_LOCAL_URL?: string
  // Comma-separated local model ids. Defaults to qwen2.5-coder:3b and
  // qwen2.5-coder:7b when OLLAMA_LOCAL_URL is set.
  OLLAMA_LOCAL_MODELS?: string
  // Optional SambaNova Cloud key (cloud.sambanova.ai), free tier with a tight
  // daily request cap. Adds DeepSeek V3.2, GLM and GPT-OSS models.
  SAMBANOVA_API_KEY?: string
  SAMBANOVA_MODEL?: string
  // Optional Cloudflare Workers AI credentials (dash.cloudflare.com). Adds
  // free-plan lanes and uses the daily neuron allowance; CLOUDFLARE_AI_MODEL
  // adds a preferred model before the defaults. The chat user needs no key.
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_AI_TOKEN?: string
  CLOUDFLARE_AI_MODEL?: string
  // Enables the free-only Research mode. Off by default; Codespaces enables it
  // automatically for the development origin.
  RESEARCH_ENABLED?: string
  // Enables the free-only Analyze mode. Off by default; Codespaces enables it
  // automatically for the development origin.
  ANALYZE_ENABLED?: string
  // Enables the free-only Build mode. Off by default; Codespaces enables it
  // automatically for the development origin.
  BUILD_ENABLED?: string
  // Optional Exa key (exa.ai). Upgrades grounding quality; without it the app
  // uses keyless Wikipedia, DuckDuckGo, news, Stack Overflow and Hacker News.
  EXA_API_KEY?: string
  // Optional override of the Exa endpoint, used by local tests.
  EXA_API_URL?: string
  // Optional owner-run search endpoint. When set it replaces the built-in
  // sources: GET <base>?q=<query> must return { results: [{ title, url, snippet }] }.
  // Used by local tests with a mock, and by anyone who would rather point the
  // app at their own SearxNG-style service.
  SEARCH_BASE_URL?: string
  // Optional bearer token sent to SEARCH_BASE_URL.
  SEARCH_API_KEY?: string
  // Optional: the signed-in Freebuff user id that gets owner-only perks.
  // Locally, the loopback development identity already counts as the owner.
  // Pin a deployed copy to one account by setting this to that account's sub.
  OWNER_SUB?: string
  // Injected on deploy once Sign in with Freebuff is enabled (sites_enable_auth).
  FREEBUFF_CLIENT_ID?: string
  FREEBUFF_ISSUER?: string
  APP_ORIGIN?: string
  // Optional Browserbase key for the hosted cloud-browser workspace. The
  // Worker creates and controls a remote Chrome session; no browser extension
  // is installed and nothing runs on the visitor's computer.
  BROWSERBASE_API_KEY?: string
  // Optional Browserless token. Its CDP endpoint takes the token in the query
  // string, and the free account is the largest of the three: about eight hours
  // of browser time a month.
  BROWSERLESS_API_KEY?: string
  // Optional Hyperbrowser key. When present it is preferred over Browserbase;
  // its free account includes 5,000 credits, about 50 browser hours.
  HYPERBROWSER_API_KEY?: string
  // Optional Steel.dev key. Its Launch plan includes $30 of one-time usage
  // credits (about 300 browser hours), 10 concurrent sessions and 15-minute
  // sessions. Used as a third provider when set.
  STEEL_API_KEY?: string
  // Injected by Freebuff Sites when the deploy manifest enables realtime.
  // Local testing points this at freebuff-realtime/wrangler.jsonc.
  REALTIME?: DurableObjectNamespace
}

export type Variables = {
  user: FreebuffUser
  db: D1Database
}

export type AppContext = { Bindings: Env; Variables: Variables }
