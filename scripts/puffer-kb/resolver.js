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

if (typeof module !== 'undefined' && module.exports) module.exports = KR;
