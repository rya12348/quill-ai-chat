// Patch pass 5: the stream lane may not answer a named-subject clue with a
// common noun. For "Name a character from Disney's Aladdin" the local model's
// stream produced 'lamp', 'khan', 'gymkhana' (all lowercase nouns) while its
// one-shot list correctly had Genie / Jafar / Aladdin / Abu / Iago / Princess
// Jasmine. The room refused every one of those nouns.
import fs from 'node:fs';

const FILE = 'scripts/puffer-kb/bot.js';
let src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const find =
`    if (!k || banned(a) || !KR.shapeOk(cat, a) || junkFinal(a)) return;`;

const replace =
`    if (!k || banned(a) || !KR.shapeOk(cat, a) || junkFinal(a)) return;
    // A clue that names a work, brand or person ("...from Disney's Aladdin",
    // "Name a Katy Perry song") can only be answered with a name or a title.
    // The model's stream answered Aladdin with 'lamp', 'khan' and 'gymkhana' -
    // lowercase common nouns, every one refused - while its one-shot list had
    // Genie, Jafar and Jasmine. A lowercase word is kept only when the pack
    // already knows it for this clue (so 'toy story' still counts for Pixar).
    if (subjectToken() && !/[A-Z]/.test(String(a)) && !(BOT.src || {})[k]) {
      if (!BOT.streamDropAt || Date.now() - BOT.streamDropAt > 1500) {
        BOT.streamDropAt = Date.now();
        log({ streamDrop: a, why: 'not a name' });
      }
      return;
    }`;

const n = src.split(find).length - 1;
if (n !== 1) { console.error('ANCHOR FAIL matches=' + n); process.exit(1); }
src = src.replace(find, () => replace);
fs.writeFileSync(FILE, src.replace(/\n/g, '\r\n'));
console.log('patched stream gate');
