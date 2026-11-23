import fs from 'node:fs';
const KR = new Function(fs.readFileSync('resolver.js','utf8') + '\nreturn KR;')();
const kb = JSON.parse(fs.readFileSync('kb.json','utf8'));
for (const cat of [
  'Name a country whose national capital is on a river',
  'Name a country with at least one active volcano',
  'Name a country with coastlines on at least two oceans',
  'Name an item of formal wear (clothing and shoes, not jewelry)',
  'Name an English word ending in "-ment"',
  'Name an archery term',
]) {
  const tr = [];
  const r = KR.resolve(cat, kb, { win: true, fallback: false, trace: tr });
  const src = {}; tr.forEach(t => { const k = KR.norm(t.a); if (src[k] == null) src[k] = t.src; });
  console.log('== ' + cat);
  console.log('   ' + r.slice(0, 8).map(a => a + '[' + (src[KR.norm(a)] || '?') + ']').join('  '));
  console.log('   head=' + KR.baseKey(cat) + '  keys=' + KR.keysFor(cat).slice(0,6).join(','));
}
