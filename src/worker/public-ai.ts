// The free hosted lanes: real models answer with no key from you and none
// from the person chatting. Each lane is an OpenAI-compatible endpoint; they
// are tried in order, so a rate limit or outage on one falls through to the
// next instead of failing the message.
//
// Keyed lanes cover OpenRouter's rotating free variants, NVIDIA NIM, LLM7,
// ModelScope, Cohere trial credits, Groq, Mistral, Google AI Studio, Workers AI
// and Z.ai. Pollinations and BlockRun add keyless lanes, and LLM7's anonymous
// gateway is the last-resort free option. Keys stay on the server.

import { MAX_OUTPUT_TOKENS } from '../shared/config'
import { AiError, readSse, textFromContent, type ChatMessage, type StreamPiece } from './ai'
import type { Env } from './env'

const POLLINATIONS_KEYED_URL = 'https://gen.pollinations.ai/v1/chat/completions'
const POLLINATIONS_KEYLESS_URL = 'https://text.pollinations.ai/openai'
const LLM7_URL = 'https://api.llm7.io/v1/chat/completions'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const MODELSCOPE_URL = 'https://api-inference.modelscope.cn/v1/chat/completions'
const COHERE_URL = 'https://api.cohere.ai/compatibility/v1/chat/completions'
const ZAI_URL = 'https://api.z.ai/api/paas/v4/chat/completions'
const BLOCKRUN_URL = 'https://blockrun.ai/api/v1/chat/completions'
const OLLAMA_URL = 'https://ollama.com/v1/chat/completions'
const SAMBANOVA_URL = 'https://api.sambanova.ai/v1/chat/completions'

// Verified free variants, checked against the live catalogs. Free model IDs
// rotate, so a 404/429 lane cools down and the next one takes over.
const OPENROUTER_FREE_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'xingchen-agi/xing4.0-29b-a4b:free',
  'recursive/flint-v1.0:free',
  'openrouter/free',
]
// LLM7's free token only reaches its "turbo" models. The pro ids that were
// here before (deepseek-v4.1-flash, kimi-k3, glm-5.3) return 401/400 on a free
// token, which is why the strongest LLM7 lanes looked dead in production.
const LLM7_MODELS = ['gpt-oss:20b', 'codestral-latest', 'mistral-Nemo-Instruct-2407']
const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']
const MISTRAL_MODELS = ['mistral-large-4', 'codestral-latest', 'ministral-14b-latest']
const NVIDIA_MODELS = [
  'deepseek-ai/deepseek-v4.1-flash',
  'z-ai/glm-5.3-flash',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'openai/gpt-oss-20b',
  'google/gemma-4-31b-it',
]
// Ollama Cloud's free plan is a monthly starter-credit allowance, so these are
// not guaranteed forever; they are tried only when the owner adds a key.
const OLLAMA_MODELS = ['deepseek-v4-pro:0813', 'kimi-k3', 'glm-5.3', 'minimax-m3', 'deepseek-v4-flash:0731']
// Local Ollama runs on the same machine as the dev server; these are the
// default coding models when OLLAMA_LOCAL_URL is set.
const OLLAMA_LOCAL_MODELS = ['qwen2.5-coder:3b', 'qwen2.5-coder:7b']
const SAMBANOVA_MODELS = ['DeepSeek-V3.2', 'DeepSeek-V3.1', 'gpt-oss-120b', 'MiniMax-M2.7']
const CLOUDFLARE_MODELS = [
  '@cf/zai-org/glm-5.3',
  '@cf/zai-org/glm-5.3-flash',
  '@cf/deepseek-ai/deepseek-v4-flash-0731',
  '@cf/openai/gpt-oss-120b',
  '@cf/qwen/qwen3.8-27b',
  '@cf/nvidia/nemotron-3-120b-a12b',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
]
const BLOCKRUN_MODELS = ['nvidia/nemotron-3-super-120b', 'nvidia/nemotron-3.5-bolt']

export type PublicLane = {
  url: string
  model: string
  label: string
  description: string
  /** True when the provider accepts OpenAI-style image_url content parts. */
  vision?: boolean
  /** Sent as a bearer token; LLM7 documents the literal "unused" for anonymous use. */
  key?: string
}

