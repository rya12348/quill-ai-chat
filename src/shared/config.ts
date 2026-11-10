// The product's configuration, shared by the Worker and the app. Most
// customisation happens here: the name, the assistant's instructions, which
// models people may pick, and the usage limits that protect the API credits.

export const BRAND = 'Quill'
export const TAGLINE = 'A thoughtful assistant for everyday questions.'

/** What the assistant is told before every conversation. */
export const SYSTEM_PROMPT = `You are ${BRAND}, a thoughtful assistant. Be clear and direct. Match the length of your answer to the question: short for simple ones, structured for complex ones. Use Markdown when it helps (lists, headings, code blocks with a language), never for decoration. If you are unsure, say so.`

/**
 * Models people may choose, in picker order. Ids are Freebuff API model ids
 * (GET https://freebuff.com/api/v1/paid/models lists them). The Worker refuses
 * any model not in this list, so this is also the spending allowlist.
 */
export const MODELS = [
  { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', description: 'Fast, for everyday questions' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', description: 'Careful writing and analysis' },
  { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', description: 'Broad knowledge' },
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon', description: 'Long documents' },
] as const
export type ModelId = (typeof MODELS)[number]['id']
export const DEFAULT_MODEL: ModelId = 'deepseek-v4.1-flash'
/** The picker is a short shortlist, not the whole fallback chain. */
export const PICKER_MODEL_LIMIT = 5

/** Per-user limits. Messages are counted per UTC day. */
export const DAILY_MESSAGE_LIMIT = 50
/** Research reports are more expensive than a chat reply, so they have their own cap. */
export const RESEARCH_DAILY_LIMIT = 3
/** Analyses get a separate, small cap because each one can load a data runner. */
export const ANALYZE_DAILY_LIMIT = 3
/** Builds are also a separate free-mode allowance. */
export const BUILD_DAILY_LIMIT = 3
/** A generated page is stored beside the reply, so keep it bounded. */
export const MAX_BUILD_HTML_CHARS = 80_000
/** Agent runs are bounded: at most three tool steps and one final answer. */
export const AGENT_MAX_STEPS = 4
export const AGENT_MAX_TOOL_STEPS = 3
/** Canvas keeps study sets small enough to review in one sitting. */
export const MAX_CANVAS_CARDS = 24
export const MAX_CANVAS_QUESTIONS = 10
/** How much history goes to the model with each message. */
export const MAX_CONTEXT_MESSAGES = 24
/** The rolling summary kept for turns that no longer fit in that window. */
export const MAX_SUMMARY_CHARS = 4_000
export const MAX_MESSAGE_CHARS = 8_000
export const MAX_OUTPUT_TOKENS = 4_096
/** Standing instructions kept with the account and added to every reply. */
export const MAX_INSTRUCTIONS_CHARS = 2_000
/** Attachments are kept with the message, so these are storage limits too. */
export const MAX_ATTACHMENTS = 4
/** Maximum stored bytes for one image after browser compression. */
export const MAX_ATTACHMENT_BYTES = 1_200_000
/** Maximum text kept from one file; the Worker sends a shorter prompt excerpt. */
export const MAX_TEXT_ATTACHMENT_CHARS = 40_000
/** A PDF or DOCX is parsed in the browser; this bounds the source upload. */
export const MAX_DOCUMENT_SOURCE_BYTES = 20_000_000
/** Total raw attachment bytes in one message. */
export const MAX_ATTACHMENT_TOTAL_BYTES = 3_200_000
/** Analyze keeps the full table in the browser, so it can be larger than text attachments. */
export const MAX_DATASET_BYTES = 2_000_000
export const MAX_DATASET_ROWS = 100_000
export const MAX_DATASET_COLUMNS = 60
export const MAX_DATASET_SAMPLE_CHARS = 8_000

/** Shown on an empty chat. */
export const SUGGESTIONS = [
  'Explain how compound interest works with a quick example',
  'Draft a polite follow-up email about a late invoice',
  'Give me a 20-minute bodyweight workout for a small room',
  'What should I know before adopting a cat?',
]

/** The Freebuff API, unless OPENAI_BASE_URL says otherwise. */
export const FREEBUFF_API_URL = 'https://freebuff.com/api/v1/paid'
/** Where the app's owner creates and funds an API key. */
export const FREEBUFF_API_KEYS_URL = 'https://freebuff.com/account/api'
