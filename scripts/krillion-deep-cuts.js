/*
 * Krillion deep-cut autopilot.
 *
 * Plays https://krillion.io's 7-prompt dive and answers every prompt with the
 * rarest answer it has that is still true. Paste the whole file into the page's
 * DevTools console (or inject it with any browser automation that can evaluate
 * in the page) while you are on krillion.io, then press Enter.
 *
 * How the scoring actually works (measured on dive #127, 545 pts, 5,450 m):
 *   - Each answer is judged against what other players typed. Sturgeon = 60,
 *     "Nearby devices" = 60, but Henneth Annûn / corn pad / Piotr Szulkin /
 *     Nauru / Pobol y Cwm = 85 ("DEEP CUT").
 *   - The game normalises what you type to a canonical noun ("beluga sturgeon"
 *     -> "Sturgeon", "corn plaster" -> "Corn pad"). A normalisation that eats
 *     the specific part of the answer is what drops a pick from 85 to 60, so
 *     the runner re-answers with the next candidate instead of accepting it.
 *   - So the bank below is ordered rarest-first per prompt shape, and leans on
 *     proper nouns (places, people, titles) and technical terms, which survive
 *     normalisation intact.
 *
 * Limits: the dive's prompts rotate daily. A prompt that matches nothing in
 * BANK falls back to a single generic answer and will not score a deep cut -
 * add a [regex, answers] row for that prompt shape and it is covered forever.
 */