type LaneInput = {
  messages: ChatMessage[]
  signal?: AbortSignal
  reasoning?: boolean
  /** Supported OpenRouter lanes accept low, medium or high reasoning effort. */
  reasoningEffort?: 'low' | 'medium' | 'high'
  /** Drafts use different temperatures so they fail in different ways. */
  temperature?: number
  /** A review or a plan does not need the full answer budget. */
  maxTokens?: number
  /** Reports the outcome so the Worker can persist provider health. */
  onLaneResult?: (result: LaneResult) => void
}

/** One lane's outcome, for the persisted provider-health table. */
export type LaneResult =
  | { lane: PublicLane; ok: true; latencyMs: number }
  | { lane: PublicLane; ok: false; code: string; message: string; latencyMs: number }

function failureResult(lane: PublicLane, error: unknown, startedAt: number): LaneResult {
  const failure = error instanceof AiError ? error : new AiError('unavailable', 'The model is unavailable right now.', 503)
  return { lane, ok: false, code: failure.code, message: failure.message, latencyMs: Date.now() - startedAt }
}

// A lane that just hit a rate limit or a bad key is not worth retrying on every
// message. It rests here, in this isolate, while the next lane answers. Keys are
// host + model so two models on one provider cool independently.
const COOLDOWN_RATE = 10 * 60_000
const COOLDOWN_AUTH = 30 * 60_000
const COOLDOWN_MODEL = 30 * 60_000
const COOLDOWN_ERROR = 2 * 60_000
const cooldowns = new Map<string, number>()

export const laneKey = (lane: PublicLane) => `${new URL(lane.url).host}|${lane.model}`
const isCooling = (lane: PublicLane) => (cooldowns.get(laneKey(lane)) ?? 0) > Date.now()
const cool = (lane: PublicLane, ms: number) => {
  cooldowns.set(laneKey(lane), Date.now() + ms)
}

/** Lanes worth trying now; if every lane is resting, allow one more attempt. */
export function activeLanes(lanes: PublicLane[]): PublicLane[] {
  const active = lanes.filter((lane) => !isCooling(lane))
  return active.length ? active : lanes
}

/** OpenAI-compatible body; OpenRouter and Z.ai take explicit reasoning switches. */
function requestBody(lane: PublicLane, input: LaneInput, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: lane.model,
    messages: input.messages,
    max_tokens: input.maxTokens ?? MAX_OUTPUT_TOKENS,
    stream,
  }
  if (input.temperature !== undefined) body.temperature = input.temperature
  const host = new URL(lane.url).host
  if (input.reasoning && host === 'openrouter.ai') body.reasoning = { effort: input.reasoningEffort ?? 'high' }
  if (host === 'api.z.ai' || host === 'open.bigmodel.cn') {
    body.thinking = { type: input.reasoning ? 'enabled' : 'disabled' }
  }
  return body
}

