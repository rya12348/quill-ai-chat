/*
 * Puffer Party autopilot v25 - answers from a frozen knowledge pack.
 *
 * Built by scripts/puffer-kb/build-kb.mjs from WordNet 3.1, the Krillion dive
 * corpus and Datamuse associations. Unseen categories resolve through the
 * head-noun index instead of needing a hand-written rule; letter and ending
 * constraints are honoured; answers the room accepts are remembered.
 *
 * Paste this file, then load the pack:
 *   window.__KRP = [];
 *   window.__KRP.push("...")   // one call per dist/kb-part-NN.txt
 *   __krLoad()
 */
(function () {
/*
 * Puffer Party resolution core.
 *
 * Turns a raw category line ("Name a type of cheese starting with B") into an
 * ordered list of answers, using a knowledge pack in the shape built by
 * scripts/puffer-kb/build-kb.mjs:
 *
 *   hn     head-noun index   { "cheese": "Brie|Edam|..." }   (WordNet hyponyms)
 *   pr     prompt index      { "name a pasta shape": "Penne|..." } (game corpus)
 *   tr     association index { "something in a gym bag": "Towel|..." } (Datamuse)
 *   voc    answer vocabulary "Bag|Ball|..."        (letter-constrained fallback)
 *   gen    last-resort generic answers
 *   lrn    runtime learning  { "<category>": { ok: [...], bad: [...] } }
 *
 * No DOM, no fetch, no WordNet at runtime: pure lookups over a frozen pack, so
 * it costs microseconds in the page and can be unit-tested in Node.
 */
var KR = (function () {
  'use strict';

  var DE = /[\u0300-\u036f]/g;

  function deaccent(s) {
    try { return String(s).normalize('NFD').replace(DE, ''); } catch (e) { return String(s); }
  }

  function norm(s) {
    return deaccent(s == null ? '' : s).toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[^a-z0-9' ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // How the game phrases a demand: "Name a ...", "Name an ...", "Name the ...".
  var LEAD = /^(?:(?:ok|okay|so|now|next|and|also)[, ]+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:name|give|list|say|tell\s+me|think\s+of|recall|remember)\s+(?:me\s+)?(?:\d+|an|a|the|one|two|three|four|five|some|any|another)?\s*/;

  // Everything after one of these stops describing the category's head noun and
  // starts adding conditions, so the key is the text before it.
  var QUAL = /\b(?:that|which|who|whose|whom|with|without|from|in|into|on|onto|at|over|under|beneath|near|inside|outside|containing|contains|contain|starting|starts|started|start|ending|ends|ended|end|beginning|begins|began|begin|has|have|having|had|is|are|was|were|be|been|being|can|could|would|will|should|must|do|does|did|to|for|you|your|yours|people|person|someone|somebody|anyone|anybody|everyone|everybody|ever|also|but|and|or|nor|not|no|more|less|fewer|than|during|after|before|between|about|because|while|typically|usually|commonly|often|found|used|made|located|sold|served|grown|played|eaten|born|known|considered|rated|listed|released|designed|meant|you'd|you'll|it's|nobody|nothing)\b/;

  // Trailing filler that names the *kind* of thing rather than the domain:
  // "beer brand" is a question about beer, not about branding irons.
  var TAIL = / ?\b(?:brand|brands|make|makes|manufacturer|company|companies|chain|chains|type|types|kind|kinds|sort|sorts|variety|varieties|form|forms|name|names|example|examples|series|franchise|franchises|title|titles)$/;

  // A category that opens with one of these says nothing on its own: the real
  // head noun is whatever follows ("something in a gym bag" is about the bag).
  var VAGUE = /^(?:something|somebody|someone|thing|things|anything|anybody|anyone|nothing|everything|stuff|item|object)$/;

  // "type of cheese" -> "cheese", "brand of shoe" -> "shoe".
  var HEADSTRIP = /^(?:a |an |the )?(?:type|types|kind|kinds|sort|sorts|form|forms|variety|varieties|brand|brands|make|makes|model|models|example|examples|instance|instances|piece|pieces|part|parts|style|styles|category|categories|class|classes|member|members|species|breed|breeds|version|versions|edition|editions|company|companies|chain|chains|series|genre|genres|term|terms|word|words|name|names|title|titles|game|games|show|shows|movie|movies)\s+of\s+(?:a |an |the )?/;

  var STOP = {};
  ('a an the of and or but for with without from into onto in on at to by as is are was were be been ' +
   'that which who whose what when where why how name names one two three some any your you it its ' +
   'this these those there their they them than then also not no yes ever any all every each other ' +
   'something someone somebody thing things stuff type kind sort form lot ' +
   // never a category on their own - they describe the shape of an answer, not
   // its subject, and answering them yields a branding iron for a beer brand
   'brand brands make makes manufacturer company companies chain chains variety ' +
   'varieties example examples name names title titles character characters ' +
   'word words item items player players team teams series franchise').split(' ').forEach(function (w) { STOP[w] = 1; });

  // Parentheses carry the game's own hint ("(kinds of animal, not breeds)") and
  // must go before normalising, which would otherwise flatten them into words
  // that end up in the lookup key.
  function prep(raw) {
    return norm(String(raw == null ? '' : raw).replace(/\([^)]*\)/g, ' '));
  }

  function singular(w) {
    if (w.length < 4) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/(?:ch|sh|ss|x|z)es$/.test(w)) return w.slice(0, -2);
    if (/[^s]s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  // A key that ends in a stray article or function word is not a WordNet lemma:
  // "official document a" missed the synset whose lemma is "official document",
  // and the ladder fell through to a person list instead. Trim those ends.
  var EDGE = /(?:^|\s)(?:a|an|the|of|in|on|at|to|for|with|from|or|and|nor|but|that|which|who|whose|is|are|was|were|be|been|being|your|you|it|its|their|this|these|those|some|any|might|may|can|could|would|should|will|has|have|had)$/;
  function tidy(s) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    var prev;
    do { prev = s; s = s.replace(EDGE, '').replace(/\s+/g, ' ').trim(); } while (s && s !== prev);
    return s;
  }

  function constraints(raw) {
    // Constraints are read from the raw text: the room states them inside
    // parentheses - "could be in Wordle (5 letters)" - and stripping those
    // before parsing silently drops the rule.
    var t = norm(raw), c = {}, m;
    // A multi-letter prefix is its own rule: "a word starting with 'thr'" is not
    // a question about the letter T, and reading it as one answered with dialects
    // of English. Tried before the single-letter rule, which cannot match "thr"
    // anyway because the letter is not followed by a word boundary.
    // "ends in the letter O" is a suffix rule, and that O is not an initial. The
    // old order read it as a prefix rule (candidate must start with O) and let
    // the suffix rule capture "the", so every answer was filtered out.
    var endsM = t.match(/\bend(?:s|ed|ing)?\s+(?:with|in)\s+(?:the\s+)?(?:letter\s+)?[\"\u201c']?([a-z]{1,6})[\"\u201d']?\b/);
    if (endsM && !STOP[endsM[1]]) c.end = endsM[1];
    if (!endsM) {
      // The rule's own wording must never be captured as the rule: "starts with
      // the letter L" was reading "letter" as the prefix, and "containing the
      // letters dge" was reading "the" as the thing to contain.
      var RULEST = { the: 1, a: 1, an: 1, letter: 1, letters: 1, word: 1, words: 1, both: 1, and: 1, or: 1, any: 1, all: 1,
        one: 1, two: 1, three: 1, four: 1, five: 1, consonant: 1, consonants: 1, vowel: 1, vowels: 1, syllable: 1, syllables: 1 };
      var startRe = /(?:start|starts|started|starting|begin|begins|beginning|began)\s+(?:with|by|in)\s+/;
      if (startRe.test(t) && (m = t.match(/(?:start|starts|started|starting|begin|begins|beginning|began)\s+(?:with|by|in)\s+(?:the\s+)?letters?\s+["\u201c']?([a-z]{1,6})\b/))) {
        if (!RULEST[m[1]]) { if (m[1].length === 1) c.first = m[1]; else c.pre = m[1]; }
      } else if ((m = t.match(/(?:start|starts|started|starting|begin|begins|beginning|began)\s+(?:with|by|in)\s+(?:the\s+)?["\u201c']?([a-z]{2,6})\b/))) {
        if (!RULEST[m[1]]) c.pre = m[1];
      } else if ((m = t.match(/(?:start|starts|started|starting|begin|begins|beginning|began)\s+(?:with|by|in)\s+([a-z])\b/))) c.first = m[1];
      else if ((m = t.match(/\bfirst\s+letter\s+(?:is\s+|must\s+be\s+)?([a-z])\b/))) c.first = m[1];
      // "one vowel letter (A E I O or U...)" and "without the letter A" name a
      // letter without saying the answer starts with it.
      else if (!/vowel|without|doesn't contain|does not contain|not containing/.test(t) &&
        (m = t.match(/\b(?:letter|initial)\s+([a-z])\b/))) c.first = m[1];
    }
    if (!c.end && (m = t.match(/\blast\s+letters?\s+(?:is|are)\s+[\"\u201c']?([a-z]{1,5})\b/))) c.end = m[1];
    // "country with an S and a U in its name": two letters, both required.
    var pairM = t.match(/\bwith\s+(?:both\s+)?(?:an?\s+|the\s+)?([a-z])\s+(?:and|&)\s+(?:an?\s+|the\s+)?([a-z])\b/);
    if (pairM) {
      c.hasAll = [...new Set([pairM[1], pairM[2]])];
      if (!c.has) c.has = c.hasAll[0];
    } else {
      var singleM = t.match(/\bwith\s+(?:an?\s+|the\s+)?([a-z])\b(?=[^.]*\bin its name)/);
      if (singleM && !c.has) c.has = singleM[1];
    }
    var HASST = { the: 1, a: 1, an: 1, letters: 1, letter: 1, word: 1, words: 1, both: 1, and: 1, or: 1, any: 1, all: 1, at: 1, of: 1 };
    if ((m = t.match(/\bcontain(?:s|ed|ing)?\s+(?:the\s+)?(?:letters?|word)\s+["\u201c']?([a-z]{1,6})\b/))) {
      // "a team whose logo contains red" describes the logo, not the word.
      if (!HASST[m[1]] && !/logo\s+contains/.test(t)) c.has = m[1];
    } else if ((m = t.match(/\bcontain(?:s|ed|ing)?\s+["\u201c']?([a-z]{1,6})\b/))) {
      // "a team whose logo contains red" describes the logo, not the word.
      if (!HASST[m[1]] && !/logo\s+contains/.test(t)) c.has = m[1];
    }
    if ((m = t.match(/\b(\d+)\s+letters?\b/))) c.len = +m[1];
    if (/only one vowel/.test(t)) c.vowels = 1;
    // A quoted example defines the shape of the answer. "a contraction (like
    // “don’t”)” wants an apostrophe; without this, WordNet's medical sense won
    // and the room got tetanus, vaginismus and contracture. Whatever the example
    // shows - apostrophe, hyphen, digit - constrains every candidate.
    var exm = t.match(/\(\s*(?:like|e\.g\.?|such as|for example|i\.e\.?)\s*["\u201c']([^\u201d"']{1,40})[\u201d"']\s*\)/) ||
              t.match(/["\u201c]([^\u201d"]{1,40})[\u201d"]/);
    var ex = exm ? exm[1] : '';
    if (ex) {
      if (/['\u2019]/.test(ex)) c.apos = 1;
      if (/-/.test(ex) && ex.indexOf(' ') < 0) c.hyph = 1;
      c.ex = ex;
    }
    // "a contraction" with an apostrophe anywhere in the question is the
    // grammar sense too, example or not.
    if (!c.apos && /\bcontraction\b/.test(t) && /['\u2019]/.test(t)) c.apos = 1;
    // "without the letter A" is an exclusion, not a requirement.
    var negM = t.match(/\b(?:without|no|not containing|doesn't contain|does not contain)\s+(?:the\s+)?(?:letter\s+)?["\u201c']?([a-z])["\u201d']?\b/);
    if (negM) c.notHas = negM[1];
    return c;
  }

  function contentTokens(t) {
    return t.split(' ').filter(function (x) { return x.length > 2 && !STOP[x]; });
  }

  // Ordered lookup keys: most specific first, down to single content words.
  function keysFor(raw) {
    var full = prep(raw);
    var t = full.replace(LEAD, '').replace(/\([^)]*\)/g, ' ')
      .replace(/\s+\d+\+?$/, '')            // the room appends a fuse/count
      .replace(/\s+/g, ' ').trim();
    var q = t.search(QUAL);
    var base = q > 0 ? t.slice(0, q).trim() : t;
    if (q > 0 && VAGUE.test(base)) {
      var rest = contentTokens(t.slice(q)).slice(0, 3).join(' ');
      if (rest) base = rest;
    }
    // "a deli or cured meat" is two heads joined by a conjunction, and the one
    // the answers have to fit is the second: reading the base as "deli" made the
    // bot answer a cured-meat question with WordNet's deli counter.
    if (q > 0 && contentTokens(base).length <= 1) {
      var swap = t.slice(q).match(/^(?:or|and|nor)\s+(.+)$/);
      if (swap) base = swap[1].trim();
    }
    var out = [];
    function add(k) {
      if (!k) return;
      k = k.trim();
      if (k.length < 2 || out.indexOf(k) >= 0) return;
      out.push(k);
    }
    var s = base;
    for (var i = 0; i < 3 && HEADSTRIP.test(s); i++) s = s.replace(HEADSTRIP, '');
    for (var j = 0; j < 3 && TAIL.test(s); j++) s = s.replace(TAIL, '').trim();
    s = tidy(s) || tidy(base);
    // A qualifier is part of the category: "country in Africa" and "country"
    // want different answers, so the combined key is tried before the bare noun.
    // "a part or feature of a road" is a question about roads; "a type of
    // cheese" about cheese. The object of "of" is the domain, so it is tried
    // before the phrase that only describes the shape of the answer.
    // Only when the phrase itself is a shape word: "a part of a car" is about
    // the car, but "a ceremony that marks a stage of life" is about ceremonies,
    // not about life.
    var shape = /^(?:a |an |the )?(?:part|parts|feature|features|piece|pieces|component|components|element|elements|aspect|aspects|type|types|kind|kinds|sort|sorts|form|forms|variety|varieties|example|examples|brand|brands|member|members|stage|stages)\b/;
    var ofTail = shape.test(base)
      ? (t.match(/\bof\s+(?:a|an|the)?\s*([a-z][a-z ']{2,26})$/) || [])[1]
      : null;
    if (ofTail) { add(ofTail.trim()); add(singular(ofTail.trim())); }
    var qual = q > 0 ? contentTokens(t.slice(q)).slice(0, 2) : [];
    // Both compound orders: WordNet files "writing instrument" as "writing
    // implement" but "string instrument" as "stringed instrument", so neither
    // order is reliably the one the taxonomy uses and both are cheap to try.
    if (qual.length) { add(qual.join(' ') + ' ' + s); add(s + ' ' + qual.join(' ')); }
    add(s); add(singular(s));
    // "a deli or cured meat" is one question about two heads: the qualifier cut
    // stops at "or", so the second half never became a key of its own.
    if (/\s(?:or|and|nor)\s/.test(t)) {
      var segs = t.split(/\s+(?:or|and|nor)\s+/);
      for (var g = segs.length - 1; g >= 0; g--) {
        var seg = tidy(segs[g]);
        if (!seg || seg === s) continue;
        add(seg); add(singular(seg));
      }
    }
    // Content words right to left: English noun phrases end in their head, so
    // "science fiction film" is about the film and "living bird" the bird.
    // They come before prefix truncations, which would otherwise stop at
    // "science" and answer with branches of science.
    var toks = contentTokens(t);
    for (var m = toks.length - 1; m >= 0; m--) { add(toks[m]); add(singular(toks[m])); }
    var w = s.split(' ');
    for (var n = w.length - 1; n >= 1; n--) {
      var k = w.slice(0, n).join(' ');
      add(k); add(singular(k));
    }
    add(t); add(full);
    return out;
  }

  // The head noun a category label is really about, without its qualifiers:
  // "Name a type of cheese starting with B" -> "cheese".
  function baseKey(raw) {
    var full = prep(raw);
    var t = full.replace(LEAD, '').replace(/\([^)]*\)/g, ' ')
      .replace(/\s+\d+\+?$/, '').replace(/\s+/g, ' ').trim();
    var q = t.search(QUAL);
    var base = q > 0 ? t.slice(0, q).trim() : t;
    if (q > 0 && VAGUE.test(base)) {
      var rest = contentTokens(t.slice(q)).slice(0, 3).join(' ');
      if (rest) base = rest;
    }
    if (q > 0 && contentTokens(base).length <= 1) {
      var swap = t.slice(q).match(/^(?:or|and|nor)\s+(.+)$/);
      if (swap) base = swap[1].trim();
    }
    var s = base;
    for (var i = 0; i < 3 && HEADSTRIP.test(s); i++) s = s.replace(HEADSTRIP, '');
    for (var j = 0; j < 3 && TAIL.test(s); j++) s = s.replace(TAIL, '').trim();
    return tidy(s) || tidy(base);
  }

  // The named subject of a category. "Name a movie starring Will Smith" is a
  // question about Will Smith and the general movie list cannot answer it, so a
  // phrase the corpus knows as an entity is looked up before any head noun.
  var ENT_RUN = /[A-Z][A-Za-z0-9'\u2019.:-]*(?:\s+(?:of|the|and|&|de|da|van|von|[A-Z][A-Za-z0-9'\u2019.:-]*))*/g;
  function entityKeys(raw, kb) {
    if (!kb || !kb.ent) return [];
    var s = String(raw == null ? '' : raw), out = [], i, k;
    var n = norm(s);
    var base = baseKey(raw);
    // A label the room renders in capitals ("NAME A MOVIE STARRING WILL SMITH")
    // carries no capitalisation signal of its own, so the run pass is skipped and
    // the pack's entity keys are matched against the text instead.
    var names = kb.entn ? kb.entn.split('|') : [];
    var has = {};
    for (i = 0; i < names.length; i++) has[names[i]] = 1;
    var shouting = s === s.toUpperCase() && /[A-Z]{2}/.test(s);
    if (!shouting) {
      var runs = s.match(ENT_RUN) || [];
      for (i = 0; i < runs.length; i++) {
        k = norm(runs[i]);
        if (k && has[k] && out.indexOf(k) < 0) out.push(k);
      }
    }
    if (!out.length) {
      var pad = ' ' + n + ' ';
      var keys = names.slice();
      keys.sort(function (a, b) { return b.length - a.length; });
      for (i = 0; i < keys.length && out.length < 6; i++) {
        k = keys[i];
        // The category's own head noun is not a named subject: a board-game
        // prompt must not be answered from a prompt that merely says "board game".
        if (k === base || singular(k) === base) continue;
        if (pad.indexOf(' ' + k + ' ') >= 0) out.push(k);
      }
    }
    return out;
  }

  function pass(word, c) {
    var s = norm(word);
    if (!s) return false;
    var letters = s.replace(/[^a-z]/g, '');
    if (!letters) return false;
    if (c.pre && letters.indexOf(c.pre) !== 0) return false;
    if (c.first && letters[0] !== c.first) return false;
    if (c.end && letters.slice(-c.end.length) !== c.end) return false;
    if (c.has && s.indexOf(c.has) < 0) return false;
    // "with an S and a U in its name" states two letters, and both are required.
    if (c.hasAll) {
      for (var hi = 0; hi < c.hasAll.length; hi++) if (s.indexOf(c.hasAll[hi]) < 0) return false;
    }
    // "uses only one vowel letter" is about the set of vowels, not their count.
    if (c.vowels === 1) {
      var vs = {};
      for (var vi = 0; vi < letters.length; vi++) if ('aeiou'.indexOf(letters[vi]) >= 0) vs[letters[vi]] = 1;
      if (Object.keys(vs).length !== 1) return false;
    }
    // The bare substring is not an answer to "a word containing art".
    if (c.has && s === c.has) return false;
    if (c.len && letters.length !== c.len) return false;
    if (c.notHas && s.indexOf(c.notHas) >= 0) return false;
    // "a contraction (like “don’t”)": the example shows the shape the answer
    // has to take, which is why tetanus and contracture were wrong there.
    if (c.apos && s.indexOf("'") < 0 && s.indexOf('’') < 0) return false;
    // Hyphenation is a shape of the raw answer: norm() drops the hyphen, so this
    // has to look at the word as written ("Spider-Man", not "spiderman").
    if (c.hyph && String(word).indexOf('-') < 0) return false;
    return true;
  }

  function split(str) {
    return typeof str === 'string' ? str.split('|') : (str || []);
  }

  // Answers the game itself has seen, as a lookup set. Used to choose between
  // two candidate lists for the same key: WordNet's taxonomy is precise but
  // sometimes academic ("world power" for superpower), the association list is
  // loose but often the answer people actually give.
  function seenSet(kb) {
    if (kb.__seen) return kb.__seen;
    var set = {};
    split(kb.voc).forEach(function (w) { var k = norm(w); if (k) set[k] = 1; });
    try { Object.defineProperty(kb, '__seen', { value: set, enumerable: false }); }
    catch (e) { kb.__seen = set; }
    return set;
  }

  function familiarity(list, set) {
    var hits = 0;
    for (var i = 0; i < list.length; i++) if (set[norm(list[i])]) hits++;
    return list.length ? hits / list.length : 0;
  }

  // Rarity of an answer: 0 Plankton, 1 Schooler, 2 Rare, 3 Deep cut, 4 One in a
  // Krillion. The pack carries the game's own tier for every answer it has ever
  // sorted; a word it never sorted is measured by where it sits in the accepted
  // vocabulary, which is ordered by how often the game accepts it.
  // Does this answer even have the right shape for the question? Live answers
  // bypass the resolver's own filters, which is how a "word containing work"
  // round got sent "Daycare worker" and "Maintenance worker".
  function shapeOk(raw, a) {
    var c = constraints(raw);
    if (!pass(a, c)) return false;
    // The lead-in ("Name an ...") is stripped first: the verb "Name" matches the
    // same regex as a category about names and silently disabled this rule.
    var t = prep(raw).replace(LEAD, '');
    var single = /\bwords?\b/.test(t) && !/\b(?:phrase|title|songs?|movies?|films?|names?)\b/.test(t);
    if (single && String(a).indexOf(' ') >= 0) return false;
    return true;
  }

  function vocIndex(kb) {
    if (kb.__vi) return kb.__vi;
    var m = {}, i = 0;
    split(kb.voc).forEach(function (w) { var k = norm(w); if (k && m[k] == null) m[k] = i; i++; });
    try { Object.defineProperty(kb, '__vi', { value: m }); } catch (e) { kb.__vi = m; }
    kb.__vn = i;
    return m;
  }

  // How obscure an answer is, counting both the answer's most common tier and
  // the deepest tier it ever reached (tiers are per prompt in this game).
  // Strict test used for answers the bot invents itself (live lookups): the word
  // must be at least Rare wherever it appears and a deep cut somewhere.
  // Has the game ever given this word a tier? rar holds its most common tier,
  // rarAny the deepest one, and a word can legitimately appear in only one.
  function hasTier(kb, k) {
    var key = typeof k === 'string' && k === norm(k) ? k : norm(k);
    return !!((kb.rar && kb.rar[key] != null) || (kb.rarAny && kb.rarAny[key] != null));
  }

  function deepStrict(kb, a) {
    return rareRank(kb, a) >= 2 && ((kb.rarAny && kb.rarAny[norm(a)]) || 0) >= 3;
  }

  function deepRank(kb, a) {
    var rr = rareRank(kb, a);
    var k = norm(a);
    var any = (kb.rarAny && kb.rarAny[k]) || 0;
    return any > rr ? any : rr;
  }

  function rareRank(kb, a) {
    var k = norm(a);
    var rar = kb && kb.rar;
    if (rar && rar[k] != null) return rar[k];
    var m = vocIndex(kb);
    var total = kb.__vn || 1;
    var pos = m[k];
    if (pos == null) return 4;              // never accepted here at all
    var q = pos / total;
    return q < 0.25 ? 0 : q < 0.5 ? 1 : q < 0.75 ? 2 : q < 0.95 ? 3 : 4;
  }

  function resolve(raw, kb, opt) {
    opt = opt || {};
    kb = kb || {};
    var c = constraints(raw);
    var keys = keysFor(raw);
    var out = [], seen = {}, bad = {}, srcOf = {}, qev = {};
    (opt.bad || []).forEach(function (b) { bad[norm(b)] = 1; });
    (opt.seen || []).forEach(function (b) { seen[norm(b)] = 1; });

    // Every answer records where it came from. Without this the bot can only
    // say that it answered "boo" to a question about size; with it the answer
    // names the lookup that produced it, which is the difference between a
    // guess about the bug and knowing it.
    var trace = opt.trace;
    // "a word containing dge" wants one word, so a two-word phrase that happens
    // to contain the letters ("Microsoft Edge", "hedge trimmer") is not an answer.
    var bare = prep(raw).replace(LEAD, '');
    // "a word that means small" wants a synonym, not an association: the pack's
    // synonym index and the live thesaurus are the only sources that know one.
    var MEANS = /\b(?:words?|terms?|phrases?)\b[^.]*\b(?:means?|synonyms?|another word for)\b/.test(norm(raw));
    var singleOnly = /\bwords?\b/.test(bare) && !/\b(?:phrase|title|songs?|movies?|films?|names?)\b/.test(bare);
    // `raw` skips the spelling constraints: a curated list is verified against
    // the rule by hand, and rules like "flag contains red and white" describe the
    // flag, not the text of the answer.
    // `ev` marks an answer as evidence for the question's qualifier: the lookup
    // that produced it knows the qualifier, not just the head noun. A word lifted
    // from the bare head-noun bucket is a guess about the qualifier, and that
    // guess is what put gar, crab and vodka in categories about medieval weapons
    // and corn.
    function take(str, src, raw, ev) {
      var parts = split(str);
      for (var i = 0; i < parts.length; i++) {
        var a = String(parts[i] || '').trim();
        if (!a) continue;
        if (singleOnly && a.indexOf(' ') >= 0) continue;
        var k = norm(a);
        if (!k || seen[k] || bad[k]) continue;
        if (!raw && !pass(a, c)) continue;
        if (out.length >= 32) return;
        seen[k] = 1;
        out.push(a);
        srcOf[k] = src || '?';
        if (ev) qev[k] = 1;
        if (trace) trace.push({ a: a, src: src || '?' });
      }
    }

    // Association lists also carry the category's own words ("domestication" for a
    // domesticated animal), so the only place they are consulted before the head
    // noun is behind a "the game has seen this word" gate.
    var VS = seenSet(kb);
    function takeFam(str, src, ev) {
      var parts = split(str), keep = [];
      for (var i = 0; i < parts.length; i++) {
        var a = String(parts[i] || '').trim();
        if (!a) continue;
        var k = norm(a);
        if (VS[k]) keep.push(a);
      }
      if (keep.length) take(keep.join('|'), src, undefined, ev);
    }

    var full = prep(raw);
    var t = full.replace(LEAD, '').replace(/\s+/g, ' ').trim();

    // 1. what this bot learnt in earlier rounds wins: it was accepted before.
    var lr = kb.lrn && (kb.lrn[full] || kb.lrn[t]);
    if (lr && lr.ok) take(lr.ok.join('|'), 'learned', undefined, 1);
    // The exact prompt, answered before by this game: its own Deep cut and
    // Krillion lists are the ground truth for this question, so they are taken
    // before every approximation - including the hand-curated lists. Win mode
    // takes them too: they are answers the room has already accepted for this
    // exact wording, which is the most likely thing to be accepted again.
    if ((opt.deep || opt.rare || opt.win) && kb.px) {
      var rawPx0 = norm(raw).replace(LEAD, '');
      var pe0 = kb.px[norm(raw)] || kb.px[rawPx0];
      if (pe0) {
        if ((opt.deep || opt.win) && pe0.k) take(pe0.k, 'prompt-krillion', undefined, 1);
        take(pe0.d, opt.deep ? 'prompt-deep' : 'prompt-rare', undefined, 1);
      }
    }
    var pxHit = out.length;
    // Rule-shaped categories ("official Disney Princess", "country ending in O",
    // "city starting with Los, Las, La or El") are not reachable from any corpus
    // lookup: the answer set is a short closed list, so it is curated here.
    // Curated lists always contribute: the exact prompt's own answers are taken
    // first and win the ordering, but when every one of them fails the deep gate
    // (a famous vitamin is a Plankton) the curated list is what still answers.
    if (kb.cur && kb.cur.length) {
      // Lower-cased: the rules match "the letter O" whatever the room's casing.
      var lbl = ' ' + norm(t) + ' ';
      for (var cu = 0; cu < kb.cur.length; cu++) {
        var rule = kb.cur[cu];
        if (!rule || !rule.list) continue;
        if (rule.has && lbl.indexOf(' ' + rule.has) < 0 && lbl.indexOf(rule.has) < 0) continue;
        if (rule.not && lbl.indexOf(rule.not) >= 0) continue;
        if (rule.re) {
          var rx;
          try { rx = new RegExp(rule.re); } catch (e) { rx = null; }
          if (rx && !rx.test(lbl)) continue;
        }
        // A colour rule may not answer a question that asks for more colours than
        // it holds: "flag-red-white" fired on "all three of red, white, and blue,
        // and no other colors" and sent nine red-white flags to a measured loss.
        if (rule.name && rule.name.indexOf('flag-') === 0) {
          var COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white', 'pink', 'brown', 'gold'];
          var asked = COLORS.filter(function (c2) { return new RegExp('\\b' + c2 + '\\b').test(lbl); });
          var holds = asked.every(function (c2) { return rule.name.indexOf(c2) >= 0; });
          if (!holds) continue;
        }
        take(rule.list, 'curated:' + rule.name, true, 1);
      }
    }
    // Every country, for spelling-rule questions such as "a country with an H
    // in its name": WordNet's bucket is a sample and left those empty.
    if (kb.cty && (c.pre || c.first || c.end || c.has || c.hasAll || c.vowels) && /\bcountr/.test(' ' + norm(t))) {
      // Rarest first: Brazil and China are Rare, Kiribati and Tuvalu are deep,
      // and the room pays for the deep one.
      var ctyList = kb.cty.split('|').filter(function (w) { return w && pass(w, c); });
      ctyList.sort(function (a, b) { return deepRank(kb, b) - deepRank(kb, a); });
      take(ctyList.join('|'), 'curated:countries', true, 1);
    }

    // 1b. the named subject wins outright: its own accepted answers beat every
    //     general list for the head noun.
    var ents = entityKeys(raw, kb);
    var entKind = baseKey(raw);
    for (var ei = 0; ei < ents.length && out.length < 8; ei++) {
      // Kind matters: places in a franchise must not answer a question about its
      // characters, so the entity list is read through the answer's head noun.
      if (entKind) {
        take(kb.ent[ents[ei] + '|' + entKind], 'entity:' + ents[ei], undefined, 1);
        if (out.length < 8) take(kb.ent[ents[ei] + '|' + singular(entKind)], 'entity:' + ents[ei], undefined, 1);
      }
    }

    // 2./3. Walk the keys from most to least specific and answer from the first
    //    one that knows something. Within a key the order is: what krillion.io
    //    itself accepted, then the WordNet taxonomy, then loose associations.
    //    Stopping at the first answering key is what keeps "country" hyponyms
    //    from leaking into "country in Africa".
    // Walk the keys, most specific first, and answer from the first one that
    // knows anything. Two phases on purpose: krillion.io's own accepted answers
    // and the WordNet taxonomy are solid evidence, while associations are a
    // guess - and a guess always exists, so consulting it first is how "rock or
    // mineral" ended up answering with druse and epigenesis instead of granite.
    // 1c. the closest real prompt. The room's own corpus carries the answers it
    //     accepts, so a label that shares a head noun and a qualifier with one of
    //     those prompts is answered from it. This is what covers the sub-domain
    //     the taxonomy cannot see: "medical instrument" is still the word
    //     "instrument" to WordNet, whose children are all musical.
    var qpHit = false;
    var bt = tidy(baseKey(raw)).split(' ').filter(Boolean);
    var hd = bt.length ? bt[bt.length - 1] : '';
    // Only the head word is excluded from the qualifier set: "writing
    // instrument" is "instrument" qualified by "writing", even though both
    // words sit inside the base phrase.
    var hset = {};
    if (hd) { hset[hd] = 1; hset[singular(hd)] = 1; }
    // Words that only state the letter/length rule are not qualifiers: "a cheese
    // containing the letter B" is still a question about cheese, and treating
    // "letter" as a qualifier sent it to the generic vocabulary (Bat, Bahamas).
    var RULEW = /^(?:letter|letters|start|starts|started|starting|begin|begins|beginning|began|end|ends|ended|ending|contain|contains|contained|containing|rhyme|rhymes|syllable|syllables|plural|singular|vowel|vowels|consonant|consonants|must|only|first|last)$/;
    // The rule's value is part of the rule, not a property of the answer: in "a
    // word ending in -tion" the word "tion" narrows the spelling, not the domain.
    var cv = {};
    [c.pre, c.end, c.has, c.first].forEach(function (x) { if (x) cv[String(x)] = 1; });
    if (c.hasAll) c.hasAll.forEach(function (x) { cv[x] = 1; });
    // Two-letter qualifiers are qualifiers: "a city in the UK" and "a state in
    // the US" were read as unqualified because contentTokens drops short words,
    // and the whole world's city list answered them.
    var qwords = prep(raw).split(' ').filter(function (w) {
      return w.length >= 2 && !STOP[w] && !hset[w] && !hset[singular(w)] && !RULEW.test(w) && !cv[w];
    });
    // The words that actually narrow the question. "type of", "kind of" and
    // "means" describe the shape of an answer, not what it has to be, so they
    // must not count as a qualifier no source could satisfy.
    var METAQ = { type: 1, types: 1, kind: 1, kinds: 1, sort: 1, sorts: 1, name: 1, names: 1, example: 1,
      examples: 1, thing: 1, things: 1, means: 1, mean: 1, meaning: 1, word: 1, words: 1, term: 1, terms: 1 };
    var realQ = qwords.filter(function (w) { return !METAQ[w]; });
    // Sources that looked up this question's qualifier, not just its head noun.
    // `corpus+`/`corpus-deep+` are the buckets keyed on head|qualifier, which the
    // old gate missed even though they are the most qualifier-aware data there is.
    var TRUSTEDQ = /^(?:learned|curated:|prompt|entity:|compound:|corpus-near|corpus-rule|corpus-[a-z]+\+)/;
    var qEvidenced = function (a) {
      var k0 = norm(a);
      return !!qev[k0] || TRUSTEDQ.test(srcOf[k0] || '');
    };
    // The very same prompt, answered before: its own Deep cut / Krillion lists
    // are the best answer this pack can give, so they go before any approximation.
    if ((opt.deep || opt.rare || opt.win) && kb.px) {
      var raw2 = norm(raw).replace(LEAD, '');
      var pentry = kb.px[norm(raw)] || kb.px[raw2];
      // The room sometimes shows a shortened form of the same prompt ("... on
      // the Billboard Hot" for "... on the Billboard Hot 100"), so a stored
      // prompt that starts with the label (or the other way round) still counts.
      if (!pentry && (raw2.length >= 8 || norm(raw).length >= 16)) {
        var pxk = Object.keys(kb.px);
        // Stored keys keep the "name a ..." lead-in, so compare both spellings.
        // A shortened label can be the prefix of several prompts, so the
        // shortest match wins: that is the plain form of the question.
        var leadForm = norm(raw), best2 = null;
        for (var pxi = 0; pxi < pxk.length; pxi++) {
          var pk2 = pxk[pxi], pk3 = pk2.replace(LEAD, '');
          // Only the stored prompt may be the longer one: a stored key that is
          // merely a prefix of the label ("name a pizza") is a different question.
          if (pk2.indexOf(leadForm) === 0 || pk3.indexOf(raw2) === 0) {
            if (!best2 || pk2.length < best2.length) best2 = pk2;
          }
        }
        if (best2) pentry = kb.px[best2];
      }
      // Borrow the deep list of a stored prompt sharing this label's content
      // words - but only when that prompt is a close match. A loose shared-word
      // match is how "character from Aladdin" got answered with merlin, lancelot
      // and Bowser, and a wrong deep cut is worse than no answer at all.
      // A prompt that is about the same head noun and shares at least one of its
      // qualifiers ("a network that has broadcast sports" -> "sports network").
      // The head has to appear, otherwise this is guesswork: that rule is what
      // kept "a city in England" from borrowing a list of unrelated cities.
      if (!pentry) {
        // A time phrase is never the head noun. "Name a Pop-Tart flavor, past or
        // present" has baseKey "pop tart flavor past", and taking its last word
        // made "past" the head - which matched the stored prompt "name an
        // american airline u s based past or present" and borrowed its answers,
        // the alphabetical airline dump (135 Airlines, AAA Air Enterprises).
        // That single word is how an unrelated list answered a Pop-Tart question.
        var TEMPORAL = {
          past: 1, present: 1, future: 1, now: 1, today: 1, yesterday: 1, ever: 1,
          time: 1, times: 1, recent: 1, recently: 1, current: 1, currently: 1,
          modern: 1, classic: 1, old: 1, newest: 1, latest: 1, anymore: 1
        };
        var hd0 = (function (k) {
          var w = String(k || '').split(' ').filter(function (x) { return x && !TEMPORAL[x]; });
          return w[w.length - 1] || '';
        })(baseKey(raw));
        var tw = contentTokens(prep(raw)).filter(function (w) {
          return w.length > 3 && !TEMPORAL[w] && !hset[w] && !hset[singular(w)] && !RULEW.test(w);
        });
        if (hd0 && tw.length) {
          var bestQ = 0, bestK = null, pkeys = Object.keys(kb.px);
          for (var bi = 0; bi < pkeys.length; bi++) {
            var pt = pkeys[bi].split(' ');
            if (pt.indexOf(hd0) < 0) continue;
            var sh = 0;
            for (var ti = 0; ti < tw.length; ti++) if (pt.indexOf(singular(tw[ti])) >= 0 || pt.indexOf(tw[ti]) >= 0) sh++;
            if (sh > bestQ || (sh === bestQ && bestK && pkeys[bi].length < bestK.length)) { bestQ = sh; bestK = pkeys[bi]; }
          }
          if (bestK && bestQ >= 1) pentry = kb.px[bestK];
        }
      }
      if (pentry) {
        if ((opt.deep || opt.win) && pentry.k) take(pentry.k, 'prompt-krillion', undefined, 1);
        take(pentry.d, opt.deep ? 'prompt-deep' : 'prompt-rare', undefined, 1);
      }
    }

    // "a word that means big or large": the answers are rare synonyms of the
    // target, so the filler head ("word") never becomes the lookup key.
    if ((opt.deep || opt.rare || opt.win) && kb.synr) {
      var mts = prep(raw).match(/\b(?:means?|meaning|synonyms?\s+(?:of|for)|another\s+word\s+for)\b\s+(.+)$/);
      if (mts) {
        var tgts = String(mts[1]).replace(/[^a-z ]+/g, ' ').split(/\s+(?:or|and)\s+/);
        for (var ti2 = 0; ti2 < tgts.length; ti2++) {
          var tw3 = contentTokens(tgts[ti2]);
          var tgt = tw3.length ? tw3[tw3.length - 1] : '';
          if (!tgt) continue;
          if (kb.synr[tgt]) take(kb.synr[tgt], 'synonym:' + tgt);
          if (kb.synr[singular(tgt)]) take(kb.synr[singular(tgt)], 'synonym:' + singular(tgt));
        }
      }
    }

    if (kb.qp && qwords.length && out.length < 3) {
      // A shared word counts for as much as it is rare. "animal that lives in
      // swamps": matching "lives" says nothing, and treating it as a match is
      // how a swamp question got answered with ant, bee and elephant. Tokens the
      // corpus never uses at all weigh the most, so a prompt can only be the
      // nearest one when it shares the words that make the question specific.
      var df = kb.__df;
      if (!df) {
        df = {};
        for (var qz = 0; qz < kb.qp.length; qz++) {
          var ws0 = kb.qp[qz][1].split(' ');
          for (var wz = 0; wz < ws0.length; wz++) df[ws0[wz]] = (df[ws0[wz]] || 0) + 1;
        }
        try { Object.defineProperty(kb, '__df', { value: df }); } catch (err) { kb.__df = df; }
      }
      var weight = function (w) { var d = df[w] || 0; return d ? 1 / Math.log(2 + d) : 2; };
      var want = 0;
      for (var wq = 0; wq < qwords.length; wq++) want += weight(qwords[wq]);
      var best = null;
      for (var qi = 0; qi < kb.qp.length; qi++) {
        var e = kb.qp[qi];
        var et = e[1].split(' ');
        var eh = e[0], last = et[et.length - 1];
        if (!hset[eh] && !hset[singular(eh)] && !hset[last] && !hset[singular(last)]) continue;
        var got = 0;
        for (var wi = 0; wi < qwords.length; wi++) if (et.indexOf(qwords[wi]) >= 0) got += weight(qwords[wi]);
        if (!got) continue;
        // At least half of what makes this question specific has to be shared.
        if (want && got < want * 0.5) continue;
        var sc = got * 10 - (et.length - got);
        if (!best || sc > best.sc) best = { sc: sc, picks: e[2] };
      }
      if (best) { var qpBefore = out.length; take(best.picks, 'corpus-near', undefined, 1); qpHit = out.length > qpBefore; }
    }

    // 1d. a compound lemma of the same head noun: "string instrument" is filed
    //     as "stringed instrument", so a qualifier that prefixes another word in
    //     such a compound selects that synset and its hyponyms (guitar, violin)
    //     instead of the head noun's first sense (musical instrument: flute).
    if (kb.hx && kb.hn && hd && qwords.length && out.length < 8) {
      var comps = kb.hx[hd] ? kb.hx[hd].split('|') : [];
      for (var ci = 0; ci < comps.length && out.length < 8; ci++) {
        var cw = comps[ci].split(' ').filter(function (x) { return x !== hd; });
        var m = 0;
        for (var cj = 0; cj < cw.length; cj++) {
          for (var wk = 0; wk < qwords.length; wk++) {
            if (cw[cj].indexOf(qwords[wk]) === 0 || qwords[wk].indexOf(cw[cj]) === 0) m++;
          }
        }
        if (m) take(kb.hn[comps[ci]], 'compound:' + comps[ci], undefined, 1);
      }
    }

    var tag = c.pre ? 'p' + c.pre : c.first ? 'f' + c.first : c.end ? 'e' + c.end : c.has ? 'c' + c.has : c.len ? 'l' + c.len : '';
    // THE rule this bot was missing: a key that drops the qualifier may not
    // outrank anything that keeps it. Every head-noun bucket in the pack
    // ("instrument", "song", "meat", "console", "word") was filled by
    // whichever prompt claimed that word, so it answers a *different* question -
    // musical instruments for a writing instrument, Frank Sinatra for Frank
    // Ocean, cuts of meat for cured meat. Those buckets are withheld and only
    // used when nothing qualifier-aware answered at all.
    var sig = qwords.slice(0, 2).join('+');
    var persony = /(?:winner|loser|player|actor|actress|singer|artist|author|writer|president|leader|founder|inventor|scientist|athlete|coach|chef|director|host|judge|king|queen|prince|princess|god|hero|villain|character|person|pilot|driver|teacher|doctor|nurse|model|dancer|musician|rapper|ceo|employee|member)$/.test(hd);
    var deferred = [];
    for (var n = 0; n < keys.length && out.length < 8; n++) {
      var key = keys[n];
      // A key that is not about the head noun is not a key: "a word that means
      // small" was being answered from WordNet's "means", and "writing
      // instrument" from WordNet's "writing".
      if (hd && key !== hd && (' ' + key + ' ').indexOf(' ' + hd + ' ') < 0) continue;
      var honours = !qwords.length || qwords.some(function (w) { return key.indexOf(w) >= 0; });
      if (!honours) { deferred.push(key); continue; }
      // A key that names the qualifier ("science fiction film", "tarot card")
      // knows the qualifier: whatever that lookup returns is an answer to *this*
      // question, not to the bare head noun. This is what separates a real
      // qualifier-aware bucket from the bare "film" list.
      var keyHasQ = realQ.length > 0;
      for (var kq = 0; kq < realQ.length; kq++) if (key.indexOf(realQ[kq]) < 0) keyHasQ = false;
      var kev = keyHasQ ? 1 : 0;
      // The corpus's own answers for exactly this category and rule ("an animal
      // starting with S") beat any generic list.
      if (kb.hl && tag) take(kb.hl[key + '|' + tag], 'corpus-rule:' + key, undefined, 1);
      // A qualified key's own list ("country in africa" -> Sudan, Kenya) beats the
      // bare head noun's bucket, which answers "country in africa" with whatever
      // its general country list happens to start with.
      // An association list for a phrase that names the qualifier (ml("medieval
      // weapon")) is about this question; the bare head noun's list is not.
      if (kb.tr && key.indexOf(' ') > 0) {
        takeFam(kb.tr[key], 'assoc:' + key, keyHasQ ? 1 : 0);
      }
      // Still fill up from this key's own solid sources: the association pass may
      // have contributed one familiar word, and stopping there was starving the
      // list. The most specific key is always read in full - a short list from
      // the nearest prompt ("card game, backgammon, stone") must not stop the
      // corpus's own answers for the same key from being used.
      var need = n === 0 ? 8 : 3;
      // The corpus bucket is keyed by head noun AND qualifier: "song" alone holds
      // one particular song question's answers, "song|frank+ocean" holds the ones
      // that belong to this one.
      // In rare-only play the corpus's deep-cut answers for this key come first:
      // they are the only source that knows which words are rare *for this
      // category* rather than rare in general.
      if (opt.deep && kb.pkK) {
        if (qwords.length && kb.pkqK) take(kb.pkqK[key + '|' + sig], 'corpus-krillion+' + key, undefined, 1);
        else if (!qwords.length) take(kb.pkK[key], 'corpus-krillion:' + key, undefined, kev);
      }
      if (opt.deep && kb.pkD) {
        if (qwords.length && kb.pkqD) {
          take(kb.pkqD[key + '|' + sig], 'corpus-deep+' + key, undefined, 1);
          if (out.length < need && qwords.length > 1) take(kb.pkqD[key + '|' + qwords[0]], 'corpus-deep+' + key, undefined, 1);
        } else if (!qwords.length) {
          take(kb.pkD[key], 'corpus-deep:' + key, undefined, kev);
        }
      }
      if (opt.rare && kb.pkR) {
        if (qwords.length && kb.pkqR) {
          take(kb.pkqR[key + '|' + sig], 'corpus-rare+' + key, undefined, 1);
          if (out.length < need && qwords.length > 1) take(kb.pkqR[key + '|' + qwords[0]], 'corpus-rare+' + key, undefined, 1);
        } else if (!qwords.length) {
          take(kb.pkR[key], 'corpus-rare:' + key, undefined, kev);
        }
      }
      if (out.length < need && kb.pk) {
        if (qwords.length && kb.pkq) {
          take(kb.pkq[key + '|' + sig], 'corpus+' + key, undefined, 1);
          if (out.length < need && qwords.length > 1) take(kb.pkq[key + '|' + qwords[0]], 'corpus+' + key, undefined, 1);
          // The qualifier-scoped bucket often does not exist for a phrase whose
          // modifier is part of its name, and the phrase's own accepted answers do:
          // pk["video game"] holds Call of Duty and Fortnite while its head "game"
          // holds bowling and archery. Without this the bot answered "name a video
          // game" with genres, because only the qualified bucket was ever read.
          // Gated on the key itself carrying the modifier, so a bare head bucket is
          // still never used for a qualifier it does not know.
          if (out.length < need && qwords.some(function (w) { return key.indexOf(w) >= 0; })) {
            take(kb.pk[key], 'corpus+' + key, undefined, kev);
          }
        } else {
          take(kb.pk[key], 'corpus:' + key, undefined, kev);
        }
      }
      // WordNet's hyponyms of "winner" are a winning idea, not a person, so a
      // person category that also carries a qualifier never answers from the
      // taxonomy - only from lists that know who actually won something.
      if (out.length < need && kb.hn && !(persony && qwords.length)) {
        var list = kb.hn[key];
        // If not one of the direct children has ever been accepted in this room,
        // the taxonomy stopped at the wrong level ("planet" -> evening star,
        // jovian planet) and the deeper list is the one holding Mercury.
        if (kb.hnw && kb.hnw[key]) {
          var kids1 = list.split('|'), anyFam = false;
          for (var kf = 0; kf < kids1.length && !anyFam; kf++) if (VS[norm(kids1[kf])]) anyFam = true;
          if (!anyFam) list = kb.hnw[key] + '|' + list;
        }
        take(list, 'wordnet:' + key, undefined, kev);
      }
      // A rule filters after the fact, and the 24-word bucket for "country" ends
      // long before Zambia. Only consulted when a rule is active, and only after
      // the normal bucket, so ordinary categories are untouched.
      if (out.length < need && tag && kb.hnw && kb.hnw[key]) take(kb.hnw[key], 'wordnet-wide:' + key, undefined, kev);
      if (out.length >= 8) break;
    }

    // The whole label's own association list is on-topic even when a short list
    // came back from elsewhere: "board game" is three words the taxonomy files
    // as "board", and ml("board game") is the only place monopoly and chess
    // live. It is merged after the solid sources, never before them.
    if (out.length < 3 && t.indexOf(' ') > 0 && kb.tr) take(kb.tr[t], 'assoc-label');
    // A label that adds nothing to its head noun can safely be answered by that
    // noun's associations (ml("pokemon") is pikachu). A qualified one cannot:
    // ml("console") is furniture, and that is exactly the junk this bot used to
    // send.
    if (out.length < 3 && !qwords.length) {
      for (var a = 0; a < keys.length && out.length < 3; a++) {
        if (kb.tr) take(kb.tr[keys[a]], 'assoc:' + keys[a]);
      }
    }

    // Graceful degradation, in order of how little it knows.
    var ruled = c.pre || c.first || c.end || c.has || c.len;
    // The game's own accepted vocabulary, filtered by the rule. It is the only
    // pool that is both on-rule and deep for letters the corpus barely covers:
    // "a word containing x" had nothing to send at all, because the plain
    // vocabulary starts with Axe/Boxing/Fox and the deep gate then threw them
    // all away.
    if (ruled && kb.rarAny && out.length < 30) {
      var raKeys = Object.keys(kb.rarAny);
      raKeys.sort(function (a, b) { return a.length - b.length; });
      for (var ri2 = 0; ri2 < raKeys.length && out.length < 30; ri2++) {
        var w3 = raKeys[ri2];
        // Clean words only: the tier index also holds product codes ("2-xl",
        // "a/ux", "5bx") that are keys, not answers.
        if (w3.length < 4 || w3.length > 16) continue;
        if (!/^[a-z][a-z '\-]*$/.test(w3)) continue;
        if (singleOnly && w3.indexOf(' ') >= 0) continue;
        if (!pass(w3, c)) continue;
        var k3 = norm(w3);
        if (!k3 || seen[k3]) continue;
        seen[k3] = 1;
        srcOf[k3] = 'vocab-tiered';
        out.push(w3);
        if (trace) trace.push({ a: w3, src: 'vocab-tiered' });
      }
    }
    if (out.length < 3 && c.end && kb.suf) take(kb.suf[c.end], 'suffix:' + c.end);
    // In deep/rare play the vocabulary must be read from its rare end: the plain
    // list starts with Axe, Boxing, Fox and fills the 60 slots with words the
    // deep gate then throws away, which left "a word containing x" unanswered.
    if (out.length < 3 && ruled && kb.voc && !(opt.deep || opt.rare)) take(kb.voc, 'vocab-fallback');
    // Last resort: the bare head noun, which at least stays in the right family
    // even though it ignores the qualifier.
    for (var dn = 0; dn < deferred.length && out.length < 3; dn++) {
      if (kb.hn) take(kb.hn[deferred[dn]], 'wordnet-last:' + deferred[dn]);
      if (kb.pk) take(kb.pk[deferred[dn]], 'corpus-last:' + deferred[dn]);
    }
    // The generic reserve (Pizza, Towel, Charger) answers nothing: it is what the
    // bot sends when it has no idea, and the room scores it as a Plankton. It is
    // kept only for callers that explicitly allow it.
    if (!out.length && kb.gen && !opt.noGeneric) take(kb.gen, 'generic-fallback');

    // A letter/ending rule plus rare-only play is answered from the tail of the
    // accepted vocabulary: those are the words the room has taken before that
    // nobody thinks of first (waxwork, patchwork, clockwork), which is exactly
    // what a deep cut is.
    if ((opt.rare || opt.deep) && ruled && kb.voc && out.length < 60) {
      var vs2 = split(kb.voc);
      for (var vi = vs2.length - 1; vi >= 0 && out.length < 60; vi--) {
        var w2 = String(vs2[vi] || '').trim();
        if (!w2 || !pass(w2, c)) continue;
        if (singleOnly && w2.indexOf(' ') >= 0) continue;
        var k2 = norm(w2);
        if (!k2 || seen[k2]) continue;
        seen[k2] = 1;
        out.push(w2);
        if (trace) trace.push({ a: w2, src: 'vocab-rare' });
      }
    }

    // Rare-only mode: nothing below Rare is sent at all, and what is sent goes
    // rarest first. This is a deliberate handicap - it is how the bot plays when
    // it has to look like it knows the deep cuts or lose trying.
    // Win mode is the opposite bet: a round is won by landing the most accepted
    // answers and outlasting the fuse, and rarity only ever buys an extra life,
    // so there is no rarity floor at all - the plain answer that the room is most
    // likely to take goes first.
    if (opt.rare || opt.deep || opt.win) {
      // deep mode is tier 3+ only (Deep cut / One in a Krillion); rare mode stops
      // at tier 2. Nothing below the floor is ever offered in deep mode unless
      // the list would otherwise be empty, and then at most a couple of answers
      // so the turn is not simply thrown away.
      //
      // Rarity is per prompt in this game, so an answer taken from a prompt's own
      // Deep cut / Krillion list counts as deep even if some other prompt files
      // the same word as common. That is what rarAny records.
      var floor = opt.deep ? 3 : opt.rare ? 2 : 0;
      var deepScore = function (a) {
        var k2 = norm(a), s = srcOf[k2] || '';
        if (s.indexOf('corpus-krillion') === 0 || s.indexOf('prompt-krillion') === 0) return 5;
        if (s.indexOf('corpus-deep') === 0 || s.indexOf('prompt-deep') === 0) return 4;
        // A hand-verified list is an answer by construction, so it is never
        // outranked by an untiered guess from the corpus.
        if (s.indexOf('curated:') === 0) return 4;
        var any = (kb.rarAny && kb.rarAny[k2]) || 0;
        var rr = rareRank(kb, a);
        return any > rr ? any : rr;
      };
      // In deep mode only the game's own deep/krillion lists - or a word that is
      // never common anywhere and is a deep cut somewhere - may be sent. The
      // heuristic sources (vocabulary fallback, WordNet leftovers, associations)
      // are guesses about rarity, and guesses are exactly what shows up in the
      // room as Plankton. They stay behind as a last resort only.
      var deepOK = function (a) {
        var k2 = norm(a), s = srcOf[k2] || '';
        var rr1 = rareRank(kb, a);
        // Being on some prompt's deep list is not enough: a famous film is a
        // deep cut for one odd question and Plankton for the next, and the room
        // shows whichever it feels like. A deep answer is never common anywhere.
        if (/^synonym:/.test(s)) return true;   // already filtered to rare lemmas
        if (/^(prompt|corpus)-(deep|krillion)/.test(s)) return rr1 >= 2;
        // Entity and compound lookups return the famous thing whatever it is: a
        // Spotify hit, "hour" for a unit of time. The pack has never seen those
        // words in a room, and an untiered word is not an obscure one - the room
        // scored Not Like Us, hour and month as Plankton. No tier data, no send.
        if (/^(entity|compound)(:|$)/.test(s)) return hasTier(kb, k2);
        // Hand-written lists for rule-shaped categories are answers by
        // construction, not rarity guesses.
        if (/^curated:/.test(s)) return true;
        // Already deep-tiered by construction: these are keys of the tier index.
        if (/^vocab-tiered/.test(s)) return true;
        var rr2 = rareRank(kb, a);
        var any2 = (kb.rarAny && kb.rarAny[k2]) || 0;
        // The tail of the accepted vocabulary is fair game ("bedraggled" for a
        // word starting with bed), but its common end is not.
        // WordNet's leftovers are a junk factory ("cul", "dint" when asked how
        // to sign off an email), and the generic list is what everyone types.
        if (/^(wordnet-last|generic|suffix)/.test(s)) return false;
        if (MEANS && !/^(synonym:|curated:)/.test(s)) return false;
        // Everything else has to be a word the game has actually tiered. The
        // vocabulary tail and the loose association lists are guesses about
        // rarity, and a guess with no tier behind it is what the room scores as
        // a Plankton ("here" for a soup, "Not Like Us" for a rap song).
        if (!hasTier(kb, k2)) return false;
        // What is left is real: the rare end of the accepted vocabulary.
        return rr2 >= 3;
      };
      // The junk sources do not even get to be the reserve in deep mode: "hub",
      // "key" and "rus" were being sent for a country question once the deep
      // list ran out, and a wrong answer burns the turn just as fast.
      // What the strict filter throws away is kept aside rather than discarded:
      // the emergency answer at the bottom of this block may still need one of
      // them, and a category with a real (if obvious) answer is not a category
      // to sit out.
      var dropped = [];
      if (opt.deep || opt.win) {
        var kept = [];
        for (var di = 0; di < out.length; di++) {
          var sdi = srcOf[norm(out[di])] || '';
          if (/^(wordnet-last|generic|suffix)/.test(sdi)) {
            // A country question is answered from the country list: WordNet's
            // leftover "cuba" for a nuclear-power question is a guess, not a list.
            if (!/\bcountr(?:y|ies)\b/.test(norm(t))) dropped.push(out[di]);
            continue;
          }
          kept.push(out[di]);
        }
        out = kept;
      }
    // A constrained question ("country whose name starts with P", "a word with
    // two syllables") is still about its head noun's domain, and the loose
    // vocabulary scan does not know that: it answered with Phebe Novakovic and
    // "Inverted full-back". Keep only the taxonomy's own members for such
    // labels, never the verified sources.
    // "Name a country that has nuclear weapons" has no spelling rule, yet it is
    // still a country question: WordNet's loose last-resort answered cuba and
    // aquaplane for those.
    var isCtry = /\bcountr(?:y|ies)\b/.test(norm(t));
    if ((c.pre || c.first || c.end || c.has || c.len || isCtry) && kb.hn) {
      var domKey = null;
      var domCands = isCtry ? ['country', baseKey(raw), hd] : [baseKey(raw), hd];
      // "word", "term" and "name" are meta-nouns: their taxonomy is a list of
      // grammar terms, so restricting to it would empty a vocabulary question.
      var META = { word: 1, words: 1, term: 1, terms: 1, name: 1, names: 1, thing: 1, things: 1 };
      for (var dk = 0; dk < domCands.length && !domKey; dk++) {
        if (!domCands[dk] || META[domCands[dk]]) continue;
        if (kb.hn[domCands[dk]] || (domCands[dk] === 'country' && kb.cty)) domKey = domCands[dk];
      }
      if (domKey) {
        var domSet = {};
        var domList = String((kb.hnw && kb.hnw[domKey]) || '').split('|')
          .concat(String(kb.hn[domKey] || '').split('|'));
        // WordNet's country bucket is a short sample; the real list is the one
        // used to answer letter-rule questions like "a country with an H".
        if (domKey === 'country' && kb.cty) domList = domList.concat(kb.cty.split('|'));
        domList.forEach(function (w) { var kk = norm(w); if (kk) domSet[kk] = 1; });
        out = out.filter(function (a) {
          var sa = srcOf[norm(a)] || '';
          if (/^(curated:|prompt-|corpus-)/.test(sa)) return true;
          return !!domSet[norm(a)];
        });
      }
    }
    // A labled named subject ("movie starring Harrison Ford") is answered by
    // that subject's bucket or not at all: the label's association list gave
    // braveheart for two different actors.
    var hasEnt = out.some(function (a) { return /^entity:/.test(srcOf[norm(a)] || ''); });
    if (hasEnt) out = out.filter(function (a) { return !/^assoc/.test(srcOf[norm(a)] || ''); });

      var keep = [], rest = [];
      for (var rk = 0; rk < out.length; rk++) {
        var good = opt.deep ? deepOK(out[rk]) : deepScore(out[rk]) >= floor;
        (good ? keep : rest).push(out[rk]);
      }
      // They must not come back through the emergency answer either: deepScore
      // treats an unknown word as tier 4, and that guess is what put a Plankton
      // in the room in the first place.
      if (opt.deep) {
        rest = rest.filter(function (a) {
          if (!/^(entity|compound)(:|$)/.test(srcOf[norm(a)] || '')) return true;
          return hasTier(kb, norm(a));
        });
      }
      // A curated list is verified for its rule, so it leads: the corpus guesses
      // that used to sit in front of it ("Belt-drive bicycle" for a country) are
      // still there as backup, just later.
      // Plain rarity order: the exact prompt's own answers were inserted first
      // and stay first on a tie, while a curated list only leads where the pack
      // had nothing deep for the question.
      keep.sort(function (a, b) { return deepScore(b) - deepScore(a); });
      // Deep mode answers deep or not at all - except that a completely empty
      // turn is worse than one honest long shot: a single best-ranked answer
      // keeps the round moving when the pack genuinely has nothing deep.
      // window.__krFallback = false turns it off.
      if (!keep.length) {
        if (opt.deep) {
          // A "means X" question has no emergency answer: the only honest long
          // shot is a synonym, and the live lookup supplies those. Sending an
          // association ("head" for a word meaning big) is a wasted turn.
          if (opt.fallback !== false && !MEANS) {
            rest.sort(function (a, b) { return deepScore(b) - deepScore(a); });
            var cand = null;
            // 1. best surviving candidate that is at least Schooler-tier
            for (var fi = 0; fi < rest.length && !cand; fi++) if (deepScore(rest[fi]) >= 1) cand = rest[fi];
            // 2. anything the corpus/entity/association lookups produced, even if
            //    the rarity test disliked it - a real, if boring, answer
            if (!cand && dropped.length) {
              // Preference inside the emergency pool: the game's own deep lists
              // first, then prompt buckets, corpus buckets, entities/associations,
              // and WordNet leftovers only when they are all there is.
              var srcRank = function (a) {
                var s = srcOf[norm(a)] || '';
                if (/^(prompt|corpus)-(deep|krillion)/.test(s)) return 5;
                if (/^prompt-/.test(s)) return 4;
                if (/^corpus/.test(s)) return 3;
                if (/^(entity|assoc|learned|vocab)/.test(s)) return 2;
                if (/^wordnet/.test(s)) return 1;
                return 0;
              };
              // Words the room has actually accepted before beat invented ones:
              // the emergency answer should look like an answer, not like a typo.
              var VSD = seenSet(kb);
              dropped.sort(function (a, b) {
                var va = VSD[norm(a)] ? 1 : 0, vb = VSD[norm(b)] ? 1 : 0;
                if (va !== vb) return vb - va;
                var d = srcRank(b) - srcRank(a);
                return d || deepScore(b) - deepScore(a);
              });
              cand = dropped[0];
            }
            // 3. last resort: the best surviving candidate whatever its tier
            if (!cand && rest.length) cand = rest[0];
            // The emergency answer has to be tied to the question. "gas station
            // chain" went out with Pizza, "a word that means delicious" with
            // Coffee and a board game with Monopoly: an unrelated famous word is
            // an obviously wrong answer, and nothing at all is better than that.
            var tset = {}, tany = false;
            if (kb.tr) {
              var tkeys = [hd, baseKey(raw)];
              for (var tk2 = 0; tk2 < tkeys.length; tk2++) {
                var tl = tkeys[tk2] && kb.tr[tkeys[tk2]];
                if (!tl) continue;
                String(tl).split('|').forEach(function (w) { var kk = norm(w); if (kk) { tset[kk] = 1; tany = true; } });
              }
            }
            // A taxonomy child is NOT good enough on its own: "why" is a kind of
            // reason and "documentary" is a kind of film, and both are wrong
            // answers to the questions that produced them.
            var kidSet = {};
            // The emergency answer obeys the example's shape too: an
            // apostrophe-free word is not an answer to the contraction question.
            if (cand && !pass(cand, c)) cand = null;
            if (cand) {
              var tiedSrc = /^(assoc|entity|compound|curated|prompt|corpus|synonym)/.test(srcOf[norm(cand)] || '');
              if (!tiedSrc && !kidSet[norm(cand)] && !(tany && tset[norm(cand)])) {
                var pool = rest.concat(dropped);
                var swap = null;
                for (var pi = 0; pi < pool.length; pi++) {
                  var ps = srcOf[norm(pool[pi])] || '';
                  if ((tset[norm(pool[pi])] || kidSet[norm(pool[pi])] || /^(assoc|entity|compound|curated|prompt|corpus|synonym)/.test(ps)) && deepScore(pool[pi]) >= 1) { swap = pool[pi]; break; }
                }
                // Nothing tied to the head noun: send nothing rather than a word
                // that obviously does not belong to the category.
                cand = swap;
              }
            }
            // A country question never goes unanswered: the country list itself
            // is a valid pool when every lookup came back empty.
            if (!cand && /\bcountr(?:y|ies)\b/.test(norm(t)) && kb.cty) {
              var cl = kb.cty.split('|').filter(Boolean);
              cl.sort(function (a, b) { return deepRank(kb, b) - deepRank(kb, a); });
              cand = cl[0];
            }
            if (cand) {
              keep = [cand];
              var fk = norm(cand);
              srcOf[fk] = 'fallback:' + (srcOf[fk] || '');
              if (trace) trace.push({ a: cand, src: 'fallback' });
            }
          }
        } else {
          rest.sort(function (a, b) { return deepScore(b) - deepScore(a); });
          keep = rest.slice(0, 3);
        }
      } else if (!opt.deep && keep.length < 2) {
        rest.sort(function (a, b) { return deepScore(b) - deepScore(a); });
        keep = keep.concat(rest);
      }
      if (opt.win) {
        // Win mode gathers in two passes. This call got the exact prompt's own
        // answers - the words the room already took for this wording - but the
        // pack fills those lists with the rare end of the category, and a
        // volume game wants "China" and "Cheddar" first. So a plain resolve is
        // run as well for the ordinary buckets, and the union is ordered by how
        // common each word is in this room's own accepted vocabulary: the likely
        // answer leads, the rare tail follows, and loose entity/association
        // guesses sit behind real answers for the label. Rarity is not the goal
        // here - it only ever buys an extra life.
        var btr = [];
        var baseOut = resolve(raw, kb, { fallback: opt.fallback, trace: btr });
        for (var bt = 0; bt < btr.length; bt++) {
          var bk2 = norm(btr[bt].a);
          if (srcOf[bk2] == null) {
            srcOf[bk2] = btr[bt].src || '';
            if (trace) trace.push({ a: btr[bt].a, src: btr[bt].src || '?' });
          }
        }
        // The plain list leads on ties: when neither word has a frequency, the
        // one from the ordinary buckets is the safer answer than the rare end of
        // a prompt list.
        var wJoined = [], wAdded = {};
        var wPush = function (list) {
          for (var wi3 = 0; wi3 < list.length; wi3++) {
            var wk3 = norm(list[wi3]);
            if (!wk3 || wAdded[wk3]) continue;
            wAdded[wk3] = 1;
            wJoined.push(list[wi3]);
          }
        };
        wPush(baseOut);
        wPush(keep);
        wPush(rest);
        var wAt2 = {};
        for (var wa2 = 0; wa2 < wJoined.length; wa2++) if (wAt2[norm(wJoined[wa2])] == null) wAt2[norm(wJoined[wa2])] = wa2;
        var wTrust2 = function (a) {
          var s = srcOf[norm(a)] || '';
          // A list that was looked up for this very label (its own prompt, its
          // curated set, its corpus bucket, the entity list for its qualifier)
          // is a real answer to the question. Loose associations, WordNet
          // leftovers and vocabulary tails are guesses, whatever their rarity.
          if (/^(learned|curated|prompt|corpus|entity|compound)/.test(s)) return 0;
          if (/^synonym/.test(s)) return 1;
          return 2;
        };
        var wMap2 = vocIndex(kb), wTot2 = kb.__vn || 1;
        var wCommon2 = function (a) {
          var pos = wMap2[norm(a)];
          // Not in the accepted vocabulary at all is not evidence of rarity: the
          // obvious answer is often simply untiered (China). It scores mid-list
          // rather than last, where it let Bahrain beat China.
          return pos == null ? 0.5 : pos / wTot2;
        };
        // The ordinary list keeps its own order: it is already "the answers a
        // person says first" (Chess, Battleship, Checkers for a board game; China,
        // India, Japan for an Asian country). Only the extra supply behind it is
        // re-ordered - trusted sources first, commonest first - because that is
        // where the rare prompt words would otherwise shove their way forward.
        var wTail3 = wJoined.slice(baseOut.length);
        wTail3.sort(function (a, b) {
          var ca = wTrust2(a), cb = wTrust2(b);
          if (ca !== cb) return ca - cb;
          var qa = wCommon2(a), qb = wCommon2(b);
          if (qa !== qb) return qa - qb;
          return (wAt2[norm(a)] || 0) - (wAt2[norm(b)] || 0);
        });
        out = wJoined.slice(0, baseOut.length).concat(wTail3).slice(0, 60);
      } else {
        out = keep;
      }
    }

    // ---- type gate -------------------------------------------------------
    // A qualified question ("a country whose capital is on a river") asks for
    // *members* of the head noun. WordNet's bucket for a word mixes its members
    // with its synonyms: "hub", "key", "nest" and "ally" sit in the same list
    // as Chad, Cuba and Fiji. A synonym of the subject is never an answer, and
    // sending one burned real turns. So the two sources that are pure guesswork
    // - the bare head-noun fallback, and the raw vocabulary / suffix / generic
    // pools - are kept only when this pack knows the word as a member of the
    // head noun's family. It is data-driven: no category is named here.
    // A spelling/rhyme/shape rule is different: the answer is filtered by its
    // letters, so a vocabulary word that passes the rule IS the answer, and the
    // gate would empty the category.
    var shapeRule = c.pre || c.first || c.end || c.has || c.hasAll || c.len || c.vowels || c.apos || c.hyph;
    if (out.length && !shapeRule) {
      var fam = {};
      var famAdd = function (s) {
        String(s || '').split('|').forEach(function (w) { var k0 = norm(w); if (k0) fam[k0] = 1; });
      };
      if (/^countr(?:y|ies)$/.test(hd) && kb.cty) famAdd(kb.cty);
      if (kb.pk && hd) famAdd(kb.pk[hd]);
      if (kb.pkq && hd) {
        var pks = Object.keys(kb.pkq);
        for (var pki = 0; pki < pks.length; pki++) {
          if (pks[pki].indexOf(hd + '|') === 0) famAdd(kb.pkq[pks[pki]]);
        }
      }
      out = out.filter(function (a) {
        var s0 = srcOf[norm(a)] || '';
        if (/^wordnet-last/.test(s0)) return !!fam[norm(a)];
        if (/^(vocab|suffix|generic)/.test(s0)) return !!fam[norm(a)];
        return true;
      });
    }

    // ---- qualifier gate ---------------------------------------------------
    // "a city in Florida" is not "any city", and "a food made from corn" is not
    // a drink: the bare head noun's bucket answers a different question. Each
    // answer is judged on its own provenance - the ones whose lookup knew the
    // qualifier stay, the ones lifted from the bare bucket go. Per answer, not
    // per question, because a single qualified hit used to keep the whole list
    // (that is how "grape" arrived with Popcorn), and requiring a hit used to
    // wipe lists the qualifier-scoped corpus buckets had already answered
    // correctly ("corpus+city" was not recognised as qualifier-aware).
    // `softQual` keeps the unverified answers as a reserve behind the verified
    // ones instead of deleting them. The bot asks for it: a rejection in this
    // game costs one retry while an empty turn lets the puffer pop on us, so
    // leading with qualified answers and falling back late beats going silent.
    if (realQ.length && out.length) {
      var evd = out.filter(qEvidenced);
      // A number is a condition no bucket can check: "more than 20 million
      // people", "land above 5,000 metres", "nine All-Star Games". Every guess
      // there is wrong (togo for a 20-million question), so those categories get
      // the verified answers only.
      var numeric = /\d/.test(String(raw)) &&
        /\b(?:more|less|fewer|over|under|above|below|at least|at most|between|longer|shorter|taller|higher|lower|bigger|larger|smaller|than)\b/.test(norm(raw));
      if (opt.softQual && !numeric) {
        var restQ = out.filter(function (a) { return !qEvidenced(a); });
        out = evd.concat(restQ);
      } else {
        // Dropping the reserve must never leave the bot with nothing to send:
        // an empty turn loses a life on its own, which is worse than a guess. In
        // win mode (softQual) the numeric case keeps a reserve only when no
        // verified answer exists. Strict callers still get the clean list.
        out = (opt.softQual && !evd.length) ? out : evd;
      }
    }

    return out;
  }

  return {
    norm: norm,
    deaccent: deaccent,
    keysFor: keysFor,
    baseKey: baseKey,
    constraints: constraints,
    singular: singular,
    pass: pass,
    shapeOk: shapeOk,
    rareRank: rareRank,
    deepRank: deepRank,
    hasTier: hasTier,
    deepStrict: deepStrict,
    resolve: resolve
  };
})();


/*
 * In-page half of the Puffer Party bot.
 *
 * The resolver above decides *what* to answer from the frozen knowledge pack;
 * this part is only timing and DOM: watch for the puffer, pre-type the answer in
 * the same frame the category appears, send the instant the button enables, and
 * rotate through the candidate list when the room says "no echo".
 *
 * It also learns. Every accepted answer and every rejection is kept in
 * localStorage per category, so a category only ever needs to be worked out
 * once - no hand-written rule, no redeploy of the knowledge pack.
 *
 * Boot: push the base64 chunks into window.__KRP, then call __krLoad().
 */
(function () {
  'use strict';

  var LS = 'krill.party.v3';
  // Default is win mode. A round is won by landing the most accepted answers and
  // surviving the fuse; a rarer answer only ever buys an extra life, it is not
  // how the round is won. So the commonest answer the room is likely to take
  // goes first and the rare lists are just extra supply behind it.
  // Set window.__krRare = true (plus __krMinRank) for the rare-only game.
  var RARE = window.__krRare === true;
  // 3 = Deep cut and deeper only, 4 = One in a Krillion only, 2 = Rare and up,
  // 0 = win mode (no rarity floor at all).
  var MINRANK = typeof window.__krMinRank === 'number' ? window.__krMinRank : 0;
  var KB = null;
  // Re-injecting the bot leaves the previous copy's interval and observer alive,
  // and several copies clicking at once floods the room. Only the newest copy
  // may act; the rest go inert the moment a new one loads.
  var ID = Date.now() + '-' + Math.random().toString(36).slice(2);
  window.__krOwner = ID;
  (window.__krObs || []).forEach(function (o) { try { o.disconnect(); } catch (e) {} });
  (window.__krTimers || []).forEach(function (t) { clearInterval(t); });
  (window.__krWorkers || []).forEach(function (w) { try { w.terminate(); } catch (e) {} });
  window.__krObs = [];
  window.__krTimers = [];
  window.__krWorkers = [];
  var BOT = {
    on: false, cat: '', lastKey: '', picks: [], idx: 0, current: '',
    sentAt: 0, sent: 0, rejected: 0, out: false, clickedAt: 0,
    turnSent: {}, sentThisTurn: 0, genUsed: false, cool: 0, turnStart: 0, logs: 0
  };
  // Fake-room hook: the pick order and the answers already spent are exactly what
  // a "did it re-send a used answer" test has to look at, and neither is visible
  // from the DOM. Read-only.
  try {
    Object.defineProperty(window, '__krState', {
      value: function () {
        return {
          cat: BOT.cat, idx: BOT.idx, unk: !!BOT.unknown, n: BOT.picks.length,
          picks: BOT.picks.slice(0, 24), sent: Object.keys(BOT.gameSent || {})
        };
      }
    });
  } catch (e) {}

  // The room keeps the last "no echo" line on screen for a while, so the whole
  // page text is not evidence that *this* answer was refused. Only the message
  // naming the answer we just sent counts.
  function refused(text, answer) {
    if (!answer) return false;
    var q = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('["\u201c]' + q + '["\u201d]\\s*:\\s*no echo', 'i').test(text);
  }

  function log(entry) {
    var l = (window.__kr = window.__kr || []);
    entry.ms = Date.now();
    l.push(entry);
    if (l.length > 300) l.shift();
  }

  function loadLrn() {
    try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; }
  }
  function saveLrn(d) {
    try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) { /* private mode */ }
  }
  // Learn by the category's head-noun key, not its literal wording: the room
  // appends a fuse count and rephrases the same category between rounds.
  function learnKey(cat) {
    return (KR.keysFor(cat)[0] || KR.norm(cat) || '').trim();
  }

  function learn(kind, cat, answer) {
    if (!cat || !answer) return;
    var d = loadLrn();
    var key = learnKey(cat);
    var e = d[key] || (d[key] = { ok: [], bad: [] });
    var list = e[kind] || (e[kind] = []);
    if (list.indexOf(answer) < 0) list.push(answer);
    saveLrn(d);
    if (KB) KB.lrn = d;
  }

  function pageText() {
    return (document.body && document.body.innerText || '').replace(/\s+/g, ' ');
  }

  // The room renders two "CATEGORY n" blocks - a header carrying "FLOATING 10/10"
  // and the clue itself - so taking the last one blindly fed the header in as a
  // category, which re-resolved mid-turn and threw away the right picks. Each
  // block is now cut at the diamond before the clue, noise is stripped, and the
  // longest surviving clue wins.
  // Labels nest: the header block reads "CATEGORY 4 New category CATEGORY 4 NEW
  // <clue>", so leading noise is stripped repeatedly until nothing changes.
  var NOISE = /^(?:CATEGORY\s+\d+|CATEGORY|NEW|New category|category|FLOATING\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+)\s*/i;
  function stripNoise(s) {
    s = s.replace(/\s+/g, ' ').trim();
    var prev;
    do { prev = s; s = s.replace(NOISE, '').trim(); } while (s !== prev);
    return s
      .replace(/\bFLOATING\s+\d+\s*\/\s*\d+\b/gi, ' ')
      .replace(/\bSEND\b[\s\S]*$/, ' ')
      .replace(/\s+\d+\+?\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function category(text) {
    // The clue is its own element. Reading it from the flattened page text works
    // on most layouts, but on some ("CATEGORY 34" beside the clue, counters in
    // between) the parse returned '' and the bot played a whole round with no
    // category at all - that is the silent turn that looked like "it just does
    // not answer". The element is authoritative when it is present.
    var el = document.querySelector('.prompt, [class*="pf-prompt"], [class*="ds-prompt-text"], [class*="Prompt"]');
    if (el) {
      var raw = String(el.innerText || '').replace(/\s+/g, ' ').trim();
      if (raw.length > 3 && raw.length < 160 && /[a-z]/i.test(raw) && !/\bCATEGORY\b/i.test(raw)) return raw;
    }
    var re = /CATEGORY\s+\d+/g, m, best = '';
    while ((m = re.exec(text))) {
      var rest = text.slice(m.index + m[0].length);
      var cut = rest.indexOf('\u25b8');
      if (cut < 0) continue;                       // not a clue block
      var s = stripNoise(rest.slice(0, cut));
      if (s.length > best.length && /[a-z]/i.test(s)) best = s;
    }
    return best.slice(0, 160);
  }

  function input() {
    var el = document.querySelector('input.ds-input');
    if (el) return el;
    var all = document.querySelectorAll('input');
    for (var i = 0; i < all.length; i++) {
      if (all[i].getClientRects().length && all[i].placeholder !== 'what the ring calls you') return all[i];
    }
    return null;
  }

  function sendBtn() {
    return document.querySelector('button.ds-dive-btn') ||
      [].filter.call(document.querySelectorAll('button'), function (b) { return /SEND/i.test(b.innerText || ''); })[0] || null;
  }

  // Submitting without a button: the room's form also accepts Enter, and a
  // missing SEND button must never be the reason a ready answer stays unsent.
  // A better list arriving while a pack guess is already sitting in the box must
  // take the box over: "paint" was typed at t=10ms and sent at t=1.4s while the
  // fetched list (Red, Blue, Pink) was already at the front of the queue.
  function resetTyped() {
    BOT.current = '';
    BOT.idx = 0;
    BOT.armedAt = 0;
    var e = input();
    if (e && e.value) setValue(e, '');
  }

  function pressEnter(el) {
    try { el.focus(); } catch (e) {}
    ['keydown', 'keypress', 'keyup'].forEach(function (t) {
      var ev;
      try {
        ev = new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
      } catch (e) { return; }
      el.dispatchEvent(ev);
    });
    var form = el.form;
    if (form && form.requestSubmit) { try { form.requestSubmit(); } catch (e) {} }
  }

  function setValue(el, v) {
    var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    try { el.focus(); } catch (e) {}
  }

  // The frozen pack cannot know every phrasing the room will use. The local pack
  // server can reach Datamuse, so a category the pack has never seen gets looked
  // up there in parallel: the local answers go out at once, and the live ones
  // slot in ahead of whatever is left in the queue.
  var LIVE = 'http://127.0.0.1:5201/resolve?q=';
  function liveLookup(cat) {
    if (!window.fetch) return;
    BOT.livePending = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 2500);
    fetch(LIVE + encodeURIComponent(cat), ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        BOT.livePending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {};
        (lr.bad || []).forEach(function (b) { bad[KR.norm(b)] = 1; });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || BOT.turnSent[k] || BOT.picks.indexOf(a) >= 0) continue;
          add.push(a);
        }
        // Live words are guesses; words the room has accepted before are not.
        // When there are enough of those, the unknowns stay behind them.
        var vs = KB.__vocs;
        if (!vs) {
          vs = {};
          (KB.voc || '').split('|').forEach(function (w) { var k = KR.norm(w); if (k) vs[k] = 1; });
          try { Object.defineProperty(KB, '__vocs', { value: vs }); } catch (e) { KB.__vocs = vs; }
        }
        var known = add.filter(function (a) { return vs[KR.norm(a)]; });
        if (known.length >= 2) add = known;
        // Live guesses are still answers: they must fit the question's shape
        // (a "word" is one word, "containing work" must contain work) and, in
        // rare-only play, clear the same rarity bar as everything else.
        add = add.filter(function (a) { return KR.shapeOk(cat, a); });
        // A thesaurus synonym ("gargantuan" for big) is on-target by
        // construction, and the obscure ones are exactly the deep cuts, so a
        // "means" question may use live words the pack has never tiered.
        var MEANS = /\b(?:words?|terms?|phrases?)\b[^.]*\b(?:means?|synonyms?|another word for)\b/.test(KR.norm(cat));
        // A rhyme is correct by construction: "flat" and "brat" rhyme with cat
        // however common they are, so the rarity bar must not throw them away.
        var RHYME = /rhymes?\s+with\b/.test(KR.norm(cat));
        if (RARE) add = add.filter(function (a) {
          if (RHYME) return true;
          if (MINRANK >= 3) return MEANS ? KR.deepRank(KB, a) >= 3 : KR.deepStrict(KB, a);
          return KR.deepRank(KB, a) >= MINRANK;
        });
        if (!add.length) return;
        // Live answers only lead when the pack had nothing qualifier-aware for
        // this category. When the pack does know the answer ("copy, cut, paste"
        // for a keyboard shortcut), live guesses queue behind it instead of
        // pushing it down - that is how "bear, bit" got sent first.
        // A spelling-rule category is the exception: the pack's list for "a word
        // containing age" held "agew" and "ageo", which the room rejected on
        // sight, while Datamuse only returns real words. There the dictionary is
        // the better first answer, so live words lead.
        var at = (BOT.weak || BOT.wordy) ? Math.min(BOT.idx, BOT.picks.length) : BOT.picks.length;
        var spl = splitUsed(add.slice(0, 8));
        BOT.picks.splice.apply(BOT.picks, [at, 0].concat(spl.un));
        // Live words this game has already spent do not lead the hand either.
        if (spl.us.length) BOT.picks = BOT.picks.concat(spl.us);
        BOT.liveGot = true;
        BOT.weak = false;
        log({ live: add.slice(0, 4), at: at });
      })
      .catch(function (e) { clearTimeout(timer); BOT.livePending = false; log({ liveErr: String(e && e.message || e) }); });
  }

  // The general route for a category the frozen pack has never seen. "A <family>
  // that <property>" is a list article on Wikipedia - "List of countries
  // bordering on two or more oceans" - and the pack server only trusts a page
  // whose title is about this property and whose items belong to the family. So
  // these words are verified for this wording, not guessed from the head noun,
  // and they lead the queue. Nothing is cached here: the server caches, so a
  // repeat is instant.
  var ASK = 'http://127.0.0.1:5201/ask?q=';
  function askLookup(cat) {
    if (!window.fetch) return;
    BOT.askPending = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 7000);
    fetch(ASK + encodeURIComponent(cat), ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        BOT.askPending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        // A fetched /know list beats this one for a category the pack cannot
        // answer: it was chosen by the racing endpoint, not by a list heuristic.
        if (BOT.unknown && (BOT.knowGot || BOT.knowPending)) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {};
        (lr.bad || []).forEach(function (b) { bad[KR.norm(b)] = 1; });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || BOT.turnSent[k] || BOT.picks.indexOf(a) >= 0) continue;
          if (banned(a) || !KR.shapeOk(cat, a)) continue;
          add.push(a);
        }
        if (!add.length) return;
        // Same ordering as the pack tiers: unused verified answers lead, spent
        // ones queue at the back instead of being re-sent and rejected.
        var spa = splitUsed(add);
        BOT.picks = spa.un.concat(BOT.picks, spa.us);
        resetTyped();
        // Start again from the verified answers: they are the ones that pass the
        // puffer, and turnSent keeps the ones already used from repeating.
        BOT.idx = 0;
        BOT.askGot = true;
        BOT.askCount = add.length;
        log({ ask: add.slice(0, 4), src: j.src, conf: j.conf });
      })
      .catch(function (e) { clearTimeout(timer); BOT.askPending = false; log({ askErr: String(e && e.message || e) }); });
  }

  // "Something you would take", "a thing you might find in": the answer is an
  // association or a choice, not an instance from a list article.
  function assocShape(c) {
    return /\b(?:something|anything|things?)\b|\bwould (?:you )?(?:take|bring|find|see|hear|say)\b|\bmight (?:find|see|hear)\b/i.test(String(c || ''));
  }

  // Unknown-category mode. When nothing in the pack has any evidence for the
  // wording, guessing is not an answer source - so the pack server is asked for
  // a real one. /know races every live source at once (wiki list articles, the
  // article's own categories, Datamuse associations, the model lanes) and the
  // first useful list comes back here and leads the hand.
  var KNOW = 'http://127.0.0.1:5201/know?q=';
  function knowLookup(cat) {
    if (!window.fetch || window.__krKnow === false) return;
    BOT.knowPending = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 6500);
    fetch(KNOW + encodeURIComponent(cat), ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        BOT.knowPending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {};
        (lr.bad || []).forEach(function (b) { bad[KR.norm(b)] = 1; });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || BOT.turnSent[k] || BOT.picks.indexOf(a) >= 0) continue;
          if (banned(a) || !KR.shapeOk(cat, a)) continue;
          add.push(a);
        }
        if (!add.length) return;
        // A repeat of the same clue must reach fresh answers, not the ones the
        // room already took: unused first, spent behind the whole hand.
        var spk = splitUsed(add);
        BOT.picks = spk.un.concat(BOT.picks, spk.us);
        BOT.idx = 0;
        resetTyped();
        BOT.knowGot = true;
        log({ know: add.slice(0, 5), src: j.src });
      })
      .catch(function (e) { clearTimeout(timer); BOT.knowPending = false; });
  }

  // A category no source has indexed yet: the pack server can ask a model once
  // and cache the answer forever, if the owner has put a key in .env. Without a
  // key it answers instantly with nothing, and the pack's own answers stand.
  var LLM = 'http://127.0.0.1:5201/llm?q=';
  function llmLookup(cat) {
    if (!window.fetch || window.__krLlm === false) return;
    BOT.llmPending = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 9000);
    fetch(LLM + encodeURIComponent(cat), ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        BOT.llmPending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {};
        (lr.bad || []).forEach(function (b) { bad[KR.norm(b)] = 1; });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || BOT.turnSent[k] || BOT.picks.indexOf(a) >= 0) continue;
          // A model answer to a shape question ("ending in -bound", "one word")
          // has to obey the shape too, or it is a rejection with extra steps.
          if (banned(a) || !KR.shapeOk(cat, a)) continue;
          add.push(a);
        }
        if (!add.length) return;
        var spm = splitUsed(add);
        var at = BOT.askGot ? BOT.askCount : 0;
        if (spm.un.length) {
          BOT.picks.splice.apply(BOT.picks, [at, 0].concat(spm.un));
          BOT.idx = 0;
          // A model answer outranks a typed guess: take the box back.
          if (at === 0) resetTyped();
        }
        // A model answer this game already used goes to the back, never on top.
        if (spm.us.length) BOT.picks = BOT.picks.concat(spm.us);
        BOT.llmGot = true;
        log({ llm: add.slice(0, 4) });
      })
      .catch(function (e) { clearTimeout(timer); BOT.llmPending = false; log({ llmErr: String(e && e.message || e) }); });
  }

  // Per-category yield, persisted across games and room reloads: whether the
  // pack actually knows a prompt (many deep picks) or answers it from a thin
  // fallback is what decides the win rate, so every prompt the room renders is
  // recorded with the number of picks it produced and what the room rejected.
  var CKEY = 'kr:cats:v1';
  function catMap() { try { return JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { return {}; } }
  function catWrite(m) { try { localStorage.setItem(CKEY, JSON.stringify(m)); } catch (e) {} }
  function catSet(cat, picks, weak) {
    var k = KR.norm(cat || ''); if (!k) return;
    var m = catMap(), r = m[k] || { q: cat, n: 0, s: 0, ok: 0, bad: 0, w: 0, p: 0 };
    r.q = cat; r.n++; r.p = Math.max(r.p || 0, picks); if (weak) r.w++;
    m[k] = r; catWrite(m);
  }
  function catBump(cat, f) {
    var k = KR.norm(cat || ''); if (!k) return;
    var m = catMap(), r = m[k] || { q: cat, n: 0, s: 0, ok: 0, bad: 0, w: 0, p: 0 };
    r[f] = (r[f] || 0) + 1; m[k] = r; catWrite(m);
  }
  function catWord(cat, w) {
    var k = KR.norm(cat || ''); if (!k || !w) return;
    var m = catMap(), r = m[k] || { q: cat, n: 0, s: 0, ok: 0, bad: 0, w: 0, p: 0 };
    (r.bw = r.bw || []).push(w); m[k] = r; catWrite(m);
  }
  window.__krCats = catMap;

  // How famous an answer is, counted as the number of independent lists in the
  // pack that contain it. Tier order alone cannot separate T-Rex from
  // Amargasaurus, or Monopoly from Crokinole: both come from the same kind of
  // bucket. Recency of nothing is not evidence, but repetition across a curated
  // list, 40 prompt buckets and 30 WordNet families is.
  // Fame is scoped to the head noun. Counting an answer across the whole pack
  // promoted generic words instead of famous ones: "Seed" is in dozens of
  // buckets, so it outranked banana for a fruit - it is famous for nothing in
  // particular. An answer counts when the lists that hold it are about THIS
  // head, which is also how a "cereal brand" bucket beats a grain family.
  var POPH = {};
  function headFame(head) {
    if (POPH[head]) return POPH[head];
    var m = {};
    var add = function (s, w) {
      if (!s) return;
      String(s).split('|').forEach(function (x) {
        var k = KR.norm(x);
        if (k && k.length > 2) m[k] = (m[k] || 0) + w;
      });
    };
    var cur = KB.cur || [];
    for (var i = 0; i < cur.length; i++) {
      var rule = cur[i];
      if (!rule || !rule.list) continue;
      var lbl = String(rule.has || rule.label || rule.q || '');
      add(rule.list, head && lbl.indexOf(head) >= 0 ? 4 : 0);
    }
    var pk1 = KB.pk || {};
    for (var k1 in pk1) if (head && k1.indexOf(head) >= 0) add(pk1[k1], 2);
    if (head) add((KB.hn || {})[head], 2);
    POPH[head] = m;
    return m;
  }

  function fame(a, head) {
    var p = headFame(head)[KR.norm(a)] || 0;
    // A long multi-word answer is a deep cut almost by construction.
    if (/\s/.test(String(a).trim())) p -= 1;
    return p;
  }

  // An answer already given in this game is a rejection in most rounds, so
  // unused answers go first. This is module scope on purpose: the live lanes
  // (/know, /ask, the model) prepend their batches on top of the ordered pack
  // tiers, and a plain concat there put a spent answer back in front - which is
  // why a repeated identical clue re-sent the same three words to be rejected
  // again instead of moving on.
  function splitUsed(arr) {
    var un = [], us = [];
    for (var i = 0; i < arr.length; i++) {
      ((BOT.gameSent || {})[KR.norm(arr[i])] ? us : un).push(arr[i]);
    }
    return { un: un, us: us };
  }
  function usedLast(arr) { var sp = splitUsed(arr); return sp.un.concat(sp.us); }

  function begin(cat) {
    // A new game starts a new answer budget: after a game over the same answers
    // are legal again, so the repeat guard resets with the game, not with the tab.
    if (BOT.out) { BOT.gameSent = {}; BOT.out = false; }
    BOT.cat = cat;
    BOT.lastKey = KR.norm(cat);
    BOT.idx = 0;
    BOT.current = '';
    BOT.out = false;
    BOT.turnSent = {};
    BOT.sentThisTurn = 0;
    BOT.catBad = 0;
    BOT.askGot = false;
    BOT.askPending = false;
    BOT.askCount = 0;
    BOT.llmGot = false;
    BOT.llmPending = false;
    BOT.genUsed = false;
    BOT.junkOk = false;
    BOT.junkIds = [];
    BOT.sfCat = '';
    BOT.genCat = '';
    BOT.badSrc = {};
    BOT.allSrcOk = false;
    BOT.holdLogged = false;
    BOT.vocIdx = 0;
    BOT.holdLogged = false;
    BOT.lastResort = false;
    BOT.cool = 0;
    BOT.idleAt = 0;
    BOT.armedAt = 0;
    BOT.armTries = 0;
    BOT.turnStart = 0;
    var lr = loadLrn()[learnKey(cat)] || {};
    // Whatever the last turn left in the box is not an answer to this category.
    // Leaking it through made the bot resubmit an old answer on its next turn,
    // and the room counted the duplicate as a wrong echo.
    var stale = input();
    if (stale && stale.value) setValue(stale, '');
    // Resolve with provenance: every send records which lookup produced it, so a
    // wrong answer is traceable instead of mysterious.
    var tr = [];
    // A category that asks for a word ("containing age", "ending in tion") has
    // to answer with one English word: no hyphenated coinages, no "age-imo".
    BOT.wordy = /\bwords?\b/.test(KR.norm(cat));
    BOT.picks = KR.resolve(cat, KB, {
      bad: (lr.bad || []).concat(Object.keys(BOT.badAll || {})), trace: tr, rare: RARE,
      deep: RARE && MINRANK >= 3, win: !RARE && MINRANK <= 0,
      // The resolver's generic fallback is off by default now: it answered a
      // cowboy and a shade-of-gray question with "Apple, Australia, Cuba, Canada,
      // Austria", and in two measured losses it was ~15 of 38 rejections. The AI
      // lane, the shape list and the family tiers fill those slots.
      fallback: false, noGeneric: true,
      // Answers that satisfy the qualifier lead; answers that only satisfy the
      // head noun follow as a reserve. A wrong send costs one retry, an empty
      // turn costs the puffer, so the reserve is strictly better than silence.
      softQual: true
    });
    BOT.src = {};
    for (var ti = 0; ti < tr.length; ti++) BOT.src[KR.norm(tr[ti].a)] = tr[ti].src;
    // Rejections by source, measured over 29 rated games: the generic fallbacks
    // and near-prompt guesses were the bulk (corpus-last 36, corpus-near 24,
    // wordnet-last 21 of 244). They are kept - an empty hand loses the life - but
    // they move behind everything the pack actually evidenced. A stable
    // partition, not a separate queue: v88's queue starved the hand.
    // `corpus:shoe` (bare head-noun bucket, no qualifier scope) is in the same
    // class: one measured loss was ten rejections from that single bucket.
    var JUNKSRC = /^(?:corpus-last|corpus-near|corpus-rule|corpus:[a-z]|wordnet-last|vocab-fallback|generic-fallback)/;
    var evPicks = [], latePicks = [];
    for (var pi = 0; pi < BOT.picks.length; pi++) {
      var pk = BOT.picks[pi];
      // No recorded source is not evidence: it is a guess from a tier that was
      // never traced ("bus" led a car-brand question, "Action-strategy game" led
      // a video-game one). Untraced picks queue behind everything evidenced.
      (JUNKSRC.test(BOT.src[KR.norm(pk)] || '') || !BOT.src[KR.norm(pk)] ? latePicks : evPicks).push(pk);
    }
    // A synonym of the subject is never an answer: "film" for a movie, "nation"
    // for a country, "beast" for an animal, "paint" for a color. Measured in the
    // harness as the second answer in most categories. Nor is the head noun
    // itself ("game" for a video game). They stay in the hand, last, so the turn
    // is still answered - they are just never the first thing sent.
    var headTok = KR.norm(cat).split(/\s+/).filter(function (w) {
      return w.length > 2 && !/^(name|give|say|tell|list|one|something|thing|things|that|with|from|your|you)$/.test(w);
    }).pop() || '';
    // The pack carries its own synonym table (KB.tr[head]): tr[movie] is
    // "motion picture|moving picture|picture show|film|picture", tr[country] is
    // "body politic|nation|res publica|commonwealth". A synonym of the subject can
    // never be an answer, and these were the second answer sent in most
    // categories - a guaranteed rejection every time.
    var syn = {};
    var cw = KR.norm(cat).split(/\s+/).filter(function (w) { return w.length > 2; });
    if (headTok) cw.push(headTok);
    for (var wi = 0; wi < cw.length; wi++) {
      var sl = String(((KB.tr || {})[cw[wi]]) || '').split('|');
      for (var si = 0; si < sl.length; si++) if (sl[si]) syn[KR.norm(sl[si])] = 1;
      syn[cw[wi]] = 1;
    }
    BOT.syn = syn;
    // Nothing evidenced at all: the bot must not pretend it knows this one. It
    // says so in the log and goes to fetch a real answer.
    // "Unknown" is not "empty": a hand full of WordNet buckets and associations
    // is a hand of guesses, and guesses are how "name a video game" got genres
    // (Advergame, Aim trainer) and "name a color" got paint. Only the room's own
    // accepted corpus (prompt/learned/curated/entity) counts as knowing a
    // category; without one, the bot says it does not know and fetches real
    // answers.
    var TRUSTED = /^(learned|prompt|curated|corpus\+[a-z]+|corpus-rule|corpus:[a-z]|entity:|compound:)/;
    // A borrowed prompt list (prompt-rare / prompt-deep) is the exact thing that
    // misfires - it is what answered a Pop-Tart question with an airline dump -
    // so it does not count as knowing the category. The category stays "unknown"
    // and the fetched list leads; the borrowed list stays as a reserve.
    BOT.unknown = !BOT.picks.some(function (a) {
      var s = (BOT.src || {})[KR.norm(a)] || '';
      return TRUSTED.test(s) && !/^prompt-(rare|deep)/.test(s);
    });
    BOT.knowGot = false;
    BOT.knowPending = false;
    if (BOT.unknown && cat) { log({ unknown: cat }); knowLookup(cat); }
    var dead = [];
    var live = evPicks.concat(latePicks).filter(function (a) {
      var s = (BOT.src || {})[KR.norm(a)] || '';
      if (/^(synonym|means|antonym|hypernym|hyponym):/.test(s)) { dead.push(a); return false; }
      var k = KR.norm(a);
      if (syn[k]) { dead.push(a); return false; }
      if (headTok && (k === headTok + 's' || k + 's' === headTok || k.indexOf(headTok + ' ') === 0 || k.indexOf(' ' + headTok) > 0)) { dead.push(a); return false; }
      return true;
    });
    // Fitness is about where an answer came from, in this order:
    //   1. this exact category's accepted answers (learned, curated, corpus+"video
    //      game", entity, compound);
    //   2. the room's general answers for the same head (prompt, corpus-rule);
    //   3. any other traced evidence (wordnet:, assoc:, bare corpus bucket);
    //   4. guesses with no provenance.
    // Without tiering, "prompt-rare" (a *similar* prompt's answers: 4X, Advergame,
    // Action RTS) outranked the real titles the pack holds for "video game".
    var EXACT = /^(learned|curated|corpus\+[a-z]+|entity:|compound:)/;
    // The head's own accepted answers are this category's answers. A prompt-*
    // list belongs to a *similar* prompt and can be a different kind of thing
    // entirely: "11th Street Kids, 22 Brides, A La Brava" are a comic-team list
    // that answered "name a superhero" ahead of Iron Man and Superman.
    var SAMEHEAD = /^(corpus:[a-z]|corpus-rule)/;
    var PROMPT = /^prompt/;
    // A corpus bucket can be polluted by the prompt it was harvested from: the
    // "fruit" bucket holds Core, Flesh, Pit and Seed, which came from a *part of
    // a fruit* prompt and are not fruits. WordNet's family for the head is the
    // check: if the pack knows the family and the bucket barely overlaps it, the
    // bucket answered a different question.
    var famSet = {};
    var famN = 0;
    String(((KB.hn || {})[headTok]) || '').split('|').forEach(function (w) {
      var fk = KR.norm(w);
      if (fk) { famSet[fk] = 1; famN++; }
    });
    var t1 = [], t2 = [], t2b = [], t3 = [], t4 = [];
    live.forEach(function (a) {
      var s = (BOT.src || {})[KR.norm(a)] || '';
      if (!s) t4.push(a);
      else if (EXACT.test(s)) t1.push(a);
      else if (SAMEHEAD.test(s)) {
        var kk = KR.norm(a);
        (famN >= 5 && !famSet[kk] ? t3 : t2).push(a);
      }
      else if (PROMPT.test(s)) t2b.push(a);
      else t3.push(a);
    });
    // Within a tier, the better-known answer goes first: the room's key holds
    // famous ones, and a correct-but-unknown deep cut loses the point just as
    // surely as a wrong answer. The exact tier (t1) keeps its own order because
    // that list is the room's own accepted answers for this wording.
    var hdF = (function (k) { var w = String(k || '').split(' ').filter(Boolean); return w[w.length - 1] || ''; })(KR.baseKey(cat));
    var byFame = function (arr) {
      return arr.map(function (a, i) { return { a: a, i: i, p: fame(a, hdF) }; })
        .sort(function (x, y) { return (y.p - x.p) || (x.i - y.i); })
        .map(function (o) { return o.a; });
    };
    // The exact tier is sorted too: its buckets were scraped alphabetically, so
    // "Name a dinosaur" led with Amargasaurus while T-Rex sat behind it. A
    // hand-curated list scores its members equally, so the stable sort leaves that
    // order exactly as written.
    //
    // Unused answers go first across all the *trusted* tiers - exact, same-head
    // and prompt lists. Partitioning inside each tier was not enough: a used
    // exact answer still led every unused same-head one, so a repeated clue spent
    // its turn re-sending "Cribbage, Carrom, Crokinole" while fresh board games
    // waited below, and the room rejected them one by one.
    // The guesses (t3 wordnet/association, t4 untraced, dead) never move up:
    // doing that is how a repeated "Name a color" fell from Red/Blue/Pink to
    // dye/stain/mordant and then to Apple, Australia, Cuba.
    // Which t3 answers are real answers and which are neighbours of the head
    // noun: a corpus bucket is a list about this category (the board-game bucket
    // holds Battleship, Chess, Clue), while a WordNet/association hit is a word
    // that *surrounds* the subject (dye, stain, mordant for "color"). Only the
    // corpus half joins the freshness pass; the rest stays behind used answers,
    // because a fresh guess is still a wrong answer.
    var t3c = [], t3g = [];
    t3.forEach(function (a) {
      var s3 = (BOT.src || {})[KR.norm(a)] || '';
      (/^(corpus|entity:|compound:)/.test(s3) ? t3c : t3g).push(a);
    });
    var traced = usedLast(byFame(t1)).concat(usedLast(byFame(t2)), usedLast(byFame(t2b)),
      usedLast(byFame(t3c)));
    var tb = splitUsed(traced);
    BOT.picks = tb.un.concat(tb.us, usedLast(byFame(t3g)), usedLast(byFame(t4)), dead);
    // Two lanes can carry the same answer in different case - "Leo" from the
    // model, "leo" from WordNet - and the room counts them as one word, so the
    // second is a guaranteed rejection. Keep the first, which is the better tier.
    (function () {
      var seenK = {}, uniq = [];
      for (var qi = 0; qi < BOT.picks.length; qi++) {
        var kq = KR.norm(BOT.picks[qi]);
        if (!kq || seenK[kq]) continue;
        seenK[kq] = 1;
        uniq.push(BOT.picks[qi]);
      }
      BOT.picks = uniq;
    })();
    // Sticky for the session: once a clue has been readable, the alphabetical
    // vocabulary is never a legitimate answer again, even inside a later
    // category that briefly renders empty.
    BOT.sawCat = BOT.sawCat || !!cat;
    BOT.turnStart = 0;
    BOT.retryAt = 0;
    // Every candidate from a domain-blind bucket ("character" answered with
    // Donkey Kong, "animal" answered with a colt) means this category is a
    // guaranteed loss unless a real source answers: nothing the pack has can
    // pass. Waiting longer for the model is then free, because the alternative
    // is spending the whole fuse on certain rejections.
    BOT.blindOnly = BOT.picks.length > 0 && BOT.picks.every(function (a) {
      return JUNKSRC.test(BOT.src[KR.norm(a)] || '');
    });
    if (BOT.wordy) BOT.picks = BOT.picks.filter(function (a) { return /^[a-z]+$/i.test(String(a).trim()); });
    // Win mode (MINRANK 0) needs no re-ordering here: the resolver already
    // returns exact answers first and commonest tier first, with guesses last.
    // Re-sorting by rarity here is exactly what turned a volume game into a
    // rare-word lottery, and it threw away the turn whenever the rare guess was
    // not in the room's answer key.
    if (MINRANK > 3) {
      var keep = [], fill = [];
      for (var pi = 0; pi < BOT.picks.length; pi++) {
        var pk = BOT.picks[pi];
        if (KR.deepRank(KB, pk) >= MINRANK) keep.push(pk); else fill.push(pk);
      }
      BOT.picks = keep.concat(fill.slice(0, MINRANK >= 5 ? 0 : 3));
    }
    // Does the pack actually know this category, or is the whole list the last
    // resort of a head-noun guess that ignores the qualifier? That distinction
    // decides whether the bot sends immediately or waits for the live lookup and
    // then sends only a couple of answers instead of a stream of guesses.
    // "Weak" is "the first answer is not from a list that knows this wording":
    // an association, a WordNet bucket or a vocabulary guess is exactly the case
    // the live list article is there to beat.
    // "Weak" now includes the bare head-noun bucket: `corpus:city` answers a
    // different question than "a city in the UK" and `corpus:position` than a
    // baseball position, so those categories get the model lane's verified list
    // instead of a guess. A qualifier-scoped bucket (`corpus+city`) is still
    // trusted and stays instant.
    BOT.weak = !tr.length ||
      !/^(learned|curated|prompt|corpus-near|corpus-rule|corpus-[a-z]+\+|entity|compound)/.test(tr[0].src || '') ||
      /rhymes?\s+with\b/.test(KR.norm(cat));
    BOT.liveGot = false;
    log({ cat: cat, n: BOT.picks.length, first: BOT.picks[0], src: tr[0] ? tr[0].src : '', weak: BOT.weak ? 1 : 0 });
    catSet(cat, BOT.picks.length, BOT.weak ? 1 : 0);
    // The association service answers with words that *mean* the subject: for
    // "name a color" it returned dye, paint, mordant, tincture (the material, not
    // a colour) and for "a 90s cartoon" it returned hot, cos, square. It is only
    // asked for association-shaped questions ("something you would find in X").
    if (assocShape(cat)) liveLookup(cat);
    // A weak category is exactly the one worth one extra request: the pack's own
    // bucket for its head noun is a guess, and the list article is not.
    // The list-article engine is opt-in (window.__krAsk = true): its precision
    // depends on Wikipedia's list coverage, and a wrong answer costs a life, so
    // it does not lead by default. The model bridge is always asked: it is the
    // one source that can answer a category nobody has indexed, and with no key
    // it answers instantly with nothing.
    // Both lookups start the moment the category is on screen, whoever's turn it
    // is. The opponent's turn is free time: by the time the puffer reaches us the
    // list article is usually already in hand, and its answers are verified for
    // this wording instead of guessed from the head noun.
    // Every category asks the model, not only the weak ones: the lanes are
    // quota-bound, so the only way to raise coverage is to have a request in
    // flight for every category and let caching make the repeats free. Measured
    // 23 categories / 4 AI answers when only weak categories asked.
    llmLookup(cat);
    // Unknown categories are owned by /know, which races every source itself: the
    // wiki-list lane has the wrong shape for "something you would take" questions
    // and served "Lists of islands" while /know already had tent and compass.
    if (BOT.weak && !BOT.unknown) askLookup(cat);
    // An empty hand is the one state that loses a life with no answer at all: the
    // puffer sits with us and the fuse runs. "A word ending in -bound" is not
    // "weak" by source, and it is exactly the category that needs the model.
    if (!BOT.picks.length) { BOT.askForced = true; askLookup(cat); llmLookup(cat); }
  }

  // The room takes answers, not descriptions. A fallback list can produce
  // "Edgar Allen Poe's “The Magic Clock of Dr. March” witch" or "-ary", and every
  // one of those is a rejection that burns the fuse.
  // The gate that decides whether a word can be sent at all. `trusted` means the
  // word came from the room's own accepted answers, and those include titles the
  // strict rules were throwing away: "Call of Duty: Modern Warfare 4" (colon,
  // five words), "Mario Kart 8 Deluxe" (digits). Rejecting them left the bot with
  // only the association tier - which is why "name a video game" answered with
  // genres while the pack held the real titles.
  function answerable(a, trusted) {
    var w = String(a || '').trim();
    if (!w) return false;
    if (w.length > (trusted ? 42 : 26)) return false;
    if (/[()\[\]“”"';,!?]/.test(w)) return false;
    if (/:/.test(w) && !trusted) return false;
    if (/^[^a-z0-9]/i.test(w)) return false;
    // Digits are scraper noise ("Sofa 421", "135 Airlines") unless the room
    // itself accepted the answer.
    if (/\d/.test(w) && !trusted) return false;
    if (w.split(/\s+/).length > (trusted ? 5 : 3)) return false;
    return true;
  }

  // Is this answer one the room has actually taken for a category like this one?
  function trustedSrc(a) {
    return /^(learned|prompt|curated|corpus\+[a-z]+|corpus-rule|corpus:[a-z]|entity:|compound:)/.test((BOT.src || {})[KR.norm(a)] || '');
  }

  // The turn must never go by unanswered. When nothing curated applies, the last
  // two seconds before the fuse pops are spent on any answerable word tied to the
  // question at all, instead of on silence, because SEND stays disabled while the
  // box is empty and an empty box is a guaranteed lost heart.
  function desperate() {
    var cat = BOT.cat || '';
    var ok = function (w) {
      var k = KR.norm(w);
      return w && k && !BOT.turnSent[k] && answerable(w, trustedSrc(w));
    };
    if (BOT.sfCat !== cat) { BOT.sfCat = cat; BOT.sf = shapeWords(cat); }
    for (var i = 0; i < (BOT.sf || []).length; i++) if (ok(BOT.sf[i])) return BOT.sf[i];
    var head = KR.norm(cat.replace(/\([^)]*\)/g, ' ')).split(/\s+/).filter(function (w) { return w.length > 2; }).pop() || '';
    var fam = (head && KB.hn && KB.hn[head]) ? String(KB.hn[head]).split('|') : [];
    for (var j = 0; j < fam.length; j++) if (ok(fam[j])) return fam[j];
    var voc = String(KB.voc || '').split('|');
    BOT.vocIdx = BOT.vocIdx || 0;
    while (BOT.vocIdx < voc.length) {
      var vw = voc[BOT.vocIdx++];
      if (ok(vw)) return vw;
    }
    return '';
  }

  // A synonym of the subject is never an answer, wherever the answer came from.
  // The ban lives at send time because the model lane and the fallback tiers
  // prepend picks after begin() has already filtered the pack's own list.
  function banned(a) {
    var k = KR.norm(a);
    return !!(k && BOT.syn && BOT.syn[k]);
  }

  function next() {
    // `corpus-last:<head>` is alphabetical filler (boo, book, boom, boot for a
    // word question) and it was the single biggest rejection class: 13 of 18 in
    // one measured window. It is kept as a reserve only, behind the shape list
    // and the family tiers.
    // Two passes: an answer already given in this game is a rejection in most
    // rounds, so it is only used once nothing unused is left. Silence still
    // costs a heart, so repeats stay available as the very last resort.
    while (BOT.idx < BOT.picks.length) {
      var a = BOT.picks[BOT.idx++];
      if (a && !BOT.turnSent[KR.norm(a)] && answerable(a, trustedSrc(a)) && !banned(a)) return a;
    }
    // Out of knowledge: fall back to the pack's universal set once, rather than
    // freezing or looping the same answer into the room. Rare-only mode has no
    // universal set - a common answer would be the one thing it may not send.
    if (!BOT.genUsed) {
      BOT.genUsed = true;
      // Rare-only mode still needs a reserve: when the deep cuts run out, the
      // ordinary list is better than sitting silent and letting the fuse pop.
      // Even the reserve has to be deep in this mode: a Plankton sent out of
      // desperation is still a Plankton in the room.
      // The reserve must come from the same gated pool as everything else: the
      // plain resolver hands back guesses with no tier data ("here" for a soup
      // category), and an untiered word is a Plankton in the room.
      var extra = KR.resolve(BOT.cat || '', KB, { rare: RARE, deep: RARE && MINRANK >= 3, win: !RARE && MINRANK <= 0, fallback: false, softQual: true });
      BOT.picks = BOT.picks.concat(extra.filter(function (a) {
        if (MINRANK < 3) return KR.deepRank(KB, a) >= MINRANK;
        return KR.deepRank(KB, a) >= 3 && KR.hasTier(KB, KR.norm(a));
      }).slice(0, 8));
      if (BOT.picks.length > BOT.idx) return next();
    }
    // Last resort: a common answer still scores ten points and keeps the puffer
    // moving; saying nothing scores nothing at all. This is the guarantee that a
    // turn never goes by unanswered.
    if (!BOT.lastResort) {
      BOT.lastResort = true;
      // No generic reserve here: an untopical word (Pizza for a Broadway
      // musical) is a wrong answer on the board, not a turn saved.
      // The last resort has to be tied to the question too: a word that belongs
      // to no part of the category (Pizza for a gas station chain) is an
      // obviously wrong answer, and silence reads better than that.
      var tr2 = [];
      var any = KR.resolve(BOT.cat || '', KB, { noGeneric: true, trace: tr2, softQual: true }).filter(function (a) {
        if (!KR.shapeOk(BOT.cat || '', a) || BOT.turnSent[KR.norm(a)]) return false;
        var src2 = '';
        for (var qi = 0; qi < tr2.length; qi++) { if (KR.norm(tr2[qi].a) === KR.norm(a)) { src2 = tr2[qi].src || ''; break; } }
        return /^(assoc|entity|compound|curated|prompt|corpus|synonym|learned)/.test(src2);
      });
      if (any.length) {
        BOT.picks = BOT.picks.concat(any.slice(0, 3));
        log({ lastResort: any[0], src: 'last-resort' });
        return next();
      }
    }
    // A shape category ("a word ending in -bound") has no family to draw on, so
    // the pack's vocabulary is filtered by the rule itself. This is the difference
    // between an empty hand and fifteen attempts while the fuse burns.
    if (BOT.sfCat !== BOT.cat) {
      BOT.sfCat = BOT.cat;
      BOT.sf = shapeWords(BOT.cat || '');
      if (BOT.sf.length) log({ shape: BOT.sf.slice(0, 3) });
    }
    while (BOT.sf && BOT.sf.length) {
      var sw = BOT.sf.shift();
      if (sw && !BOT.turnSent[KR.norm(sw)]) return sw;
    }
    // Final tier: the head noun's own members and the pack's generic set. A
    // topical wrong answer at least has a chance of being taken; an empty hand
    // loses the life by itself, because SEND stays disabled until text is typed.
    if (BOT.genCat !== BOT.cat) {
      BOT.genCat = BOT.cat;
      BOT.genList = genWords(BOT.cat || '');
      if (BOT.genList.length) log({ gen: BOT.genList.slice(0, 3) });
    }
    while (BOT.genList && BOT.genList.length) {
      var gw = BOT.genList.shift();
      if (gw && !BOT.turnSent[KR.norm(gw)]) return gw;
    }
    // Nothing left at all: record it, so "we lost the heart with an empty hand"
    // is a measurement instead of a guess.
    if (!BOT.ehAt || Date.now() - BOT.ehAt > 1200) {
      BOT.ehAt = Date.now();
      log({ emptyHand: BOT.cat, sentThisTurn: BOT.sentThisTurn, noCat: BOT.cat ? 0 : String(pageText()).slice(-50) });
    }
    BOT.missed = (BOT.missed || 0) + 1;
    return '';
  }

  // Words from the pack's own vocabulary that satisfy an explicit shape rule.
  // Only for questions that state one: the same scan on an ordinary category
  // would answer "a gas station chain" with the dictionary.
  function shapeWords(cat) {
    var out = [];
    var c = null;
    try { c = KR.constraints ? KR.constraints(cat) : null; } catch (e) { c = null; }
    if (!c) return out;
    var shaped = !!(c.pre || c.end || c.first || c.has || c.len || c.vowels || c.apos || c.hyph || (c.hasAll && c.hasAll.length));
    if (!shaped) return out;
    var src = String(KB.voc || '').split('|');
    for (var i = 0; i < src.length && out.length < 60; i++) {
      var w = src[i];
      if (!w || w.length < 3 || w.length > 24) continue;
      if (BOT.turnSent[KR.norm(w)]) continue;
      if (!KR.shapeOk(cat, w) || !answerable(w)) continue;
      out.push(w);
    }
    return out;
  }

  // The pack's generic answers plus the head noun's own family: the last resort
  // that is still about the question.
  function genWords(cat) {
    var out = [];
    var push = function (s) {
      String(s || '').split('|').forEach(function (w) {
        w = String(w || '').trim();
        if (w.length < 3 || w.length > 24) return;
        var k = KR.norm(w);
        if (!k || out.indexOf(w) >= 0 || BOT.turnSent[k]) return;
        if (!KR.shapeOk(cat, w) || !answerable(w)) return;
        out.push(w);
      });
    };
    var head = KR.norm(String(cat || '').replace(/\([^)]*\)/g, ' ')).split(/\s+/).filter(function (w) { return w.length > 2; }).pop() || '';
    if (head && KB.hn) push(KB.hn[head]);
    if (head && KB.pk) push(KB.pk[head]);
    // NOT KB.gen (Umbrella, Water bottle, Spoon): that is a list of *things*, and
    // it answered a storybook-witch question with 32 rejections in one game.
    // The universal tier is instead the head of `voc`, the answers the room has
    // actually taken most often. A bare word has a chance of being accepted;
    // an empty hand has none, because SEND stays disabled until text is typed.
    // A lookup already on the wire is worth more than this tier: "Italy" for a
    // storybook-witch question is a rejection, and the verified list lands inside
    // the 2.5s hold. Return nothing here and let the hold run; the universal
    // words are used once the lane has actually failed.
    // Bounded: after 3s of holding, a guess beats a pop, so the universal tier
    // takes over even if the lane has not answered yet.
    if ((BOT.llmPending || BOT.askPending) && BOT.turnStart && Date.now() - BOT.turnStart < 3000) return out;
    // A drained list is a permanent silence: in a 33-category game the universal
    // tier was built once, emptied, and every later turn answered nothing. The
    // pointer walks the vocabulary instead, so the hand can always be refilled.
    // Only when the category itself could not be read. For a real question these
    // words are guaranteed rejections: "Apple, Cuba, Austria, American football"
    // answered "a green animal" in one measured game - ~20 of its 32 rejections.
    // Only when this game has never shown a readable category. `cat` alone is
    // not enough: it is empty for the moment before the clue renders, and that
    // window served the alphabetical vocabulary to a theatre-term question
    // (Apple, Australia, Cuba, Canada, Austria) in a measured loss.
    if (BOT.sawCat) return out;
    if (cat) return out;
    var voc = String(KB.voc || '').split('|');
    BOT.vocIdx = BOT.vocIdx || 0;
    while (BOT.vocIdx < voc.length && out.length < 20) {
      var vw = voc[BOT.vocIdx++];
      if (!vw || vw.length < 3 || vw.length > 24) continue;
      var vk = KR.norm(vw);
      if (!vk || BOT.turnSent[vk] || !KR.shapeOk(cat, vw) || !answerable(vw)) continue;
      out.push(vw);
    }
    return out.slice(0, 20);
  }

  function tick() {
    try {
      if (window.__krOwner !== ID) return;
      if (!BOT.on || !KB) return;
      var text = pageText();
      var el = input();
      var btn = sendBtn();
      // An enabled SEND button is the only state that means "answer now": the
      // caption above it changes between rounds ("your puffer", "NEW", ...) and
      // trusting it cost whole turns. The caption is still used to notice that
      // the puffer has left us.
      // A missing button is not "not our turn": the room swaps the SEND element
      // on re-render, and treating that frame as idle is how a ready answer was
      // never sent. Only an explicitly disabled button means we cannot send.
      var active = !!(el && (!btn || !btn.disabled));
      // "Your turn" has to be recognised by every shape the room uses, because
      // missing it is indistinguishable from being asleep: the caption is
      // "your puffer · type an answer" on some layouts and "▸ Buffy is up" on
      // others, and SEND is disabled until the box has text, so an enabled-button
      // test alone is false for the whole turn. The input and SEND are only
      // mounted while it is our turn, so their presence is the real signal.
      var ourName = 'Buffy';
      try { ourName = BOT.name || localStorage.getItem('kr_name') || 'Buffy'; } catch (e) { ourName = 'Buffy'; }
      var capMine = /your puffer/i.test(text) ||
        new RegExp('\\u25b8\\s*' + String(ourName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+is up', 'i').test(text) ||
        /\bis up\b/i.test(text);
      var mine = capMine || active || !!(el && btn);
      var gone = /you're out|watching/i.test(text);
      if (mine) {
        if (!BOT.turnStart) BOT.turnStart = Date.now();
      } else {
        BOT.turnStart = 0;
      }
      // Sample every page change, not only our own turns: the turns that killed us
      // produced no log line at all, so the sample is the only record of what the
      // room showed while we were being eliminated.
      var seen = (window.__krSeen = window.__krSeen || []);
      var tail120 = text.slice(-120);
      var lastSeen = seen[seen.length - 1];
      if (!lastSeen || lastSeen.t !== tail120) {
        seen.push({ ms: Date.now(), a: active ? 1 : 0, m: mine ? 1 : 0,
                    el: el ? 1 : 0, btn: btn ? 1 : 0, dis: btn && btn.disabled ? 1 : 0,
                    t: tail120 });
        if (seen.length > 300) seen.shift();
      }

      // Resolve the moment the category text appears, whoever is up. By the time
      // SEND enables the candidates are already in memory, so the first live tick
      // answers in the same frame. lastCat keeps us from re-resolving the same
      // wording every tick after a turn clears BOT.cat.
      var catNow = category(text);
      if (catNow) {
        // Key on the normalized wording: the room appends a fuse count and
        // re-renders the same clue, and re-beginning mid-turn used to wipe the
        // candidate list and the sent-this-turn memory.
        var keyNow = KR.norm(catNow);
        var junk = /^(floating|new category|category|send|\d+|[\d\s\/]+)$/i.test(keyNow);
        if (!junk && keyNow !== BOT.lastKey) {
          BOT.lastKey = keyNow;
          begin(catNow);
        }
        // The room asks the same wording twice: a clue can repeat within a game,
        // and the next round can reuse it verbatim. Keying only on the words made
        // that a dead turn - the second "Name a color" got no answer at all,
        // because the text never changed. A turn that was answered, whose box is
        // empty again and which has been idle for a few seconds is a new turn even
        // when the words are identical. The send counter gates it, so it cannot
        // loop on a single turn.
        else if (!junk && BOT.sentThisTurn > 0 && BOT.sentAt &&
                 Date.now() - BOT.sentAt > 3000 &&
                 (!BOT.rebeginAt || Date.now() - BOT.rebeginAt > 4000)) {
          var eSame = input();
          if (eSame && !eSame.value) {
            BOT.rebeginAt = Date.now();
            begin(catNow);
          }
        }
      }

      // The room can render a short clue first and the full wording a moment
      // later. Until something is sent, a longer version of the same clue is a
      // different question and must be resolved again - otherwise the bot
      // answers a truncated label it never actually read.
      if (catNow && BOT.cat && !BOT.sentThisTurn && catNow.length > BOT.cat.length &&
          KR.norm(catNow).indexOf(KR.norm(BOT.cat)) === 0) {
        BOT.lastKey = KR.norm(catNow);
        begin(catNow);
      }

      if (BOT.sentAt && !mine) {
        // The puffer moved on and the room never complained: the answer landed.
        learn('ok', BOT.cat, BOT.current);
        catBump(BOT.cat, 'ok');
        log({ ok: BOT.current });
        BOT.sentAt = 0;
        BOT.current = '';
        var keep = input();
        if (keep && keep.value) setValue(keep, '');
        BOT.cat = '';
        return;
      }
      if (gone) { BOT.out = true; return; }
      if (!mine) return;

      if (BOT.sentAt && (refused(text, BOT.current) || /try again|not valid/i.test(text))) {
        learn('bad', BOT.cat, BOT.current);
        // Rejections are remembered for the whole session, not just this
        // category: repeating "aden, agra, apia, baku" in the next city question
        // burned a second turn on the same four wrong answers.
        BOT.badAll = BOT.badAll || {};
        BOT.badAll[KR.norm(BOT.current)] = 1;
        catBump(BOT.cat, 'bad');
        catWord(BOT.cat, BOT.current);
        log({ bad: BOT.current });
        BOT.rejected++;
        // Two wrong answers in one category is enough: "a movie starring
        // Zendaya" took eleven of them, and every rejection is a turn the room
        // counted as a miss. The next category is worth more than the third
        // guess at this one.
        // A rejected word from a verified list is worth one more try at the same
        // category; a rejected *guess* is not. The association reserve produced
        // "bent" and "bird" for baseball positions, and each one cost a turn.
        var badSrc = (BOT.src || {})[KR.norm(BOT.current)] || '';
        var badTrusted = /^(learned|curated|prompt|corpus|entity|compound|synonym)/.test(badSrc);
        // A rejected guess does not end the category while a verified list is
        // still on the wire: the model's answers arrive a second or two later and
        // they are the ones that pass the puffer. Giving up here is how a good
        // answer was thrown away after the first wrong guess.
        var pendingList = BOT.llmPending || BOT.askPending;
        // One extra try while a verified list is on the wire, not an open bar:
        // two rejected guesses end the category even then, so a lane that never
        // answers cannot turn the turn into a stream of wrong answers.
        BOT.catBad = (BOT.catBad || 0) + (badTrusted ? 1 : (pendingList ? 1 : 3));
        BOT.sentAt = 0;
        BOT.current = '';
        // The room refused this *source*, not just this word: one refusal from
        // `corpus:shoe` was followed by nine more from the same bucket. Remember
        // the source so the rest of that bucket is deferred, not streamed.
        if (badSrc) {
          BOT.badSrc = BOT.badSrc || {};
          BOT.badSrc[badSrc] = (BOT.badSrc[badSrc] || 0) + 1;
        }
        BOT.cool = Date.now() + 60;      // let the room's message settle
        var el0 = input();
        if (el0) setValue(el0, '');
      }

      // No early return on an empty hand: next() can still answer a shape
      // question from the vocabulary, and returning here is what let the fuse
      // pop on "a word ending in -bound" without a single attempt.
      if (!el) return;
      // Send button optional: pressEnter() submits when the room has not rendered
      // one yet, so no turn is ever lost to a missing element.
      if (!btn) btn = sendBtn();

      // A value in the box that we did not type in full is a half-written word
      // ("poly", "olyester"): rewrite it rather than submit it. Clicking here is
      // what put fragments in the room's answer log.
      // Compare normalised: the room trims and re-capitalises what it receives,
      // and a strict compare against the typed string looped forever without ever
      // submitting - a ready answer that never left the box.
      if (el.value && KR.norm(el.value) !== KR.norm(BOT.current || '')) {
        setValue(el, BOT.current || '');
        BOT.armedAt = Date.now() + 45;
        BOT.armTries = (BOT.armTries || 0) + 1;
        // Three frames of disagreement is the room's doing, not ours: send what
        // is actually in the box rather than lose the turn to a cosmetic diff.
        if (BOT.armTries > 3) {
          BOT.armTries = 0;
          BOT.current = String(el.value || BOT.current || '');
        }
        return;
      }
      BOT.armTries = 0;

      // No category on screen means no answer exists: in the lobby this typed
      // "Apple" into the name field. The room only has a question when a clue is
      // rendered, and begin() is what records it.
      if (!el.value && BOT.cat) {
        var a = next();
        if (!a) {
          // The fuse is ~7.7s, so a missing answer does not have to be sent
          // instantly: hold the turn open and keep asking, which is the whole
          // difference between "unknown" and "silent".
          var nowW = Date.now();
          if (!BOT.turnStart) BOT.turnStart = nowW;
          var waited = nowW - BOT.turnStart;
          if (waited < 5200) {
            if (!BOT.retryAt || nowW > BOT.retryAt) {
              BOT.retryAt = nowW + 1400;
              if (!BOT.unknown) askLookup(BOT.cat || '');
              llmLookup(BOT.cat || '');
              // Unknown categories keep asking the racing endpoint: its lanes are
              // quota-limited and a failed one must be retried, not remembered.
              if (BOT.unknown && !BOT.knowGot) knowLookup(BOT.cat || '');
            }
            if (!BOT.ehAt || nowW - BOT.ehAt > 1200) {
              BOT.ehAt = nowW;
              log({ waiting: BOT.cat, ms: waited });
            }
            return;
          }
          // Fuse nearly out: an answerable word beats an empty box.
          var d = desperate();
          if (d) {
            BOT.current = d;
            setValue(el, d);
            BOT.armedAt = Date.now() + 60;
            log({ desperate: d, ms: waited });
            return;
          }
          if (!BOT.ehAt || nowW - BOT.ehAt > 1200) {
            BOT.ehAt = nowW;
            log({ emptyHand: BOT.cat, ms: waited, sentThisTurn: BOT.sentThisTurn });
          }
          return;
        }
        BOT.turnStart = 0;
        BOT.retryAt = 0;
        BOT.current = a;
        setValue(el, a);
        // Typing is not instant: React's controlled input can still hold the
        // previous, shorter value for a frame or two. Sending inside that window
        // is how "j", "d" and "polyester" reached the room.
        BOT.armedAt = Date.now() + 55;
      }

      var b2 = sendBtn();
      // A dozen tries in one turn is already far past useful: each rejection is
      // a wrong answer in the room's log, and a flood looks nothing like a
      // person playing.
      // If the live lookup for this category is still on the wire, give it a
      // moment before spending the turn on the pack's own guess - but never for
      // long enough to miss the turn.
      // With nothing qualifier-aware in the pack, the live lookup IS the answer
      // source: it is worth a couple of seconds of the puffer to avoid sending
      // guesses that have nothing to do with the question.
      // The model lane is the one source that can answer a category nobody has
      // indexed, and a fast lane needs a couple of seconds; a wrong guess needs
      // none. Waiting on it is worth more than the pack's bare head-noun guess.
      // NOTHING waits for the network. The puffer only advances on an accepted
      // answer and the fuse runs while we hold it, so time spent waiting for a
      // lookup is time spent closer to popping. A reply that arrives after the
      // turn is worth nothing; the answer already in memory is worth a pass now.
      // The lookups still run in the background and their answers are cached for
      // the next turn or the next game.
      // The only deliberate pause left: if the answer we are about to send is a
      // bare head-noun guess and a verified list is already on the wire, 450ms is
      // worth paying to send a real answer instead of a rejection (a rejection
      // costs more than that, and passes nothing). A verified answer never waits.
      var topSrc = (BOT.src || {})[KR.norm(BOT.picks[BOT.idx] || '')] || '';
      var unsure = !/^(learned|curated|prompt|corpus-near|corpus-rule|corpus-[a-z]+\+|entity:|compound:|synonym)/.test(topSrc);
      // The category is on screen while the opponent answers, so the model lane
      // usually starts before our turn. A model answer is verified for this
      // wording and passes the puffer; a guess does not. 1.2s is the most it is
      // worth holding for that trade.
      var llmSoon = BOT.weak && BOT.llmPending && !BOT.llmGot;
      // 1.2s, not 2.5s: the raced lane answers in ~0.9s, and every millisecond
      // spent holding is fuse that cannot be earned back. The hold is logged so
      // it can be counted against the life budget instead of guessed at.
      // A blind-only hand is a certain loss, so the hold can be much longer than
      // 1.2s without making the outcome worse: measured 12 certain rejections on
      // a "Wizard of Oz character" category that a 3.5s wait would have beaten.
      var blindHold = BOT.blindOnly && (BOT.llmPending || BOT.askPending) ? 3500 : 0;
      // Hard ceiling on any hold. The old 3.5s blind hold meant a ready answer
      // sat unsent for half the fuse, which is indistinguishable from being silent
      // and loses the turn anyway. 900ms is the most holding is ever worth.
      // Inside the fuse there is room to let the model answer instead of sending
      // the pack's guess: a wrong word costs a retry AND a turn, while 1.4s costs
      // only time the fuse already charges. A trusted answer never waits.
      // For a category the pack cannot answer at all, the fetched list is the
      // only real answer: waiting for it is worth 2.6s of the fuse, because the
      // alternative is a known-wrong guess. Sending resumes the moment it lands.
      // begin() clears turnStart on the same tick the first send is considered,
      // which made the hold below unreachable exactly when it mattered: the first
      // turn of an unknown category, before the fetched list has landed.
      if (!BOT.turnStart) BOT.turnStart = Date.now();
      var unknownHold = BOT.unknown && !BOT.knowGot ? 2600 : 0;
      var waitFor = Math.max(unknownHold, unsure ? Math.min(1400, (BOT.llmPending || BOT.askPending || BOT.livePending || BOT.knowPending) ? 1400 : 0) : 0);
      var waiting = waitFor > 0;
      if (waiting && BOT.turnStart && Date.now() - BOT.turnStart < waitFor && BOT.sentThisTurn === 0) {
        if (!BOT.holdLogged) { BOT.holdLogged = true; log({ hold: waitFor, cat: BOT.cat }); }
        return;
      }
      // Three tries is enough to show the room a guess was wrong; a page of them
      // is what "typing random answers" looked like.
      // Volume is the win condition: the puffer moves one step per accepted
      // answer, so the more the room takes the less time it spends with us.
      // Each attempt costs ~0.4s and the fuse is about 7.7s: a dozen attempts is
      // all one turn can afford, and past that the rejections themselves pop us.
      var cap = 12;
      var giveUp = (BOT.catBad || 0) >= 2;
      // Giving up is not free: the puffer stays with us and the fuse keeps
      // running, so staying quiet loses the life outright. A guess can still be
      // accepted, so after two rejections the turn is bounded, not ended.
      // Every rejection still costs a turn, but staying quiet costs the life, so
      // the cap stays the cap: the room's own "no echo" is the feedback.
      var turnCap = cap;
      if ((!b2 || !b2.disabled) && BOT.sentThisTurn < turnCap && Date.now() - BOT.clickedAt > 60 && Date.now() > BOT.cool) {
        // Last check before spending the turn: the box must hold exactly the
        // answer we mean to send, and it must have held it long enough for the
        // room's own state to catch up.
        if (el.value !== BOT.current) {
          setValue(el, BOT.current);
          BOT.armedAt = Date.now() + 55;
          return;
        }
        if (BOT.armedAt && Date.now() < BOT.armedAt) return;
        var submit = BOT.current;
        BOT.clickedAt = Date.now();
        if (b2) b2.click(); else pressEnter(el);
        BOT.sent++;
        BOT.sentThisTurn++;
        BOT.turnSent[KR.norm(submit)] = 1;
        (BOT.gameSent = BOT.gameSent || {})[KR.norm(submit)] = 1;
        BOT.sentAt = BOT.clickedAt;
        catBump(BOT.cat, 's');
        log({ sent: submit, idx: BOT.idx, n: BOT.picks.length, src: (BOT.src || {})[KR.norm(submit)] || '', tier: KR.deepRank(KB, submit) });
        // Verify it afterwards instead of assuming it: if the room took a
        // shortened copy, the box still holds a fragment of what we typed, and
        // the word never appears in the feed.
        (function (w) {
          setTimeout(function () {
            var e2 = input();
            var v2 = e2 ? String(e2.value || '') : '';
            if (v2 && v2 !== w && (w.indexOf(v2) === 0 || v2.indexOf(w) === 0)) log({ truncated: w, box: v2 });
            else if (pageText().indexOf(w) < 0) log({ unconfirmed: w });
          }, 420);
        })(submit);
      }

      // On our turn and still nothing out after 2.5s: record exactly what the DOM
      // looked like, so the next silent death is a log line instead of a mystery.
      if (active && !BOT.sentThisTurn && BOT.turnStart && Date.now() - BOT.turnStart > 2500) {
        log({ stuck: { cat: BOT.cat, picks: BOT.picks.length, idx: BOT.idx,
                       val: el.value, hasBtn: !!b2, dis: !!(b2 && b2.disabled),
                       cool: Math.max(0, BOT.cool - Date.now()), tail: text.slice(-90) } });
      }

      // The other silent death: the room says it is our turn but no enabled SEND
      // button exists. Log what the page actually had, then try to submit without
      // the button rather than waiting for a fuse to kill us.
      if (mine && !active && !BOT.sentThisTurn) {
        if (!BOT.idleAt || Date.now() - BOT.idleAt > 1500) {
          BOT.idleAt = Date.now();
          log({ idle: {
            hasEl: !!el, hasBtn: !!btn, dis: !!(btn && btn.disabled),
            val: el ? String(el.value).slice(0, 40) : null,
            fields: [].map.call(document.querySelectorAll('input,textarea,[contenteditable="true"]'), function (n) {
              return (n.tagName + '.' + (n.className || '')).slice(0, 34) + ' [' + (n.getAttribute('placeholder') || '') + ']' + (n.disabled ? ' dis' : '');
            }).slice(0, 6),
            btns: [].map.call(document.querySelectorAll('button'), function (b) {
              return ((b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 16) || '-') + (b.disabled ? '|dis' : '|en');
            }).slice(0, 8),
            tail: text.slice(-90)
          } });
        }
        if (el && BOT.cat && BOT.picks.length && !el.value) { BOT.current = next(); setValue(el, BOT.current); }
        if (el && el.value && !btn) {
          ['keydown', 'keypress', 'keyup'].forEach(function (t) {
            el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          });
        }
      }
    } catch (e) {
      log({ err: String(e && e.message || e) });
    }
  }

  // Narrow observers, re-attached when the room swaps the input/button nodes
  // out between categories.
  function rewatch() {
    var el = input(), btn = sendBtn();
    if (!el && !btn) return;
    if (BOT.wn && BOT.wn[0] === el && BOT.wn[1] === btn) return;
    BOT.wobs.disconnect();
    [el, btn].forEach(function (n) {
      if (n) BOT.wobs.observe(n, { attributes: true, childList: true, characterData: true, subtree: true });
    });
    BOT.wn = [el, btn];
    if (BOT.logs++ < 4) log({ watch: { el: !!el, btn: !!btn, dis: !!(btn && btn.disabled) } });
  }

  // The pack takes a while to decode, and joining a table reloads the page, so
  // the decoded base64 is kept in IndexedDB: a re-injected bot is armed from the
  // cache in about a second, before the first category can be missed.
  var IDB_NAME = 'krpack', IDB_KEY = 'pack';
  function idb(mode, fn) {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open(IDB_NAME, 1);
        rq.onupgradeneeded = function () { try { rq.result.createObjectStore('s'); } catch (e) {} };
        rq.onerror = function () { res(null); };
        rq.onsuccess = function () {
          try {
            var q = fn(rq.result.transaction('s', mode).objectStore('s'));
            q.onsuccess = function () { res(q.result); };
            q.onerror = function () { res(null); };
          } catch (e) { res(null); }
        };
      } catch (e) { res(null); }
    });
  }
  function cacheGet() { return idb('readonly', function (st) { return st.get(IDB_KEY); }); }
  function cacheSet(v) { return idb('readwrite', function (st) { return st.put(v, IDB_KEY); }); }

  window.__krLoad = function (inline) {
    var parts = inline ? [inline] : (window.__KRP || []);
    if (!parts.length) return Promise.resolve('no chunks: push base64 into window.__KRP first');
    var b64 = parts.join('').replace(/\s+/g, '');
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text().then(function (text) {
      KB = JSON.parse(text);
      KB.lrn = loadLrn();
      BOT.on = true;
      // Timers are throttled to about one a second while the tab is in the
      // background, which is exactly when the bot has to answer. DOM mutations
      // are not throttled, so every re-render of the room runs a tick too.
      if (window.MutationObserver && !BOT.obs) {
        BOT.obs = new MutationObserver(function () { tick(); });
        BOT.obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        (window.__krObs = window.__krObs || []).push(BOT.obs);
      }
      if (!BOT.timer) {
        BOT.timer = setInterval(tick, 50);
        (window.__krTimers = window.__krTimers || []).push(BOT.timer);
      }
      // Page timers in a hidden tab drop to about one a minute after five
      // minutes of intensive throttling - which is exactly the second half of a
      // round, and where turns were being missed. A worker timer is not part of
      // that budget, so it keeps the tick alive at 60ms with the tab hidden.
      if (!BOT.worker) {
        try {
          var wsrc = 'setInterval(function(){postMessage(1)},60)';
          var wurl = URL.createObjectURL(new Blob([wsrc], { type: 'text/javascript' }));
          BOT.worker = new Worker(wurl);
          BOT.worker.onmessage = tick;
          (window.__krWorkers = window.__krWorkers || []).push(BOT.worker);
        } catch (e) { log({ noWorker: String(e && e.message || e) }); }
      }
      // The SEND button's enabled state is published as a property, which fires
      // no mutation record, so observe the input and the button themselves too.
      if (!BOT.wobs) { BOT.wobs = new MutationObserver(tick); (window.__krObs = window.__krObs || []).push(BOT.wobs); }
      rewatch();
      if (!BOT.wtimer) BOT.wtimer = setInterval(rewatch, 150);
      log({ armed: true, hn: Object.keys(KB.hn || {}).length, pk: Object.keys(KB.pk || {}).length, tr: Object.keys(KB.tr || {}).length });
      return { armed: true, categories: Object.keys(KB.hn || {}).length, learned: Object.keys(KB.lrn || {}).length };
    });
  };

  // Preferred path: the pack is 800KB of gzip+base64, far too much to paste, so
  // it is fetched from the local pack server instead. Chrome treats 127.0.0.1 as
  // trustworthy, so an https page may fetch it.
  window.__krFetch = function (url) {
    var src = url || 'http://127.0.0.1:5201/kb';
    return fetch(src, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('kb ' + r.status); return r.text(); })
      .then(function (b64) { cacheSet(b64); return window.__krLoad(b64); })
      .catch(function (e) { log({ fetchErr: String(e && e.message || e), url: src }); return { error: String(e && e.message || e) }; });
  };

  // The tier capture is part of the harness, not the bot, but it has to outlive
  // the reloads a room does: every bot load makes sure it is running.
  try {
    if (!window.__gtObs) {
      var gtTag = document.createElement('script');
      gtTag.src = 'http://127.0.0.1:5201/tierlog.js?t=' + Date.now();
      document.documentElement.appendChild(gtTag);
    }
  } catch (e) { /* no document */ }

  // Warm the cache without arming: call this on the lobby page, then a join and
  // re-inject costs no turns.
  window.__krWarm = function (url) {
    var src = url || 'http://127.0.0.1:5201/kb';
    return fetch(src, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('kb ' + r.status); return r.text(); })
      .then(function (b64) { return cacheSet(b64).then(function () { return { warmed: b64.length }; }); })
      .catch(function (e) { return { error: String(e && e.message || e) }; });
  };

  window.__krTest = function (cat) {
    return KB ? KR.resolve(cat, KB, {}).slice(0, 8) : 'not loaded';
  };
  window.__krReset = function () {
    try { localStorage.removeItem(LS); } catch (e) {}
    if (KB) KB.lrn = {};
    return 'learning cleared';
  };

  // Restore the pack from the cache as soon as the script lands in a room page,
  // so the first category is answered instead of watched.
  if (/\/party\/[A-Za-z0-9]{3,}/.test(location.pathname)) {
    cacheGet().then(function (b64) {
      if (b64 && !KB) {
        try { window.__krLoad(b64); log({ restored: true }); } catch (e) { log({ restoreErr: String(e && e.message || e) }); }
      }
      // An empty or corrupt cache used to leave the bot loaded but blind, which
      // costs whole games. Fetch the pack instead.
      if (!KB) window.__krFetch();
    }).catch(function () {
      if (!KB) window.__krFetch();
    });
  }

  window.pufferBot = {
    version: 132,
    get rare() { return RARE; },
    get minRank() { return MINRANK; },
    get fallback() { return window.__krFallback !== false; },
    stop: function () { BOT.on = false; if (BOT.timer) clearInterval(BOT.timer); BOT.timer = 0; if (BOT.obs) BOT.obs.disconnect(); },
    start: function () { window.__krOwner = ID; BOT.on = true; if (!BOT.timer) BOT.timer = setInterval(tick, 50); },
    get cat() { return BOT.cat; },
    get picks() { return BOT.picks; },
    get left() { return Math.max(0, BOT.picks.length - BOT.idx); },
    get sent() { return BOT.sent; },
    get rejected() { return BOT.rejected; },
    get learned() { return Object.keys(loadLrn()).length; },
    get loaded() { return !!KB; }
  };
})();

})();
