import assert from 'node:assert/strict'
import test from 'node:test'

import { parseWorkspaceRequests } from '../src/shared/workspace'
import { DOC_FETCH_CHARS, needsResearch, readableText } from '../src/worker/doc-fetch'

test('a FETCH line is parsed as a documentation request, junk is not', () => {
  const requests = parseWorkspaceRequests(`=== FETCH: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
=== FETCH: file:///etc/passwd
=== FETCH: javascript:alert(1)`)
  assert.deepEqual(requests, [{ kind: 'fetch', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API' }])
})

test('page text keeps prose and drops scripts, styles and markup', () => {
  const text = readableText(
    '<html><head><title>x</title><style>.a{color:red}</style></head><body><script>var a=1</script><h1>Canvas API</h1><p>Use <code>fillRect</code> to draw.</p><noscript>no</noscript></body></html>',
  )
  assert.match(text, /Canvas API/)
  assert.match(text, /Use\s+fillRect\s+to draw\./)
  assert.doesNotMatch(text, /var a=1/)
  assert.doesNotMatch(text, /color:red/)
  assert.doesNotMatch(text, /<p>/)
})

test('entities are decoded and the cap is what a prompt can afford', () => {
  assert.equal(readableText('<p>a &amp; b &lt;c&gt; &#39;d&#39;</p>'), "a & b <c> 'd'")
  const long = readableText(`<p>${'word '.repeat(DOC_FETCH_CHARS)}</p>`)
  assert.ok(long.length > 1_000)
})

test('research is reserved for requests that depend on something outside the files', () => {
  assert.equal(needsResearch('add a Chart.js bar chart'), true)
  assert.equal(needsResearch('use the latest Three.js from a CDN'), true)
  assert.equal(needsResearch('make the button rounded and blue'), false)
  assert.equal(needsResearch('a hero with a big heading'), false)
})