/** A readable name for a model id, so the picker does not show a slug. */
function labelFor(id: string): string {
  const lower = id.toLowerCase()
  if (lower.includes('deepseek-v4.1')) return 'DeepSeek V4.1 Flash'
  if (lower.includes('deepseek-v3.2')) return 'DeepSeek V3.2'
  if (lower.includes('deepseek-v3.1')) return 'DeepSeek V3.1'
  if (lower.includes('deepseek-v4-pro')) return 'DeepSeek V4 Pro'
  if (lower.includes('deepseek-v4-flash')) return 'DeepSeek V4 Flash'
  if (lower.includes('deepseek-v4')) return 'DeepSeek V4'
  if (lower.includes('deepseek')) return 'DeepSeek'
  if (lower.includes('kimi-k3')) return 'Kimi K3'
  if (lower.includes('kimi')) return 'Kimi'
  if (lower.includes('glm')) {
    const version = lower.match(/glm-(\d+(?:\.\d+)?)/)?.[1]
    const name = version ? `GLM-${version}` : 'GLM'
    return lower.includes('flash') ? `${name} Flash` : name
  }
  if (lower.includes('gpt-6')) return 'GPT-6'
  if (lower.includes('openrouter/free')) return 'OpenRouter Free Router'
  if (lower.includes('claude')) return 'Claude'
  if (lower.includes('gemini-4')) return 'Gemini 4'
  if (lower.includes('gemini-3.8')) return 'Gemini 3.8 Flash'
  if (lower.includes('gemini-3.6')) return 'Gemini 3.6 Flash'
  if (lower.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro'
  if (lower.includes('gemini')) return lower.includes('pro') ? 'Gemini Pro' : 'Gemini Flash'
  if (lower.includes('gemma-4-31b')) return 'Gemma 4 31B'
  if (lower.includes('gemma-4-26b')) return 'Gemma 4 26B'
  if (lower.includes('gemma')) return 'Gemma 4'
  if (lower.includes('llama-4-scout')) return 'Llama 4 Scout'
  if (lower.includes('llama-4')) return 'Llama 4'
  if (lower.includes('llama')) return 'Llama'
  if (lower.includes('qwen2.5-coder')) {
    const size = lower.match(/qwen2\.5-coder:(\d+(?:\.\d+)?b)/)?.[1]
    return size ? `Qwen2.5 Coder ${size.toUpperCase()}` : 'Qwen2.5 Coder'
  }
  if (lower.includes('qwen3.8')) return 'Qwen 3.8 27B'
  if (lower.includes('qwen3')) return 'Qwen 3'
  if (lower.includes('qwen')) return 'Qwen'
  if (lower.includes('ministral')) return 'Ministral 14B'
  if (lower.includes('mistral-nemo')) return 'Mistral Nemo'
  if (lower.includes('codestral')) return 'Codestral'
  if (lower.includes('mistral-large-4')) return 'Mistral Large 4'
  if (lower.includes('mistral')) return lower.includes('large') ? 'Mistral Large' : lower.includes('small') ? 'Mistral Small 3.1' : 'Mistral'
  if (lower.includes('command-a-plus')) return 'Command A+'
  if (lower.includes('command-a')) return 'Command A'
  if (lower.includes('command-r')) return 'Command R'
  if (lower.includes('nemotron-3-120b')) return 'Nemotron 3 120B'
  if (lower.includes('lightning')) return 'Nemotron 3.5 Lightning'
  if (lower.includes('nano-omni')) return 'Nemotron 3 Nano Omni'
  if (lower.includes('bolt')) return 'Nemotron 3.5 Bolt'
  if (lower.includes('nemotron-3.5-super')) return 'Nemotron 3.5 Super'
  if (lower.includes('nemotron-3-super')) return 'Nemotron 3 Super 120B'
  if (lower.includes('ultra')) return 'Nemotron 3 Ultra 550B'
  if (lower.includes('nemotron')) return 'Nemotron 3 Nano 30B'
  if (lower.includes('muse-glimmer')) return 'Muse Glimmer 30B'
  if (lower.includes('minimax-m3.1')) return 'MiniMax M3.1 Flash'
  if (lower.includes('minimax-m3')) return 'MiniMax M3'
  if (lower.includes('minimax-m2.7')) return 'MiniMax M2.7'
  if (lower.includes('minimax')) return 'MiniMax'
  if (lower.includes('laguna')) return 'Laguna XS 2.1'
  if (lower.includes('xing4')) return 'Xing4.0 29B'
  if (lower.includes('flint')) return 'Flint'
  if (lower.includes('120b')) return 'GPT-OSS 120B'
  if (lower.includes('gpt-oss')) return 'GPT-OSS 20B'
  if (lower.includes('north')) return 'North Mini Code'
  return id
}

/**
 * A rough capability prior, used for orchestration only. It is not a benchmark:
 * it keeps a strong model in the referee chair and stops a small fallback model
 * from grading drafts just because it happened to be next in the list.
 *
 * Optional providers that have been observed returning auth errors are nudged
 * down; the persisted health check also removes them from the referee chair.
 */
export function laneStrength(model: string, url?: string): number {
  const id = model.toLowerCase()
  let host = ''
  try {
    host = url ? new URL(url).host : ''
  } catch {
    host = ''
  }
  const optionalCloudflare = host === 'api.cloudflare.com'
  let base = 60
  if (/gpt-6|claude-opus|claude-sonnet-5|gemini-4|deepseek-v4-pro|kimi-k3|glm-5\.3(?!-flash)/.test(id)) base = 92
  // BlockRun's keyless Nemotron 3 Super 120B is a known-working lane and is
  // deliberately ranked above the rate-limited free router variants. A 120B
  // model that answers beats a 550B model that returns 429.
  else if (/nemotron-3-super/.test(id)) base = 86
  else if (/nemotron-3-ultra|deepseek-v4\.1|glm-5\.3-flash|gemini-3\.8|mistral-large-4|command-a-plus|nemotron-3\.5-super/.test(id)) base = 84
  else if (/deepseek-v4-flash|qwen3\.8|gpt-oss-120b|minimax-m3|mistral-large-3|north-mini-code|kimi-k2/.test(id)) base = 76
  else if (/openrouter\/free|lightning|nemotron-3-120b|gemini-3\.6|gemma-4|flint|qwen3|bolt|muse-glimmer/.test(id)) base = 66
  else if (/qwen2\.5-coder:7b/.test(id)) base = 54
  else if (/qwen2\.5-coder:3b/.test(id)) base = 46
  else if (/codestral|glm-4\.5|llama-4|mistral-small|small|bolt/.test(id)) base = 58
  else if (/gpt-oss|gemma|nano|nemo|ministral|laguna|xing|llama/.test(id)) base = 52
  // A Workers AI token can be valid for other Cloudflare APIs but not for
  // Workers AI (the live probe here returns 403). Keep the lanes available for
  // deployments where it works, but do not let an unverified optional provider
  // outrank a working keyless lane by default.
  return optionalCloudflare ? Math.max(50, base - 8) : base
}

const workersAiUrl = (account: string) => `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`

/** Only lanes whose model and API actually accept image input get this flag. */
export function laneSupportsVision(lane: Pick<PublicLane, 'url' | 'model'>): boolean {
  const model = lane.model.toLowerCase()
  let host = ''
  try {
    host = new URL(lane.url).host
  } catch {
    return false
  }
  if (host === 'openrouter.ai') {
    return /nemotron-3\.5-super-vl|nemotron-3-nano-omni|gemma-4-31b|openrouter\/free/.test(model)
  }
  if (host === 'generativelanguage.googleapis.com') return true
  if (host === 'integrate.api.nvidia.com') return /gemma-4-31b/.test(model)
  if (host === 'api.cloudflare.com') return /gemma-4-26b|llama-4-scout/.test(model)
  return false
}

/** Accepts an origin, /v1, or a full chat-completions endpoint. */
function ollamaLocalEndpoint(raw: string): string | null {
  const url = raw.trim().replace(/\/+$/, '')
  if (!url) return null
  try {
    new URL(url)
  } catch {
    return null
  }
  if (url.endsWith('/chat/completions')) return url
  return `${url}${url.endsWith('/v1') ? '' : '/v1'}/chat/completions`
}

/** A preferred model from env comes first; the curated defaults stay as fallbacks. */
function withOverride(model: string | undefined, defaults: string[]): string[] {
  const preferred = model?.trim()
  return [...new Set([...(preferred ? [preferred] : []), ...defaults])]
}

/** Ordered free lanes: keyed strong models first, then the anonymous fallbacks. */
export function publicLanes(env: Env): PublicLane[] {
  const lanes: PublicLane[] = []
  const llm7Key = env.LLM7_API_KEY?.trim() || 'unused'

  if (env.POLLINATIONS_API_KEY) {
    const model = env.PUBLIC_AI_MODEL?.trim() || 'moonshotai/kimi-k3'
    lanes.push({
      url: POLLINATIONS_KEYED_URL,
      model,
      label: labelFor(model),
      description: 'Free with your Pollinations key',
      key: env.POLLINATIONS_API_KEY,
    })
  }

  if (env.OPENROUTER_API_KEY) {
    const models = env.OPENROUTER_MODELS?.split(',')
      .map((model) => model.trim())
      .filter(Boolean) ?? OPENROUTER_FREE_MODELS
    for (const model of models) {
      lanes.push({
        url: OPENROUTER_URL,
        model,
        label: labelFor(model),
        description: 'Free with an OpenRouter key',
        key: env.OPENROUTER_API_KEY,
      })
    }
  }

  if (env.NVIDIA_API_KEY) {
    for (const model of withOverride(env.NVIDIA_MODEL, NVIDIA_MODELS)) {
      lanes.push({
        url: NVIDIA_URL,
        model,
        label: `${labelFor(model)} (NVIDIA)`,
        description: 'Free with NVIDIA NIM',
        key: env.NVIDIA_API_KEY,
      })
    }
  }

  if (env.LLM7_API_KEY) {
    for (const model of LLM7_MODELS) {
      lanes.push({
        url: LLM7_URL,
        model,
        label: labelFor(model),
        description: 'Free with your LLM7 token',
        key: llm7Key,
      })
    }
  }

  if (env.MODELSCOPE_API_KEY) {
    const model = env.MODELSCOPE_MODEL?.trim() || 'deepseek-ai/DeepSeek-V4.1-Flash'
    lanes.push({
      url: MODELSCOPE_URL,
      model,
      label: labelFor(model),
      description: 'Free quota via ModelScope',
      key: env.MODELSCOPE_API_KEY,
    })
  }

  if (env.COHERE_API_KEY) {
    const model = env.COHERE_MODEL?.trim() || 'command-a-plus-05-2026'
    lanes.push({
      url: COHERE_URL,
      model,
      label: `${labelFor(model)} (Cohere)`,
      description: 'Trial credits via Cohere',
      key: env.COHERE_API_KEY,
    })
  }

  if (env.GROQ_API_KEY) {
    for (const model of withOverride(env.GROQ_MODEL, GROQ_MODELS)) {
      lanes.push({
        url: GROQ_URL,
        model,
        label: `${labelFor(model)} (Groq)`,
        description: 'Free with a Groq key',
        key: env.GROQ_API_KEY,
      })
    }
  }

  if (env.MISTRAL_API_KEY) {
    for (const model of withOverride(env.MISTRAL_MODEL, MISTRAL_MODELS)) {
      lanes.push({
        url: MISTRAL_URL,
        model,
        label: labelFor(model),
        description: 'Free with a Mistral key',
        key: env.MISTRAL_API_KEY,
      })
    }
  }

  if (env.GEMINI_API_KEY) {
    const model = env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash'
    lanes.push({
      url: GEMINI_URL,
      model,
      label: labelFor(model),
      description: 'Free tier via Google AI Studio',
      key: env.GEMINI_API_KEY,
    })
  }

  if (env.OLLAMA_API_KEY) {
    for (const model of withOverride(env.OLLAMA_MODEL, OLLAMA_MODELS)) {
      lanes.push({
        url: OLLAMA_URL,
        model,
        label: `${labelFor(model)} (Ollama)`,
        description: 'Starter credits via Ollama Cloud',
        key: env.OLLAMA_API_KEY,
      })
    }
  }

  if (env.OLLAMA_LOCAL_URL) {
    const url = ollamaLocalEndpoint(env.OLLAMA_LOCAL_URL)
    if (url) {
      const models = env.OLLAMA_LOCAL_MODELS?.split(',')
        .map((model) => model.trim())
        .filter(Boolean) ?? OLLAMA_LOCAL_MODELS
      for (const model of models) {
        lanes.push({
          url,
          model,
          label: `${labelFor(model)} (Local Ollama)`,
          description: 'Runs on this computer via Ollama',
        })
      }
    }
  }

  if (env.SAMBANOVA_API_KEY) {
    for (const model of withOverride(env.SAMBANOVA_MODEL, SAMBANOVA_MODELS)) {
      lanes.push({
        url: SAMBANOVA_URL,
        model,
        label: `${labelFor(model)} (SambaNova)`,
        description: 'Free tier via SambaNova',
        key: env.SAMBANOVA_API_KEY,
      })
    }
  }

  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN) {
    for (const model of withOverride(env.CLOUDFLARE_AI_MODEL, CLOUDFLARE_MODELS)) {
      lanes.push({
        url: workersAiUrl(env.CLOUDFLARE_ACCOUNT_ID),
        model,
        label: `${labelFor(model)} (Workers AI)`,
        description: 'Free daily Workers AI allowance',
        key: env.CLOUDFLARE_AI_TOKEN,
      })
    }
  }

  if (env.ZAI_API_KEY) {
    const model = env.ZAI_MODEL?.trim() || 'glm-4.5-flash'
    lanes.push({
      url: ZAI_URL,
      model,
      label: labelFor(model),
      description: 'Free with your Z.ai key',
      key: env.ZAI_API_KEY,
    })
  }

  for (const model of BLOCKRUN_MODELS) {
    lanes.push({
      url: BLOCKRUN_URL,
      model,
      label: `${labelFor(model)} (BlockRun)`,
      description: 'Free, no key, via BlockRun',
    })
  }

  // The anonymous lanes are deliberately keyless: a broken paid/free token
  // must not take the no-key fallback down with it.
  for (const lane of anonymousLanes()) {
    if (!lanes.some((known) => known.model === lane.model)) lanes.push(lane)
  }
  // Capability is derived from the final lane, including env overrides, so an
  // image turn cannot accidentally fall through to a text-only model.
  const withVision = lanes.map((lane) => ({ ...lane, vision: laneSupportsVision(lane) }))
  // Strongest first, so a quick reply and the team's referee both start from
  // the best lane the deployment can actually reach.
  return withVision.sort((a, b) => laneStrength(b.model, b.url) - laneStrength(a.model, a.url))
}

