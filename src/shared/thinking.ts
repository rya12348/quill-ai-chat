const TAG_NAMES = ['thinking', 'thought', 'reasoning', 'think'] as const
const OPEN_TAG = /^<(thinking|thought|reasoning|think)(?:\s[^>]*)?>/i
const CLOSE_TAG = /<\/(thinking|thought|reasoning|think)\s*>/i
const CLOSE_AT_START = /^<\/(thinking|thought|reasoning|think)\s*>/i

export type ThinkingSplit = { text: string; reasoning: string }

function empty(): ThinkingSplit {
  return { text: '', reasoning: '' }
}

function isOpeningPrefix(buffer: string): boolean {
  const lower = buffer.toLowerCase()
  if (!lower.startsWith('<')) return false
  const rest = lower.slice(1)
  if (rest.includes('>')) return false
  if (rest.startsWith('/')) {
    const closing = rest.slice(1)
    return TAG_NAMES.some((name) => name.startsWith(closing))
  }
  return TAG_NAMES.some(
    (name) =>
      name.startsWith(rest) ||
      rest.startsWith(`${name} `) ||
      rest.startsWith(`${name}\t`) ||
      rest.startsWith(`${name}\n`) ||
      rest.startsWith(`${name}\r`),
  )
}

function isClosingPrefix(buffer: string): boolean {
  const lower = buffer.toLowerCase()
  if (lower === '<') return true
  if (!lower.startsWith('</')) return false
  const rest = lower.slice(2)
  if (rest.includes('>')) return false
  return TAG_NAMES.some((name) => name.startsWith(rest) || rest.startsWith(name))
}

/**
 * Separates inline reasoning tags from visible text without needing a complete
 * response. Tags can straddle SSE chunks, so a partial tag is held until the
 * next chunk; flush() releases an unclosed tag as reasoning rather than losing
 * it when a stream stops early.
 */
export class ThinkingSplitter {
  private thinking = false
  private buffer = ''

  push(chunk: string): ThinkingSplit {
    const out = empty()
    this.buffer += chunk
    while (this.buffer) {
      if (this.thinking) {
        const close = CLOSE_TAG.exec(this.buffer)
        if (close) {
          out.reasoning += this.buffer.slice(0, close.index)
          this.buffer = this.buffer.slice(close.index + close[0].length)
          this.thinking = false
          continue
        }
        const start = this.buffer.lastIndexOf('<')
        if (start >= 0 && isClosingPrefix(this.buffer.slice(start))) {
          out.reasoning += this.buffer.slice(0, start)
          this.buffer = this.buffer.slice(start)
          break
        }
        out.reasoning += this.buffer
        this.buffer = ''
        break
      }

      const open = OPEN_TAG.exec(this.buffer)
      if (open) {
        this.buffer = this.buffer.slice(open[0].length)
        this.thinking = true
        continue
      }
      const strayClose = CLOSE_AT_START.exec(this.buffer)
      if (strayClose) {
        this.buffer = this.buffer.slice(strayClose[0].length)
        continue
      }
      if (isOpeningPrefix(this.buffer)) break
      if (!this.buffer.startsWith('<')) {
        const next = this.buffer.indexOf('<')
        if (next < 0) {
          out.text += this.buffer
          this.buffer = ''
          break
        }
        out.text += this.buffer.slice(0, next)
        this.buffer = this.buffer.slice(next)
        continue
      }
      out.text += '<'
      this.buffer = this.buffer.slice(1)
    }
    return out
  }

  flush(): ThinkingSplit {
    const out = empty()
    if (this.thinking) out.reasoning = this.buffer
    else out.text = this.buffer
    this.buffer = ''
    this.thinking = false
    return out
  }
}

/** Splits a complete string, for saved messages or non-streaming replies. */
export function splitThinking(text: string): ThinkingSplit {
  const splitter = new ThinkingSplitter()
  const first = splitter.push(text)
  const last = splitter.flush()
  return { text: first.text + last.text, reasoning: first.reasoning + last.reasoning }
}
