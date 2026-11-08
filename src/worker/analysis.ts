// Analyze turns a CSV question into a small Python program that the browser
// runs. Only the dataset profile and a small sample reach this Worker; the full
// file stays in the browser. Generated code is validated here but never run.

import { MAX_DATASET_COLUMNS, MAX_DATASET_SAMPLE_CHARS } from '../shared/config'
import type { DatasetInput } from '../shared/types'
import { AiError, type ChatMessage } from './ai'
import { activeLanes, laneStrength, laneText, type LaneResult, type PublicLane } from './public-ai'

const MAX_CODE_CHARS = 6_000
const MAX_CODE_LINES = 80
const MAX_ANSWER_CHARS = 1_200

export type AnalyzeIntent = {
  lanes: PublicLane[]
  question: string
  dataset: DatasetInput
  signal?: AbortSignal
  onStatus?: (text: string) => Promise<void> | void
  onLaneResult?: (result: LaneResult) => void
}

export type AnalyzeOutcome = {
  /** A short introduction streamed before the browser runs the code. */
  text: string
  code: string
  model: string
}

/** Validates the browser-owned profile; no row data is accepted here. */
export function parseDataset(value: unknown): DatasetInput | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Partial<DatasetInput>
  if (typeof input.id !== 'string' || !/^[A-Za-z0-9-]{8,80}$/.test(input.id)) return undefined
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 180) return undefined
  if (typeof input.mime !== 'string' || input.mime.length > 120) return undefined
  const size = Number(input.size)
  const rows = Number(input.rows)
  if (!Number.isFinite(size) || size < 0 || !Number.isFinite(rows) || rows < 1 || rows > 100_000) return undefined
  const columns = Array.isArray(input.columns)
    ? [...new Set(input.columns.filter((column): column is string => typeof column === 'string' && Boolean(column.trim())).map((column) => column.trim().slice(0, 120)))].slice(0, MAX_DATASET_COLUMNS)
    : []
  if (!columns.length) return undefined
  if (typeof input.sample !== 'string' || !input.sample.trim() || input.sample.length > MAX_DATASET_SAMPLE_CHARS) return undefined
  return {
    id: input.id,
    name: input.name.trim().slice(0, 180),
    mime: input.mime,
    size: Math.floor(size),
    rows: Math.floor(rows),
    columns,
    sample: input.sample,
  }
}

function extract(raw: string): { text: string; code: string } | undefined {
  const fence = /```(?:python|py)?[ \t]*\n([\s\S]*?)```/i.exec(raw)
  const trimmed = raw.trim()
  const code = (fence?.[1] ?? (trimmed.startsWith('import ') || trimmed.startsWith('from ') ? raw : '')).trim()
  if (!code) return undefined
  const before = fence ? raw.slice(0, fence.index) : ''
  const text = before
    .replace(/^##\s*Answer\s*$/im, '')
    .replace(/^##\s*Python\s*$/im, '')
    .replace(/^Here(?:'s| is) (?:the )?(?:analysis|code)[^\n]*$/im, '')
    .trim()
    .slice(0, MAX_ANSWER_CHARS)
  return { text, code }
}

/** Generated code gets a pandas frame, not a filesystem or a network. */
export function isUnsafeAnalysisCode(code: string): boolean {
  if (!code.trim() || code.length > MAX_CODE_CHARS || code.split('\n').length > MAX_CODE_LINES) return true
  if (code.includes('```')) return true
  if (/\b(?:open|exec|eval|compile|subprocess|socket|requests|urllib|shutil|read_csv|read_table|to_csv|to_excel)\s*\(/i.test(code)) return true
  if (/\b(?:os|sys)\s*\./.test(code)) return true
  if (/https?:\/\//i.test(code)) return true
  if (!/\bprint\s*\(/.test(code) && !/\bplt\s*\./.test(code)) return true
  return false
}

function systemPrompt(dataset: DatasetInput): string {
  const columns = dataset.columns.map((column) => JSON.stringify(column)).join(', ')
  return `You are Quill's data analyst. The user attached a table named ${JSON.stringify(dataset.name)} with ${dataset.rows.toLocaleString()} data rows and these columns: ${columns}.

A pandas DataFrame named df is already loaded in the browser. pandas is available as pd and matplotlib.pyplot as plt. Write a short Python program that answers the question from df.

Rules:
- Use only df, pd and plt. Do not read files, access the network, install anything, or use subprocess/os/sys.
- Use the exact column names shown above.
- Print the answer with print(). For a table, print(df.head(20).to_string(index=False)).
- If a chart helps, draw one with plt and include a clear title/labels.
- Do not invent a result; the code must compute it.
- Keep the code under 60 lines.

Return exactly this shape:
## Answer
One or two sentences saying what you are about to compute. Do not state a numeric result yet.
## Python
\`\`\`python
# code here
\`\`\``
}

export async function analysisComplete(input: AnalyzeIntent): Promise<AnalyzeOutcome> {
  const dataset = input.dataset
  const ranked = [...activeLanes(input.lanes)].sort(
    (a, b) => laneStrength(b.model, b.url) - laneStrength(a.model, a.url),
  )
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(dataset) },
    {
      role: 'user',
      content: `${input.question.replace(/\s+/g, ' ').trim().slice(0, 1_500)}\n\nSample rows:\n${dataset.sample}`,
    },
  ]
  for (const lane of ranked.slice(0, 3)) {
    try {
      await input.onStatus?.('Writing the Python analysis…')
      const laneSignal = AbortSignal.any([input.signal ?? new AbortController().signal, AbortSignal.timeout(45_000)])
      const raw = await laneText(lane, {
        messages,
        signal: laneSignal,
        temperature: 0.1,
        maxTokens: 1_200,
        onLaneResult: input.onLaneResult,
      })
      const parsed = extract(raw)
      if (!parsed || isUnsafeAnalysisCode(parsed.code)) continue
      return {
        text: parsed.text || 'I’ll run a small Python analysis against your CSV.',
        code: parsed.code,
        model: lane.label ?? lane.model,
      }
    } catch {
      if (input.signal?.aborted) break
      // Try the next free lane; an unusable program is as unhelpful as a failure.
    }
  }
  throw new AiError('unavailable', 'Analyze could not get a valid Python program from a free model. Try a simpler question or a smaller CSV.', 503)
}