/** The no-account lanes, tried last. A free LLM7 token also upgrades them. */
function anonymousLanes(): PublicLane[] {
  return [
    {
      url: LLM7_URL,
      model: 'gpt-oss:20b',
      label: 'GPT-OSS 20B (LLM7)',
      description: 'Free, no key',
      key: 'unused',
    },
    {
      url: LLM7_URL,
      model: 'codestral-latest',
      label: 'Codestral (LLM7)',
      description: 'Free, no key',
      key: 'unused',
    },
    {
      url: LLM7_URL,
      model: 'mistral-Nemo-Instruct-2407',
      label: 'Mistral Nemo (LLM7)',
      description: 'Free, no key',
      key: 'unused',
    },
    {
      url: POLLINATIONS_KEYLESS_URL,
      model: 'openai-fast',
      label: 'GPT-OSS 20B (Pollinations)',
      description: 'Free, no key, one message every 30 seconds',
    },
  ]
}

/** Puts the model someone picked first, keeping the rest as fallbacks. */
export function orderLanes(lanes: PublicLane[], model?: string): PublicLane[] {
  const first = lanes.find((lane) => lane.model === model)
  return first ? [first, ...lanes.filter((lane) => lane !== first)] : lanes
}

/** One failure, cooled down and turned into a sentence the app can show. */
async function laneFailure(lane: PublicLane, response: Response): Promise<AiError> {
  const status = response.status
  if (status === 429) {
    // Free gateways often say exactly how long to wait; honor a short retry
    // instead of resting the lane for the full ten minutes.
    let retryAfter = Number(response.headers.get('retry-after') ?? 0) * 1_000
    if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
      const body = (await response.clone().json().catch(() => null)) as { error?: { retry_after?: number } } | null
      retryAfter = Number(body?.error?.retry_after ?? 0) * 1_000
    }
    cool(lane, Math.min(Math.max(retryAfter || COOLDOWN_RATE, 15_000), COOLDOWN_RATE))
    return new AiError('busy', `${lane.label} is busy right now.`, 429)
  }
  if (status === 401 || status === 403) {
    cool(lane, COOLDOWN_AUTH)
    return new AiError('invalid_key', `${lane.label} refused its key. Check the configured key.`, 503)
  }
  if (status === 404) {
    cool(lane, COOLDOWN_MODEL)
    return new AiError('unavailable', `${lane.label} is unavailable right now.`, 503)
  }
  cool(lane, COOLDOWN_ERROR)
  return new AiError('unavailable', `${lane.label} is unavailable right now.`, 503)
}

