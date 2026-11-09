/**
 * Models do not agree on how to write LaTeX. remark-math only reads the `$`
 * forms, while many models send `\[ … \]` or `\( … \)` — sometimes with the
 * backslash doubled for Markdown. Turn those pairs into math before rendering.
 *
 * Code is left untouched: a fenced block may legitimately show LaTeX source.
 */
const CODE = /```[\s\S]*?```|`[^`\n]*`/g
const DISPLAY = /\\{1,2}\[([\s\S]*?)\\{1,2}\]/g
const INLINE = /\\{1,2}\(([\s\S]*?)\\{1,2}\)/g
const SENTINEL = /\u0000(\d+)\u0000/g
// A dollar before a number is money, not math. Escaping it keeps prices ("$40
// to $60") literal; the cost is that the rare inline sum starting with a digit,
// like `$2x$`, is left as text instead of being misread as currency.
const CURRENCY = /(?<![\\$])\$(?!\$)(?=\d)/g

export function normalizeMath(source: string): string {
  if (!source.includes('\\') && !source.includes('$')) return source
  const code: string[] = []
  const guarded = source.replace(CODE, (match) => {
    code.push(match)
    return `\u0000${code.length - 1}\u0000`
  })
  const converted = guarded
    .replace(CURRENCY, () => '\\$')
    .replace(DISPLAY, (_, body: string) => `\n$$\n${body.trim()}\n$$\n`)
    .replace(INLINE, (_, body: string) => `$${body.trim()}$`)
  return converted.replace(SENTINEL, (_, index: string) => code[Number(index)] ?? '')
}
