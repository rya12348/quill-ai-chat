import assert from 'node:assert/strict'
import test from 'node:test'
import { gunzipSync, gzipSync } from 'node:zlib'

import { importGithubRepo, parseTar, repoFileRank, repoFromPrompt, REPO_LIMITS } from '../src/worker/repo-import'

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0'
}

/** A minimal ustar record: only the fields the reader uses are filled in. */
function tarEntry(path: string, body: string): Buffer {
  const data = Buffer.from(body, 'utf8')
  const header = Buffer.alloc(512)
  header.write(path, 0, 100, 'utf8')
  header.write(octal(0o644, 8), 100)
  header.write(octal(0, 8), 108)
  header.write(octal(0, 8), 116)
  header.write(octal(data.length, 12), 124)
  header.write(octal(0, 12), 136)
  header.write('        ', 148)
  header.write('0', 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)])
}

function archive(entries: Record<string, string>, root = 'demo-main'): Uint8Array {
  const blocks = Object.entries(entries).map(([path, body]) => tarEntry(`${root}/${path}`, body))
  const binary = tarEntry(`${root}/logo.png`, '\u0000\u0001binary')
  blocks.push(binary, Buffer.alloc(1024))
  return new Uint8Array(gzipSync(Buffer.concat(blocks)))
}

function fakeFetch(bytes: Uint8Array, status = 200) {
  const calls: string[] = []
  const impl = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    if (status !== 200) return new Response('nope', { status })
    return new Response(bytes, { status: 200 })
  }) as typeof fetch
  return { impl, calls }
}

const repoEntries = {
  'package.json': JSON.stringify({ name: 'demo', scripts: { test: 'node --test' } }),
  'src/tags.js': 'export const tags = []\n',
  'src/tags.test.js': "import test from 'node:test'\n",
  'README.md': '# demo\n',
  'index.d.ts': 'export const tags: string[]\n',
  'tsconfig.json': '{}\n',
  'node_modules/left-pad/index.js': 'module.exports = 1\n',
  'package-lock.json': '{}',
  '.env': 'SECRET=1\n',
}

test('a GitHub address in the request names a repository, other addresses do not', () => {
  assert.deepEqual(repoFromPrompt('fix the bug in https://github.com/Chalk/chalk'), {
    owner: 'Chalk',
    repo: 'chalk',
  })
  assert.deepEqual(repoFromPrompt('https://github.com/owner/repo.git'), { owner: 'owner', repo: 'repo' })
  assert.equal(repoFromPrompt('https://github.com/features/actions'), null)
  assert.equal(repoFromPrompt('https://example.com/owner/repo'), null)
  assert.equal(repoFromPrompt('make me a page about github.com'), null)
})

test('the tar reader follows file records and stops at the end-of-archive block', () => {
  const entries = parseTar(gunzipSync(Buffer.from(archive({ 'a.js': 'x' }))))
  assert.deepEqual(
    entries.map((entry) => entry.path),
    ['demo-main/a.js', 'demo-main/logo.png'],
    'the codeload root prefix is still there; the importer strips it',
  )
})

test('an import keeps source and the manifest, and drops vendors, locks and secrets', async () => {
  const { impl, calls } = fakeFetch(archive(repoEntries))
  const result = await importGithubRepo({ owner: 'owner', repo: 'demo' }, { fetchImpl: impl })

  assert.equal(result.reason, undefined)
  assert.match(calls[0]!, /codeload\.github\.com\/owner\/demo\/tar\.gz\/HEAD/)
  assert.equal(result.files[0]!.path, 'package.json', 'the manifest is always first')
  assert.deepEqual(
    result.files.map((file) => file.path),
    ['package.json', 'src/tags.js', 'src/tags.test.js', 'index.d.ts', 'tsconfig.json', 'README.md'],
  )
  // A declaration file is source, not an asset: dropping it makes a TypeScript
  // project fail its own type check the moment the sandbox runs.
  for (const skipped of ['node_modules', 'package-lock.json', '.env', 'logo.png']) {
    assert.equal(
      result.files.some((file) => file.path.includes(skipped)),
      false,
      `${skipped} must not become workspace content`,
    )
  }
  assert.ok(result.skipped >= 4)
})

test('files the budget could not fit are named, not silently forgotten', async () => {
  // Six files at just under the per-file ceiling: the total budget cannot hold
  // them all, so the tail is dropped and must still be nameable.
  const chunk = 'x'.repeat(REPO_LIMITS.fileBytes - 10)
  const entries: Record<string, string> = { 'package.json': '{"name":"demo"}' }
  for (let index = 0; index < 6; index += 1) entries[`src/file-${index}.js`] = chunk

  const { impl } = fakeFetch(archive(entries))
  const result = await importGithubRepo({ owner: 'owner', repo: 'big' }, { fetchImpl: impl })

  assert.ok(result.files.length > 0)
  assert.ok(result.skippedPaths.length > 0, 'a dropped project file must be named')
  assert.match(result.skippedPaths[0]!, /^src\/file-\d+\.js$/)
  for (const kept of result.files) {
    assert.equal(result.skippedPaths.includes(kept.path), false, 'a kept file is never also listed as dropped')
  }
})

test('a private or missing repository is a reason, not an exception', async () => {
  const { impl } = fakeFetch(new Uint8Array(), 404)
  const result = await importGithubRepo({ owner: 'owner', repo: 'gone' }, { fetchImpl: impl })
  assert.deepEqual(result.files, [])
  assert.match(result.reason ?? '', /private or does not exist/)
})

test('an oversized archive is refused before it is unpacked', async () => {
  const { impl } = fakeFetch(new Uint8Array(REPO_LIMITS.compressedBytes + 1))
  const result = await importGithubRepo({ owner: 'owner', repo: 'huge' }, { fetchImpl: impl })
  assert.match(result.reason ?? '', /too large/)
})

test('source outranks tests, which outrank prose', () => {
  assert.ok(repoFileRank('package.json') < repoFileRank('src/a.js'))
  // A large repository has far more tests than slots; the code being tested
  // must survive the budget, or the edit has nothing to change.
  assert.ok(repoFileRank('lib/router.js') < repoFileRank('test/router.js'))
  assert.ok(repoFileRank('tests/a.js') < repoFileRank('docs/a.js'))
  assert.ok(repoFileRank('docs/a.js') < repoFileRank('README.md'))
})