/** One lane, with its failures turned into sentences the app can show. */
async function* streamLane(lane: PublicLane, input: LaneInput): AsyncGenerator<StreamPiece> {
  if (isCooling(lane)) throw new AiError('busy', `${lane.label} is taking a short break.`, 429)
  const startedAt = Date.now()
  const timeout = AbortSignal.timeout(240_000)
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(lane.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(lane.key ? { authorization: `Bearer ${lane.key}` } : {}),
      },
      body: JSON.stringify(requestBody(lane, input, true)),
      signal,
    })
  } catch {
    if (input.signal?.aborted) return
    cool(lane, COOLDOWN_ERROR)
    const failure = timeout.aborted ? new AiError('timeout', 'The free model took too long to answer.', 504) : new AiError('network', `Could not reach ${lane.label}.`, 503)
    input.onLaneResult?.(failureResult(lane, failure, startedAt))
    throw failure
  }
  if (!response.ok) {
    const failure = await laneFailure(lane, response)
    input.onLaneResult?.(failureResult(lane, failure, startedAt))
    throw failure
  }

  let text = ''
  try {
    for await (const piece of readSse(response, { client: input.signal, timeout })) {
      if (piece.type === 'text') text += piece.text
      yield piece
    }
  } catch (error) {
    if (!input.signal?.aborted) {
      cool(lane, COOLDOWN_ERROR)
      input.onLaneResult?.(failureResult(lane, error, startedAt))
    }
    throw error
  }
  if (!text.trim()) {
    cool(lane, COOLDOWN_ERROR)
    const failure = new AiError('empty', `${lane.label} returned an empty reply.`, 502)
    input.onLaneResult?.(failureResult(lane, failure, startedAt))
    throw failure
  }
  input.onLaneResult?.({ lane, ok: true, latencyMs: Date.now() - startedAt })
}

