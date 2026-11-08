// Generated pages are model output, not a template, so a tag can be left open.
// An unclosed <style> is the damaging case: the browser reads the rest of the
// document as CSS and paints an empty page. Repair it on the way in and again
// when rendering an older saved build.

const BODY_ANCHOR = /<\/head>|<body[\s>]|<(?:header|main|section|div|h1|nav|footer|p)[\s>]/i

/**
 * Closes an unclosed <style> before the first element that follows the CSS.
 * Complete documents are returned unchanged.
 */
export function repairDocument(html: string): string {
  const opened = (html.match(/<style[\s>]/gi) ?? []).length
  const closed = (html.match(/<\/style>/gi) ?? []).length
  if (opened <= closed) return html
  const anchor = BODY_ANCHOR.exec(html)
  if (!anchor || anchor.index === undefined) return `${html}\n</style>`
  return `${html.slice(0, anchor.index)}</style>\n${html.slice(anchor.index)}`
}
