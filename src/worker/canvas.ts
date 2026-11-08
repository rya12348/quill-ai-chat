// Canvas mode turns a request into a small study set — flashcards or a quiz —
// as strict JSON, so the reply can render it as an interactive card. One free
// lane writes it; the Worker never runs the study set.

import { MAX_CANVAS_CARDS, MAX_CANVAS_QUESTIONS } from '../shared/config'
import type { CanvasCard, CanvasInfo, CanvasQuestion } from '../shared/types'
import { AiError } from './ai'
import { activeLanes, laneStrength, laneText, type LaneResult, type PublicLane } from './public-ai'

export type CanvasIntent = {
  lanes: PublicLane[]
  question: string
  signal?: AbortSignal
  onStatus?: (text: string) => Promise<void> | void
  onLaneResult?: (result: LaneResult) => void
}

export type CanvasOutcome = {
  text: string
  canvas: CanvasInfo
}

/** Quiz wording wins; everything else becomes a deck. */
export function canvasKind(question: string): CanvasInfo['kind'] {
  return /\b(quiz|test me|practice (?:questions|test)|multiple[- ]choice|exam)\b/i.test(question) ? 'quiz' : 'flashcards'
}

function parseJson(raw: string): Record<string, unknown> | undefined {
  const fenced = /```(?:json)?[ \t]*\n([\s\S]*?)```/i.exec(raw)?.[1]
  const text = (fenced ?? raw).trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Validates one model answer into a usable set, or rejects it so another lane can try. */
export function parseCanvasSet(
  raw: string,
  kind: CanvasInfo['kind'],
): { title: string; cards?: CanvasCard[]; questions?: CanvasQuestion[] } | undefined {
  const body = parseJson(raw)
  if (!body) return undefined
  const title = clean(body.title, 120) || (kind === 'quiz' ? 'Practice quiz' : 'Flashcards')
  if (kind === 'quiz') {
    const rows = Array.isArray(body.questions) ? body.questions : []
    const questions: CanvasQuestion[] = rows
      .flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const item = row as Record<string, unknown>
        const question = clean(item.question ?? item.prompt, 400)
        const choices = Array.isArray(item.choices)
          ? item.choices.map((choice) => clean(choice, 200)).filter(Boolean).slice(0, 4)
          : []
        const answer = Number(item.answer)
        if (!question || choices.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) return []
        const explanation = clean(item.explanation, 400)
        return [{ question, choices, answer, ...(explanation ? { explanation } : {}) }]
      })
      .slice(0, MAX_CANVAS_QUESTIONS)
    return questions.length ? { title, questions } : undefined
  }
  const rows = Array.isArray(body.cards) ? body.cards : []
  const cards: CanvasCard[] = rows
    .flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const item = row as Record<string, unknown>
      const front = clean(item.front ?? item.term ?? item.question, 240)
      const back = clean(item.back ?? item.definition ?? item.answer, 500)
      return front && back ? [{ front, back }] : []
    })
    .slice(0, MAX_CANVAS_CARDS)
  return cards.length ? { title, cards } : undefined
}

export async function canvasComplete(input: CanvasIntent): Promise<CanvasOutcome> {
  const kind = canvasKind(input.question)
  const ranked = [...activeLanes(input.lanes)].sort(
    (a, b) => laneStrength(b.model, b.url) - laneStrength(a.model, a.url),
  )
  const shape =
    kind === 'quiz'
      ? '{"title":"...","questions":[{"question":"...","choices":["...","...","...","..."],"answer":0,"explanation":"..."}]}'
      : '{"title":"...","cards":[{"front":"...","back":"..."}]}'
  const rules =
    kind === 'quiz'
      ? `Write ${Math.min(8, MAX_CANVAS_QUESTIONS)} multiple-choice questions with exactly four plausible choices each. "answer" is the zero-based index of the one correct choice. Add a one-sentence "explanation" for each.`
      : `Write ${Math.min(12, MAX_CANVAS_CARDS)} flashcards. "front" is a short prompt or term; "back" is a concise, self-contained answer.`
  const system = `You are a study designer making ${kind === 'quiz' ? 'a practice quiz' : 'a flashcard deck'} from a request.

Return ONLY a single JSON object with this exact shape:
${shape}

Rules:
- ${rules}
- Be accurate. Do not invent facts, dates, people or sources. If the topic is too vague for a good set, write an introductory set and say so in "title".
- Plain text only. No Markdown, no code fences, no commentary outside the JSON.
- Keep every field under 400 characters.`

  for (const lane of ranked.slice(0, 3)) {
    try {
      await input.onStatus?.(kind === 'quiz' ? 'Writing a practice quiz…' : 'Writing a flashcard deck…')
      const signal = AbortSignal.any([input.signal ?? new AbortController().signal, AbortSignal.timeout(45_000)])
      const raw = await laneText(lane, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input.question.replace(/\s+/g, ' ').trim().slice(0, 2_000) },
        ],
        signal,
        temperature: 0.3,
        maxTokens: 3_000,
        onLaneResult: input.onLaneResult,
      })
      const set = parseCanvasSet(raw, kind)
      if (!set) continue
      const total = set.cards?.length ?? set.questions?.length ?? 0
      return {
        text:
          kind === 'quiz'
            ? `Here is a ${total}-question quiz on that. Answer each one below; the right answer and a short explanation appear as you go.`
            : `Here is a ${total}-card deck on that. Tap a card to flip it.`,
        canvas: {
          status: 'ready',
          kind,
          title: set.title,
          ...(set.cards ? { cards: set.cards } : {}),
          ...(set.questions ? { questions: set.questions } : {}),
          models: [lane.label ?? lane.model],
          asOf: Date.now(),
        },
      }
    } catch {
      if (input.signal?.aborted) break
      // Try another free lane.
    }
  }
  throw new AiError('unavailable', 'Canvas could not get a usable study set from a free model. Try a narrower topic.', 503)
}