/** One complete answer from a lane, used as a draft, a plan or a review. */
export async function laneText(lane: PublicLane, input: LaneInput): Promise<string> {
  if (isCooling(lane)) throw new AiError('busy', `${lane.label} is taking a short break.`, 429)
  const startedAt = Date.now()
  const timeout = AbortSignal.timeout(90_000)
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(lane.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(lane.key ? { authorization: `Bearer ${lane.key}` } : {}),
      },
      body: JSON.stringify(requestBody(lane, input, false)),
      signal,
    })
  } catch {
    if (input.signal?.aborted) throw new AiError('aborted', 'The reply was stopped.', 499)
    cool(lane, COOLDOWN_ERROR)
    const failure = timeout.aborted ? new AiError('timeout', `${lane.label} took too long to answer.`, 504) : new AiError('network', `Could not reach ${lane.label}.`, 503)
    input.onLaneResult?.(failureResult(lane, failure, startedAt))
    throw failure
  }
  if (!response.ok) {
    const failure = await laneFailure(lane, response)
    input.onLaneResult?.(failureResult(lane, failure, startedAt))
    throw failure
  }
  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null; reasoning?: string | null; reasoning_content?: string | null } }[]
  } | null
  const message = body?.choices?.[0]?.message
  // A reasoning model can spend its whole budget thinking; keep that instead of
  // throwing the draft away when the visible content is empty.
  const text =
    textFromContent(message?.content) ||
    (typeof message?.reasoning === 'string' ? message.reasoning : '') ||
    (typeof message?.reasoning_content === 'string' ? message.reasoning_content : '')
  if (!text.trim()) {
    cool(lane, COOLDOWN_ERROR)
    const failure = new AiError('empty', `${lane.label} returned an empty reply.`, 502)
    input.onLaneResult?.(failureResult(lane, failure, startedAt))
    throw failure
  }
  input.onLaneResult?.({ lane, ok: true, latencyMs: Date.now() - startedAt })
  return text
}

/**
 * Streams from the first lane that answers. A lane that fails before producing
 * text is skipped; once text is flowing, a failure is reported, because
 * splicing in a second model's answer would be worse than an error.
 */
export async function* publicComplete(lanes: PublicLane[], input: LaneInput): AsyncGenerator<StreamPiece> {
  let lastError: unknown
  for (const lane of activeLanes(lanes)) {
    if (input.signal?.aborted) return
    let yieldedText = false
    try {
      for await (const piece of streamLane(lane, input)) {
        if (piece.type === 'text') yieldedText = true
        yield piece
      }
      if (yieldedText) return
    } catch (error) {
      if (yieldedText) throw error
      if (input.signal?.aborted) return
      lastError = error
    }
  }
  if (lastError instanceof AiError && lastError.code === 'invalid_key') throw lastError
  throw new AiError('busy', 'The free models are busy right now. Try again in a minute.', 429)
}
