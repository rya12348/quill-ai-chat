/*
 * Krillion "gem ladder" autopilot - the chase for ONE IN A KRILLION (100).
 *
 * Read this before running it, because 100 is not a rarity score you can
 * calculate your way into. Krillion's own FAQ:
 *
 *   "how is rarity determined? ... a familiarity database ... others get a
 *    combination of LLM assistance and a manual pass."
 *   "why is the krillion sometimes less rare than some deep cuts? Because the
 *    Krillion isn't chosen on rarity alone. Past a certain depth, rarity gets
 *    hard to disambiguate, so the gem is also picked for fun factor: the answer
 *    that's most satisfying to land on ... The gem should be something at least
 *    a few of you actually get."
 *
 * So each prompt has one designated gem, chosen by hand. There is no formula
 * that turns an arbitrary answer into 100, and an answer that is not in the
 * curated answer set is not scored at all ("why was my answer not listed?
 * Because I didn't find it"). A script cannot look the gem up: it is not in
 * /api/today, not in the client bundle, and not shown after a dive or in the
 * archive.
 *
 * What this script actually does is the closest real thing: it plays the dive
 * and, for each prompt, walks a ladder of gem-grade candidates. It reads what
 * the server says back and adapts:
 *   - accepted (tier + score)      -> round over, recorded
 *   - "corrects to" (an alias)     -> the answer is in the set; it accepts the
 *                                     canonical form unless a longer, rarer
 *                                     candidate is still untried
 *   - "try again" / "no echo"      -> the answer is NOT in the set; it moves on
 *                                     to the next candidate inside the same
 *                                     25-second window
 * That last branch is the part the deep-cut script does not have: a rejection
 * costs a retype, not the round.
 *
 * Expected outcome: mostly DEEP CUT (85) with the occasional 100 when the
 * ladder happens to land on the day's gem. If you only want guaranteed 85s,
 * use scripts/krillion-deep-cuts.js instead.
 *
 * Paste into the DevTools console on krillion.io while the dive screen is open.
 */
