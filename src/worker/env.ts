import type { FreebuffUser } from '@freebuff/auth'

export interface Env {
  ASSETS: Fetcher
  // Attached by Freebuff Sites once provisioned (sites_add_storage). Optional so
  // the app can explain what is missing instead of crashing.
  DB?: D1Database
  // The Freebuff API key. Locally from `.env`; on Sites from Sites → Secrets.
  // It is read here and nowhere else, and never leaves the Worker.
  OPENAI_API_KEY?: string
  // Optional override of the API origin; defaults to the Freebuff API.
  OPENAI_BASE_URL?: string
  // Optional free Pollinations key (enter.pollinations.ai). With it the free
  // hosted lane serves Kimi K3; without it, the keyless lane serves GPT-OSS 20B.
  POLLINATIONS_API_KEY?: string
  // Optional override of the free lane's model id.
  PUBLIC_AI_MODEL?: string
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
  // Optional free NVIDIA NIM key (build.nvidia.com). Defaults to DeepSeek V4.1
  // Flash plus GLM-5.3 Flash and Nemotron 3 Ultra, free to prototype with.
  NVIDIA_API_KEY?: string
  NVIDIA_MODEL?: string
  // Optional free LLM7 token (dash.llm7.io). Free tokens reach LLM7's "turbo"
  // models only (GPT-OSS 20B, Codestral, Mistral Nemo); the pro ids need a paid
  // plan. Without a token, the anonymous turbo lanes are still available.
  LLM7_API_KEY?: string
  // Optional free ModelScope token (modelscope.cn). Adds its hosted DeepSeek.
  MODELSCOPE_API_KEY?: string
  MODELSCOPE_MODEL?: string
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
  // http://127.0.0.1:11434/v1/chat/completions. This only works while Quill
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
  // Enables the free-only Research mode. Off by default while it is evaluated.
  RESEARCH_ENABLED?: string
  // Enables the free-only Analyze mode. Off by default while it is evaluated.
  ANALYZE_ENABLED?: string
  // Enables the free-only Build mode. Off by default while it is evaluated.
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
}

export type Variables = {
  user: FreebuffUser
  db: D1Database
}

export type AppContext = { Bindings: Env; Variables: Variables }
