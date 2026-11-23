// Latency bench for the local model: same prompt as the /llm stream lane, time to
// first line and to a full usable list under different options.
// Usage: node bench-ollama.mjs [model] [query...]
const BASE = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const MODEL = process.argv[2] || 'qwen2.5:7b';
const QUERIES = process.argv.slice(3).length ? process.argv.slice(3)
  : ['Name a type of pasta sauce', 'Name a cartoon from the 2000s', "Name a character from Disney's Aladdin"];

const SYS = 'You answer categories in a fast party game. Reply with the answer list only - one answer per line, '
  + 'no numbering, no quotes, no commentary. Every line must be a real, specific, well-known instance of exactly '
  + 'the category as worded. Answer the exact wording, never a related set: for "a song by X" only songs by X; '
  + 'for "a movie starring Y" only films Y appeared in; for "an actor in Bollywood" only Bollywood actors. '
  + 'Never answer with the category label itself or the broader group an answer belongs to. '
  + 'Give 12 answers.';

const CONFIGS = [
  { name: 'current', options: { temperature: 0.2, num_predict: 96 } },
  { name: 'tuned', options: { temperature: 0, num_predict: 64, num_ctx: 512, num_thread: 8 } },
  { name: 'tuned+short', options: { temperature: 0, num_predict: 48, num_ctx: 512, num_thread: 8 } }
];

async function run(q, cfg, answers) {
  const t0 = Date.now();
  let firstToken = 0, firstLine = 0, n = 0, buf = '', lines = [];
  const r = await fetch(BASE + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, stream: true, keep_alive: '60m', options: cfg.options,
      messages: [
        { role: 'system', content: SYS.replace('Give 12 answers.', 'Give ' + answers + ' answers.') },
        { role: 'user', content: 'Category: ' + q + '\n\nGive ' + answers + ' answers, one per line.' }
      ]
    })
  });
  if (!r.ok) return { error: r.status };
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk);
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let j;
      try { j = JSON.parse(line); } catch (e) { continue; }
      if (j.message && j.message.content) {
        if (!firstToken) firstToken = Date.now() - t0;
        n++;
        // count completed answer lines as they appear
        const txt = j.message.content;
        if (/\n/.test(txt)) {
          for (const part of txt.split('\n')) if (part.trim() && lines.length < 20) lines.push(part.trim());
        }
      }
      if (j.done) {
        return { model: MODEL, cfg: cfg.name, q, firstToken, firstLine: firstLine || null, total: Date.now() - t0, tokens: n, lines: lines.slice(0, 12).join(' / ') };
      }
      if (!firstLine && lines.length) firstLine = Date.now() - t0;
    }
  }
  return { model: MODEL, cfg: cfg.name, q, firstToken, firstLine, total: Date.now() - t0, tokens: n, lines: lines.slice(0, 12).join(' / ') };
}

for (const q of QUERIES) {
  for (const cfg of CONFIGS) {
    const r = await run(q, cfg, cfg.name === 'current' ? 12 : 8);
    console.log(JSON.stringify(r));
  }
}