(() => {
  'use strict';

  const BANK = [
    // ---- measured deep cuts (dive #127) ----
    [/fictional place|(star wars|tolkien|lord of the rings|fortnite|spongebob|disney|pixar).*place/, ['Henneth Annûn', 'Derndingle', 'Nan Dungortheb']],
    [/stick to your skin|peel (it )?off|peel-off/, ['corn pad', 'liquid bandage', 'peel-off base coat']],
    [/direct(ed|or).*(movie|film)|(movie|film).*director/, ['Piotr Szulkin', 'Juraj Herz', 'Kaneto Shindo']],
    [/country.*(soccer|football).*(not|isn't)|soccer isn't/, ['Nauru', 'Marshall Islands', 'Palau']],
    [/tv show.*(five|5).*season|at least five seasons/, ['Pobol y Cwm', 'Take the High Road', 'Rownd a Rownd']],

    // ---- everything else, same idea ----
    [/animal.*(bigger|heavier)|bigger or heavier than a human/, ['giant grouper', 'ocean sunfish']],
    [/permission.*(phone|app)|access on your phone/, ['body sensors', 'usage access', 'draw over other apps']],
    [/type of cloud|cloud/, ['nacreous', 'mammatus']],
    [/fish|sea creature/, ['sarcastic fringehead', 'barreleye']],
    [/bird/, ['oilbird', 'kagu']],
    [/flower|plant|tree/, ['welwitschia', 'ghost orchid']],
    [/fruit/, ['jabuticaba', 'bael']],
    [/vegetable/, ['salsify', 'celtuce']],
    [/cheese/, ['brânză de burduf', 'stinking bishop']],
    [/pasta/, ['strozzapreti', 'malloreddus']],
    [/cocktail|drink/, ['remember the maine', 'corpse reviver']],
    [/cereal/, ['product 19', 'cracklin oat bran']],
    [/candy|sweet/, ['zagnut', 'salmiakki']],
    [/car (brand|make)|automobile/, ['wartburg', 'tatra']],
    [/dog breed/, ['catalburun', 'chinook']],
    [/moon|planet/, ['telesto', 'ymir']],
    [/element/, ['praseodymium', 'holmium']],
    [/language/, ['rotokas', 'paamese']],
    [/holiday|festival/, ['up helly aa', 'tynwald day']],
    [/disney character/, ['humphrey the bear', 'clarabelle cow']],
    [/star wars character/, ['willrow hood', 'dexter jettster']],
    [/pok[eé]mon/, ['cryogonal', 'finneon']],
    [/song|band|artist|musician/, ['nurse with wound', 'this heat']],
    [/book|novel/, ['a void', 'the recognitions']],
    [/movie|film/, ['the hourglass sanatorium', 'marketa lazarova']],
    [/city|town/, ['rabbit hash, kentucky', 'accident, maryland']],
    [/tool/, ['spokeshave', 'drawknife']],
    [/instrument/, ['ondes martenot', 'nyckelharpa']],
    [/sport/, ['sepak takraw', 'buzkashi']],
    [/colou?r/, ['falu red', 'sinopia']],
    [/job|profession|occupation/, ['luthier', 'farrier']],
    [/phobia/, ['omphalophobia', 'turophobia']],
    [/dinosaur/, ['cryolophosaurus', 'sinosauropteryx']],
    [/unit of measurement|measurement/, ['smoot', 'siriometer']],
    [/board game/, ["tzolk'in", 'hive']],
    [/video game/, ['pathologic', 'kentucky route zero']],
    [/kitchen/, ['cherry pitter', 'bench scraper']],
    [/hospital|doctor|medical/, ['otoscope', 'sphygmomanometer']],
    [/rhyme/, ['cusp', 'opus']],
    [/smell|scent/, ['geosmin', 'petrichor']],
    [/number/, ["skewes' number", "graham's number"]],
  ];

  const FALLBACK = ['Graham’s number'];

  // Where the runner is right now - handy when a dive stalls.
  let phase = 'idle';
  const at = (p) => { phase = p; };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const bodyText = () => document.body.innerText || '';
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const button = (re) => [...document.querySelectorAll('button')].find((b) => visible(b) && re.test(norm(b.innerText)));

  function dismissOverlays() {
    for (const b of document.querySelectorAll('button')) {
      if (!visible(b)) continue;
      if (!/AnnouncementGate/.test(String(b.className))) continue;
      b.click();
    }
  }

  // The live prompt is the line printed right above the "rarer answers" rule
  // ("▼ rarer answers sink deeper ▼" on the daily, "▶ rarer answers drive
  // farther ▶" in a themed pack).
  function promptText() {
    const m = bodyText().match(/(?:^|\n)([^\n]{8,400})\n\s*[▼▶]\s*rarer answers[^\n]*/i);
    return m ? norm(m[1]) : '';
  }

  function answerInput() {
    return [...document.querySelectorAll('input[type=text],input:not([type]),textarea')].find(visible) || null;
  }

  // "beluga sturgeon" -> "Sturgeon" is shown before it is accepted.
  function correction() {
    const m = bodyText().match(/“([^”]+)”\ncorrects to\n“([^”]+)”/);
    return m ? { typed: norm(m[1]), canonical: norm(m[2]) } : null;
  }

  function tierInfo() {
    const m = bodyText().match(/(?:^|\n)([A-Z][A-Z ]{2,20})\n“([^”]+)”\n\+(\d+) PTS/);
    return m ? { tier: norm(m[1]), answer: norm(m[2]), pts: Number(m[3]) } : null;
  }

  async function waitFor(fn, ms = 20000, step = 100) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const value = fn();
      if (value) return value;
      await sleep(step);
    }
    return null;
  }

  async function setAnswer(text) {
    const el = answerInput();
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    await sleep(120);
    return true;
  }

  async function submit() {
    const dive = await waitFor(() => {
      const b = button(/^DIVE$/);
      return b && !b.disabled ? b : null;
    }, 1500, 60);
    if (dive) dive.click();
    else answerInput()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    await sleep(150);
  }

  function picksFor(prompt, taken) {
    const p = prompt.toLowerCase();
    for (const [re, picks] of BANK) {
      if (!re.test(p)) continue;
      const fresh = picks.filter((x) => !taken.has(x));
      if (fresh.length) return fresh;
    }
    return [FALLBACK.find((x) => !taken.has(x)) || FALLBACK[0]];
  }

  let running = false;

  async function play() {
    if (running) return;
    running = true;
    dismissOverlays();

    at('start');
    const start = button(/BEGIN DESCENT|START THE DRIVE/i);
    if (start) {
      start.click();
      await sleep(600);
    }

    const rounds = [];
    const taken = new Set();
    const deadline = Date.now() + 6 * 60 * 1000;

    while (rounds.length < 7 && Date.now() < deadline && !/DIVE COMPLETE/.test(bodyText())) {
      at('prompt');
      const prompt = await waitFor(() => promptText(), 25000);
      if (!prompt) break;

      const picks = picksFor(prompt, taken);
      let accepted = null;

      for (let i = 0; i < picks.length; i++) {
        const pick = picks[i];
        at('answer');
        if (!(await setAnswer(pick))) break;
        at('submit');
        await submit();

        // Either the answer goes straight through (reveal), or the game shows
        // "… corrects to …" and waits for a second submit.
        at('outcome');
        const outcome = await waitFor(() => tierInfo() || correction(), 5000);
        if (!outcome || outcome.pts) {
          accepted = outcome ? outcome.answer : pick;
          break;
        }
        // Normalised down to something generic (e.g. "Sturgeon"): try the
        // next, rarer answer instead of letting the generic one through.
        if (i < picks.length - 1) continue;

        await submit(); // no better candidate left - accept the correction
        accepted = outcome.canonical;
        break;
      }

      taken.add(norm(accepted || picks[0]).toLowerCase());

      at('reveal');
      const result = await waitFor(() => tierInfo(), 15000);
      rounds.push({
        prompt: prompt.slice(0, 48),
        answer: result ? result.answer : accepted || '?',
        tier: result ? result.tier : 'missed',
        pts: result ? result.pts : 0,
      });
      if (result && result.pts < 85) console.warn('[krillion] not a deep cut:', rounds[rounds.length - 1]);

      at('next');
      const next = button(/^(DESCEND|NEXT|CONTINUE|DRIVE ON|GO ON)\b/i);
      if (next) {
        next.click();
        await sleep(700);
      }
    }

    const total = rounds.reduce((a, r) => a + r.pts, 0);
    const deep = rounds.filter((r) => r.pts >= 85).length;
    console.table(rounds);
    console.log(`[krillion] ${rounds.length}/7 answered · ${deep} deep cuts · ${total} pts`);
    running = false;
    return rounds;
  }

  window.krillionDeepCuts = { play, bank: BANK, stop: () => { running = false; }, get phase() { return phase; } };
  play();
})();