(() => {
  'use strict';

  // Rarest-first ladders per prompt shape. A rejected pick is skipped, so a row
  // with four entries gets four shots inside one answer window.
  const BANK = [
    // ---- prompts measured on dive #127 (all landed 85 except where noted) ----
    [/fictional place|(star wars|tolkien|lord of the rings|fortnite|spongebob|disney|pixar).*place/, ['Henneth Annûn', 'Derndingle', 'Nan Dungortheb', 'Wellinghall']],
    [/stick to your skin|peel (it )?off|peel-off/, ['corn pad', 'liquid bandage', 'peel-off base coat', 'wart remover patch']],
    [/direct(ed|or).*(movie|film)|(movie|film).*director/, ['Piotr Szulkin', 'Juraj Herz', 'Kaneto Shindo', 'Zoltán Fábri']],
    [/country.*(soccer|football).*(not|isn't)|soccer isn't/, ['Nauru', 'Marshall Islands', 'Palau', 'Tuvalu']],
    [/tv show.*(five|5).*season|at least five seasons/, ['Pobol y Cwm', 'Take the High Road', 'Rownd a Rownd', 'Fair City']],
    [/animal.*(bigger|heavier)|bigger or heavier than a human/, ['giant grouper', 'ocean sunfish', 'beluga sturgeon']],
    [/permission.*(phone|app)|access on your phone/, ['body sensors', 'usage access', 'notification access', 'draw over other apps']],

    // ---- same idea, other prompt shapes ----
    [/type of cloud|cloud/, ['nacreous', 'mammatus', 'noctilucent']],
    [/fish|sea creature/, ['sarcastic fringehead', 'barreleye', 'viperfish']],
    [/bird/, ['oilbird', 'kagu', 'hoatzin']],
    [/flower|plant|tree/, ['welwitschia', 'ghost orchid', 'corpse flower']],
    [/fruit/, ['jabuticaba', 'bael', 'monstera deliciosa']],
    [/vegetable/, ['salsify', 'celtuce', 'samphire']],
    [/cheese/, ['brânză de burduf', 'stinking bishop', 'casu marzu']],
    [/pasta/, ['strozzapreti', 'malloreddus', 'fregula']],
    [/cocktail|drink/, ['remember the maine', 'corpse reviver', 'aviation']],
    [/cereal/, ['product 19', 'cracklin oat bran', 'kix']],
    [/candy|sweet/, ['zagnut', 'salmiakki', 'sky bar']],
    [/car (brand|make)|automobile/, ['wartburg', 'tatra', 'trabant']],
    [/dog breed/, ['catalburun', 'chinook', 'mudi']],
    [/moon|planet/, ['telesto', 'ymir', 'kerberos']],
    [/element/, ['praseodymium', 'holmium', 'terbium']],
    [/language/, ['rotokas', 'paamese', 'ainu']],
    [/holiday|festival/, ['up helly aa', 'tynwald day', 'higan']],
    [/disney character/, ['humphrey the bear', 'clarabelle cow', 'scrooge mcduck']],
    [/star wars character/, ['willrow hood', 'dexter jettster', 'elan sleazebaggano']],
    [/pok[eé]mon/, ['cryogonal', 'finneon', 'lumineon']],
    [/song|band|artist|musician/, ['nurse with wound', 'this heat', 'coil']],
    [/book|novel/, ['a void', 'the recognitions', 'the man without qualities']],
    [/movie|film/, ['the hourglass sanatorium', 'marketa lazarova', 'the saragossa manuscript']],
    [/city|town/, ['rabbit hash, kentucky', 'accident, maryland', 'boring, oregon']],
    [/tool/, ['spokeshave', 'drawknife', 'adze']],
    [/instrument/, ['ondes martenot', 'nyckelharpa', 'glass harmonica']],
    [/sport/, ['sepak takraw', 'buzkashi', 'pato']],
    [/colou?r/, ['falu red', 'sinopia', 'amaranth']],
    [/job|profession|occupation/, ['luthier', 'farrier', 'foley artist']],
    [/phobia/, ['omphalophobia', 'turophobia', 'xanthophobia']],
    [/dinosaur/, ['cryolophosaurus', 'sinosauropteryx', 'anzu']],
    [/unit of measurement|measurement/, ['smoot', 'siriometer', 'barn']],
    [/board game/, ["tzolk'in", 'hive', 'santorini']],
    [/video game/, ['pathologic', 'kentucky route zero', 'the void']],
    [/kitchen/, ['cherry pitter', 'bench scraper', 'larding needle']],
    [/hospital|doctor|medical/, ['otoscope', 'sphygmomanometer', 'foley catheter']],
    [/rhyme/, ['cusp', 'opus', 'bulb']],
    [/smell|scent/, ['geosmin', 'petrichor', 'ambroxan']],
    [/number/, ["skewes' number", "graham's number", 'googolplex']],
  ];

  const FALLBACK = ['Graham’s number'];

  let phase = 'idle';
  const at = (p) => { phase = p; };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const bodyText = () => document.body.innerText || '';
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const button = (re) => [...document.querySelectorAll('button')].find((b) => visible(b) && re.test(norm(b.innerText)));

  function dismissOverlays() {
    for (const b of document.querySelectorAll('button')) {
      if (visible(b) && /AnnouncementGate/.test(String(b.className))) b.click();
    }
  }

  // The prompt is the line printed above the "rarer answers ..." rule.
  function promptText() {
    const m = bodyText().match(/(?:^|\n)([^\n]{8,400})\n\s*[▼▶]\s*rarer answers[^\n]*/i);
    return m ? norm(m[1]) : '';
  }

  function answerInput() {
    return [...document.querySelectorAll('input[type=text],input:not([type]),textarea')].find(visible) || null;
  }

  function correction() {
    const m = bodyText().match(/“([^”]+)”\ncorrects to\n“([^”]+)”/);
    return m ? { typed: norm(m[1]), canonical: norm(m[2]) } : null;
  }

  function tierInfo() {
    const m = bodyText().match(/(?:^|\n)([A-Z][A-Z ]{2,20})\n“([^”]+)”\n\+(\d+) PTS/);
    return m ? { tier: norm(m[1]), answer: norm(m[2]), pts: Number(m[3]) } : null;
  }

  // "no echo", "not listed", "<reason> Try again." - the answer is not in the
  // curated set and costs nothing but a retype.
  function rejected() {
    return /try again|no echo|not listed/i.test(bodyText());
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

  function ladderFor(prompt, taken) {
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

      const ladder = ladderFor(prompt, taken);
      let settled = null;

      for (let i = 0; i < ladder.length && !settled; i++) {
        const pick = ladder[i];
        at('answer ' + pick);
        if (!(await setAnswer(pick))) break;
        await submit();

        at('outcome');
        const outcome = await waitFor(() => tierInfo() || correction() || (rejected() ? { reject: true } : null), 4000);
        if (!outcome) break;

        if (outcome.pts) {
          settled = { answer: outcome.answer, tier: outcome.tier, pts: outcome.pts };
        } else if (outcome.canonical) {
          // In the set, but normalised. Accept it if no untried candidate is
          // left; otherwise keep hunting for the gem.
          if (i < ladder.length - 1) continue;
          await submit();
          const fixed = await waitFor(() => tierInfo(), 8000);
          settled = fixed
            ? { answer: fixed.answer, tier: fixed.tier, pts: fixed.pts }
            : { answer: outcome.canonical, tier: 'normalised', pts: 0 };
        } else {
          // Not in the answer set: next rung.
          continue;
        }
      }

      taken.add(norm(settled ? settled.answer : ladder[0]).toLowerCase());

      if (!settled) {
        at('reveal');
        const late = await waitFor(() => tierInfo(), 8000);
        settled = late ? { answer: late.answer, tier: late.tier, pts: late.pts } : { answer: '?', tier: 'missed', pts: 0 };
      }

      rounds.push({ prompt: prompt.slice(0, 44), answer: settled.answer, tier: settled.tier, pts: settled.pts });
      if (settled.pts < 100) console.warn('[krillion] not the gem:', rounds[rounds.length - 1]);

      at('next');
      const next = button(/^(DESCEND|NEXT|CONTINUE|DRIVE ON|GO ON)\b/i);
      if (next) {
        next.click();
        await sleep(700);
      }
    }

    const gems = rounds.filter((r) => r.pts === 100).length;
    console.table(rounds);
    console.log(`[krillion] ${rounds.length}/7 answered · ${gems} one-in-a-krillions · ${rounds.reduce((a, r) => a + r.pts, 0)} pts`);
    running = false;
    return rounds;
  }

  window.krillionGemLadder = { play, bank: BANK, stop: () => { running = false; }, get phase() { return phase; } };
  play();
})();
