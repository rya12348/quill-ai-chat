// Downloadable forms of a saved artifact. The Worker composes the same text the
// library hands to the browser, and the browser saves it as a file.

import type { AnalysisInfo, CanvasCard, CanvasQuestion, Source } from './types'

/** A filesystem-safe name, never empty and never with a trailing dash. */
export function artifactSlug(title: string, fallback = 'artifact'): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug || fallback
}

export function canvasMarkdown(input: {
  title: string
  kind: 'flashcards' | 'quiz'
  cards?: CanvasCard[]
  questions?: CanvasQuestion[]
}): string {
  const lines = [`# ${input.title}`, '', input.kind === 'quiz' ? 'Practice quiz' : 'Flashcards', '']
  for (const card of input.cards ?? []) lines.push(`## ${card.front}`, '', card.back, '')
  ;(input.questions ?? []).forEach((question, index) => {
    lines.push(`### ${index + 1}. ${question.question}`, '')
    question.choices.forEach((choice, choiceIndex) => lines.push(`- ${choiceIndex === question.answer ? '[x]' : '[ ]'} ${choice}`))
    if (question.explanation) lines.push('', `_${question.explanation}_`)
    lines.push('')
  })
  return `${lines.join('\n').trim()}\n`
}

export function analysisMarkdown(info: AnalysisInfo): string {
  const lines = [
    '# Analysis',
    '',
    info.question,
    '',
    '## Result',
    '',
    '```text',
    info.stdout || 'No output was printed.',
    '```',
    '',
    '## Python',
    '',
    '```python',
    info.code,
    '```',
    '',
    `${info.rows.toLocaleString()} rows · ${info.columns.length} columns${info.error ? ` · ${info.error}` : ''}`,
  ]
  return `${lines.join('\n').trim()}\n`
}

export function researchMarkdown(title: string, body: string, sources: Source[] = []): string {
  const lines = [`# ${title}`, '', body.trim()]
  if (sources.length) {
    lines.push('', '## Sources', '', ...sources.map((source, index) => `${index + 1}. [${source.title}](${source.url})`))
  }
  return `${lines.join('\n').trim()}\n`
}
