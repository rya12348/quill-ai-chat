const cats = [
  'Name a country with at least one active volcano',
  'Name a country whose national capital is on a river',
  'Name a country with coastlines on at least two oceans',
  'Name an item of formal wear (clothing and shoes, not jewelry)',
  'Name a movie starring Zendaya',
];
const t0 = Date.now();
for (const c of cats) {
  const q = c.replace(/^name\s+(a|an|the)\s+/i, '');
  const u = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(q) + '&format=json&srlimit=3&origin=*';
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'puffer-kb/1.0' } });
    const j = await r.json();
    const hits = (j.query && j.query.search || []).map(s => s.title);
    console.log(c.slice(0, 46).padEnd(48) + '-> ' + hits.join(' | '));
  } catch (e) { console.log(c.slice(0, 46).padEnd(48) + 'ERR ' + e.message); }
}
console.log('ms=' + (Date.now() - t0));
