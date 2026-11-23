// Patch pass 6: no WordNet family member goes out while the model lane is
// answering. For "Name a body part animals have but humans don't" the pack sent
// 'Acicula' (a plant bristle) a second before the model's 'tentacles', 'claw',
// 'horn', 'feather', 'fang', 'tusks' arrived. A kind of the head noun is the
// pack's worst tier and the lane answers these clues properly.
import fs from 'node:fs';

const FILE = 'scripts/puffer-kb/bot.js';
let src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const find =
`      if (!a || BOT.turnSent[KR.norm(a)] || pickedBefore(a) || wasTried(BOT.cat || '', a) ||
          banned(a) || !answerable(a, trustedSrc(a))) continue;`;

const replace =
`      if (!a || BOT.turnSent[KR.norm(a)] || pickedBefore(a) || wasTried(BOT.cat || '', a) ||
          banned(a) || !answerable(a, trustedSrc(a))) continue;
      // A WordNet family member is a *kind of* the head noun ('acicula' for a
      // body-part question, 'dirge' for a song). While a lane that read the
      // wording is answering, that tier never wins: the model had tentacles,
      // claw, horn, feather, fang and tusks for exactly that clue.
      if (/^wordnet:/.test(String((BOT.src || {})[KR.norm(a)] || '')) &&
          (BOT.llmPending || BOT.llmGot || BOT.askPending)) {
        if (!BOT.famHoldAt || Date.now() - BOT.famHoldAt > 1500) {
          BOT.famHoldAt = Date.now();
          log({ holdFamily: a, src: (BOT.src || {})[KR.norm(a)] });
        }
        continue;
      }`;

const n = src.split(find).length - 1;
if (n !== 1) { console.error('ANCHOR FAIL matches=' + n); process.exit(1); }
src = src.replace(find, () => replace);
fs.writeFileSync(FILE, src.replace(/\n/g, '\r\n'));
console.log('patched wordnet hold');
