(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 86062, (e) => {
  "use strict";
  let t = { plankton: { id: "plankton", name: "Plankton", score: 10, emoji: "\u{1FAE7}", blurb: "The answer everyone blurts out.", depth: 0.08, color: "var(--tier-plankton)" }, tooclever: { id: "tooclever", name: "Too Clever", score: 15, emoji: "\u{1F921}", blurb: "A famously \u201Cobscure\u201D pick. Everyone reaches for it.", depth: 0.18, color: "var(--tier-tooclever)" }, schooler: { id: "schooler", name: "Schooler", score: 30, emoji: "\u{1F41F}", blurb: "Solid \u2014 swims with the school.", depth: 0.36, color: "var(--tier-schooler)" }, rare: { id: "rare", name: "Rare", score: 60, emoji: "\u{1F991}", blurb: "Genuinely uncommon. Nice pull.", depth: 0.6, color: "var(--tier-rare)" }, deepcut: { id: "deepcut", name: "Deep Cut", score: 85, emoji: "\u{1F3EE}", blurb: "True obscurity. Few go this deep.", depth: 0.82, color: "var(--tier-deepcut)" }, krillion: { id: "krillion", name: "One in a Krillion", score: 100, emoji: "\u{1F31F}", blurb: "The designated gem. Trench floor.", depth: 0.97, color: "var(--tier-krillion)" } }, r = [{ min: 0, tier: "plankton", range: "0\u2013150", verdict: "Plankton. Plenty of ocean left down there." }, { min: 151, tier: "schooler", range: "151\u2013250", verdict: "Schooler. Swimming with the school." }, { min: 251, tier: "rare", range: "251\u2013350", verdict: "Rare. Below the thermocline. Nice." }, { min: 351, tier: "deepcut", range: "351\u2013449", verdict: "Deep cut. Seriously deep dive." }, { min: 450, tier: "krillion", range: "450+", verdict: "One in a krillion. Trench dweller. Absurd." }], l = Object.keys(t), i = [...l].map((e2) => t[e2]).sort((e2, t2) => t2.score - e2.score);
  e.s(["MAX_DAY_SCORE", 0, 700, "MISS_EMOJI", 0, "\u2B1B", "ROUNDS_PER_DAY", 0, 7, "SCORE_BANDS", 0, r, "TIERS", 0, t, "TIERS_BY_DEPTH", 0, i, "TIER_IDS", 0, l, "bandFor", 0, function(e2) {
    return [...r].reverse().find((t2) => e2 >= t2.min) ?? r[0];
  }, "tierScore", 0, function(e2) {
    return t[e2].score;
  }]);
}, 28551, 86968, 12260, 89910, (e) => {
  "use strict";
  var t = e.i(71645), r = e.i(40806);
  let l = "krill", i = [{ id: "krill", name: "The Krill", alt: "krill", sprite: "/tiers/krillion.png", goldSprite: "/tiers/krillion-gold.png", color: "#ff5d8f", blub: "blub!", poke: "roll", pokeMs: 950, unlockStreak: 0 }, { id: "schooler", name: "Schooler", alt: "schooler fish", sprite: "/tiers/schooler.png", goldSprite: "/tiers/schooler-gold.png", color: "#4de3ff", blub: "glub!", poke: "dart", pokeMs: 900, unlockStreak: 5 }, { id: "rare", name: "Rare Squid", alt: "rare squid", sprite: "/tiers/rare.png", goldSprite: "/tiers/rare-gold.png", color: "#ff5252", blub: "blorp!", poke: "jet", pokeMs: 1050, unlockStreak: 14 }, { id: "deepcut", name: "Deep Cut Angler", alt: "deep cut angler", sprite: "/tiers/deepcut.png", goldSprite: "/tiers/deepcut-gold.png", color: "#9d7bff", blub: "chomp!", poke: "chomp", pokeMs: 950, unlockStreak: 30 }, { id: "evil-krill", name: "Evil Krill", alt: "evil krill with a white body and a red eye", sprite: "/tiers/evil-krill-white-v2.png", goldSprite: "/tiers/evil-krill-gold-v2.png", color: "#ff303b", blub: "mwahaha!", poke: "roll", pokeMs: 950, unlockStreak: 45 }, { id: "hackmanite", name: "Hackmanite", alt: "luminous white mineral krill with faceted stone armor", sprite: "/tiers/hackmanite-v2.png", goldSprite: "/tiers/hackmanite-gold-v2.png", color: "#dfefee", blub: "glimmer!", poke: "roll", pokeMs: 950, unlockStreak: 60, pokeFx: { id: "glimmer", aura: "/buddy-fx/hackmanite-aura.webp", goldAura: "/buddy-fx/hackmanite-gold-aura.webp" } }, { id: "fossil-krill", name: "Fossil Krill", alt: "fossil krill made of floating reassembled bones", sprite: "/tiers/fossil-krill.png", goldSprite: "/tiers/fossil-krill-gold.png", color: "#e8cfa4", blub: "rattle!", poke: "roll", pokeMs: 950, unlockStreak: 75, pokeFx: { id: "haunt", aura: "/buddy-fx/fossil-aura.webp", goldAura: "/buddy-fx/fossil-gold-aura.webp" } }, { id: "mantis-shrimp", name: "Mantis Shrimp", alt: "orange tiger mantis shrimp with charcoal bands and teal claws", sprite: "/tiers/tiger-mantis.png", goldSprite: "/tiers/tiger-mantis-gold.png", color: "#ed9359", blub: "pow!", poke: "punch", pokeMs: 750, unlockStreak: 100, pokeFx: { id: "strike", aura: "/buddy-fx/mantis-aura.webp", goldAura: "/buddy-fx/mantis-gold-aura.webp" } }, { id: "leviathan", name: "Leviathan", alt: "teal leviathan krill with a luminous green eye", sprite: "/tiers/leviathan.png", goldSprite: "/tiers/leviathan-gold.png", color: "#b4f542", blub: "grrrblub!", poke: "roll", pokeMs: 950, unlockStreak: 150, pokeFx: { id: "maelstrom", aura: "/buddy-fx/leviathan-aura.webp", goldAura: "/buddy-fx/leviathan-gold-aura.webp" } }];
  function a(e2) {
    return i.some((t2) => t2.id === e2);
  }
  e.s(["DEFAULT_CHARACTER_ID", 0, l, "MASCOT_CHARACTERS", 0, i, "getMascotCharacter", 0, function(e2, t2 = Date.now()) {
    let l2 = i.find((t3) => t3.id === e2) ?? i[0], a2 = (0, r.seasonalKrillSprite)(l2.sprite, t2), n2 = (0, r.seasonalKrillSprite)(l2.goldSprite, t2);
    return a2 === l2.sprite && n2 === l2.goldSprite ? l2 : { ...l2, sprite: a2, goldSprite: n2 };
  }, "isMascotCharacterId", 0, a, "isMascotUnlocked", 0, function(e2, t2) {
    return 0 === e2.unlockStreak || t2 >= e2.unlockStreak;
  }], 86968);
  let n = "krillion-contrast", s = "krillion-clear-rejected-entry", o = "krillion-answer-corrections", d = "krillion-character", c = "krillion-low-power", u = "krillion-share-link", h = Object.freeze({ colorblindMode: false, lowPowerMode: false, clearRejectedEntry: false, answerCorrections: true, shareLink: false, character: l }), f = /* @__PURE__ */ new Set(), p = { ...h }, m = false, g = /* @__PURE__ */ new Set();
  function v(e2, t2, r2) {
    try {
      let l2 = globalThis.localStorage;
      if (!l2) return t2;
      let i2 = l2.getItem(e2);
      if ("1" === i2) return true;
      if ("0" === i2) return false;
      return g.has(e2) ? t2 : r2;
    } catch {
    }
    return t2;
  }
  function b(e2, t2) {
    try {
      let r2 = globalThis.localStorage;
      if (!r2) return;
      r2.setItem(e2, t2 ? "1" : "0"), g.delete(e2);
    } catch {
      g.add(e2);
    }
  }
  function y() {
    let e2 = { lowPowerMode: v(c, p.lowPowerMode, false), colorblindMode: v(n, p.colorblindMode, h.colorblindMode), clearRejectedEntry: v(s, p.clearRejectedEntry, h.clearRejectedEntry), answerCorrections: v(o, p.answerCorrections, h.answerCorrections), shareLink: v(u, p.shareLink, h.shareLink), character: (function(e3) {
      try {
        let t2 = globalThis.localStorage;
        if (!t2) return e3;
        let r2 = t2.getItem(d);
        if (a(r2)) return r2;
        return g.has(d) ? e3 : l;
      } catch {
      }
      return e3;
    })(p.character) };
    return p = e2, { ...e2 };
  }
  function k(e2) {
    "u" > typeof document && document.documentElement.classList.toggle("colorblind", e2);
  }
  function M() {
    for (let e2 of f) e2();
  }
  function x(e2) {
    (null === e2.key || e2.key === n || e2.key === s || e2.key === o || e2.key === u || e2.key === c || e2.key === d) && (null === e2.key ? g.clear() : g.delete(e2.key), k(y().colorblindMode), M());
  }
  function S(e2) {
    return f.add(e2), m || (window.addEventListener("storage", x), m = true), () => {
      f.delete(e2);
    };
  }
  let w = `00010${l}`;
  function T() {
    let e2 = y();
    return `${e2.colorblindMode ? "1" : "0"}${e2.clearRejectedEntry ? "1" : "0"}${e2.shareLink ? "1" : "0"}${e2.answerCorrections ? "1" : "0"}${e2.lowPowerMode ? "1" : "0"}${e2.character}`;
  }
  e.s(["getPreferences", 0, y, "getSelectedCharacter", 0, function() {
    return y().character;
  }, "setAnswerCorrections", 0, function(e2) {
    p = { ...y(), answerCorrections: e2 }, b(o, e2), M();
  }, "setCharacter", 0, function(e2) {
    p = { ...y(), character: e2 }, (function(e3) {
      try {
        let t2 = globalThis.localStorage;
        if (!t2) return;
        t2.setItem(d, e3), g.delete(d);
      } catch {
        g.add(d);
      }
    })(e2), M();
  }, "setClearRejectedEntry", 0, function(e2) {
    p = { ...y(), clearRejectedEntry: e2 }, b(s, e2), M();
  }, "setColorblindMode", 0, function(e2) {
    p = { ...y(), colorblindMode: e2 }, b(n, e2), k(e2), M();
  }, "setLowPowerMode", 0, function(e2) {
    p = { ...y(), lowPowerMode: e2 }, b(c, e2), M();
  }, "setShareLink", 0, function(e2) {
    p = { ...y(), shareLink: e2 }, b(u, e2), M();
  }, "shouldClearRejectedEntry", 0, function() {
    return y().clearRejectedEntry;
  }, "shouldPreviewAnswerCorrections", 0, function() {
    return y().answerCorrections;
  }, "subscribePreferences", 0, S, "usePreferences", 0, function() {
    let e2 = (0, t.useSyncExternalStore)(S, T, () => w);
    return (0, t.useMemo)(() => {
      let t2 = e2.slice(5);
      return { lowPowerMode: "1" === e2[4], colorblindMode: "1" === e2[0], clearRejectedEntry: "1" === e2[1], shareLink: "1" === e2[2], answerCorrections: "1" === e2[3], character: a(t2) ? t2 : l };
    }, [e2]);
  }], 12260), e.s(["createWorldRenderer", 0, function(e2, t2 = {}) {
    let r2, l2 = window.matchMedia("(prefers-reduced-motion: reduce)"), i2 = y().lowPowerMode, a2 = l2.matches, n2 = 0, s2 = true, o2 = true, d2 = false, c2 = null, u2 = null, h2 = 0, f2 = 0, p2 = 0, m2 = () => false, g2 = e2.closest(".ds-root") ?? e2, v2 = () => {
      g2.toggleAttribute("data-low-power", i2), g2.toggleAttribute("data-reduced-motion", a2);
    }, b2 = () => {
      let e3 = y().lowPowerMode;
      (e3 !== i2 || l2.matches !== a2) && (i2 = e3, a2 = l2.matches, n2++, s2 = true, o2 = true, v2());
    }, k2 = S(b2);
    function M2(e3) {
      var l3, n3, g3;
      if (c2 = null, d2 || document.hidden || !r2) return;
      (o2 || m2()) && (p2 = e3 + 1500), o2 = false;
      let v3 = 1e3 / Math.min((l3 = e3 < p2, n3 = i2, g3 = a2, l3 ? n3 || g3 ? 30 : 1 / 0 : g3 ? 2 : n3 ? 15 : 30), t2.maxFrameRate ?? 1 / 0);
      if (v3 !== f2 && (s2 = true), f2 = v3, s2 || null === u2 || e3 >= h2 - 0.5) {
        let t3 = null === u2 ? 0 : Math.min(0.1, (e3 - u2) / 1e3);
        h2 = s2 || null === u2 ? e3 + v3 : Math.max(e3, h2 + v3), u2 = e3, s2 = false, r2(e3, t3, a2 ? 0 : e3 / 1e3);
      }
      d2 || (c2 = requestAnimationFrame(M2));
    }
    l2.addEventListener("change", b2), v2();
    let x2 = () => {
      null !== c2 && cancelAnimationFrame(c2), c2 = null, u2 = null, s2 = true, o2 = true, d2 || document.hidden || !r2 || (c2 = requestAnimationFrame(M2));
    };
    return document.addEventListener("visibilitychange", x2), { get revision() {
      return n2;
    }, get reducedMotion() {
      return a2;
    }, get particleScale() {
      return a2 ? 0 : i2 ? 0.4 : 1;
    }, pixelRatio: (e3, t3) => {
      var r3;
      return Math.min(window.devicePixelRatio || 1, (r3 = i2) ? 1 : 2, Math.sqrt((r3 ? 15e5 : 83e5) / Math.max(1, e3 * t3)));
    }, invalidate() {
      s2 = true, o2 = true;
    }, start(e3, t3) {
      r2 = e3, m2 = t3, x2();
    }, destroy() {
      d2 = true, null !== c2 && cancelAnimationFrame(c2), k2(), l2.removeEventListener("change", b2), document.removeEventListener("visibilitychange", x2), g2.removeAttribute("data-low-power"), g2.removeAttribute("data-reduced-motion");
    } };
  }], 28551), e.s(["bindMascotTap", 0, function(e2, t2) {
    let r2 = (t3) => {
      let r3 = e2.ownerDocument.activeElement;
      0 === t3.button && r3?.matches("input.ds-input") && e2.closest(".ds-root")?.contains(r3) && t3.preventDefault();
    };
    return e2.addEventListener("pointerdown", r2), e2.addEventListener("mousedown", r2), e2.addEventListener("click", t2), () => {
      e2.removeEventListener("pointerdown", r2), e2.removeEventListener("mousedown", r2), e2.removeEventListener("click", t2);
    };
  }], 89910);
}, 48992, 66732, 81801, 57410, (e) => {
  "use strict";
  var t = e.i(40806), r = e.i(99363), l = e.i(28551), i = e.i(89910), a = e.i(86062);
  let n = "krillion-muted";
  class s {
    refs = 0;
    ac = null;
    sfxGain = null;
    muted;
    onMuteChange = [];
    gestureDocument = null;
    resumePromise = null;
    lifecycle = 0;
    clockSample = null;
    resumeStartedAt = null;
    onGesture = () => {
      this.unlock();
    };
    constructor() {
      let e2 = false;
      try {
        e2 = "1" === localStorage.getItem(n);
      } catch {
      }
      this.muted = e2, document.addEventListener("visibilitychange", () => {
        this.ac && (document.hidden ? this.suspend() : this.refs > 0 && this.resume());
      });
    }
    isMuted() {
      return this.muted;
    }
    subscribeMute(e2) {
      return this.onMuteChange.push(e2), () => {
        this.onMuteChange = this.onMuteChange.filter((t2) => t2 !== e2);
      };
    }
    toggleMuted() {
      this.muted = !this.muted;
      try {
        localStorage.setItem(n, this.muted ? "1" : "0");
      } catch {
      }
      for (let e2 of (this.sfxGain && (this.sfxGain.gain.value = 0.75 * !this.muted), this.muted || !(this.refs > 0) || document.hidden || (this.resetContext(), this.unlock()), this.onMuteChange)) e2();
    }
    acquire(e2) {
      0 === this.refs && this.lifecycle++, this.refs++, 1 === this.refs && this.armGestures(e2.ownerDocument), this.ac && !e2.ownerDocument.hidden && this.resume();
    }
    release() {
      this.refs--, this.refs <= 0 && (this.refs = 0, this.disarmGestures(), this.ac && this.suspend());
    }
    armGestures(e2) {
      this.gestureDocument !== e2 && (this.disarmGestures(), this.gestureDocument = e2, e2.addEventListener("pointerdown", this.onGesture, { capture: true, passive: true }), e2.addEventListener("pointerup", this.onGesture, { capture: true, passive: true }), e2.addEventListener("keydown", this.onGesture, { capture: true }));
    }
    disarmGestures() {
      this.gestureDocument && (this.gestureDocument.removeEventListener("pointerdown", this.onGesture, { capture: true }), this.gestureDocument.removeEventListener("pointerup", this.onGesture, { capture: true }), this.gestureDocument.removeEventListener("keydown", this.onGesture, { capture: true }), this.gestureDocument = null);
    }
    unlock() {
      if (this.refs <= 0 || document.hidden) return Promise.resolve(false);
      let e2 = performance.now();
      if (this.ac) {
        let t2 = this.ac.state, r2 = this.clockSample, l2 = "running" === t2 && r2 && this.ac.currentTime === r2.audio && e2 - r2.wall >= 1e3, i2 = "running" !== t2 && null !== this.resumeStartedAt && e2 - this.resumeStartedAt >= 1e3;
        ("closed" === t2 || l2 || i2) && this.resetContext();
      }
      if (!this.ac) {
        let e3 = window.AudioContext || window.webkitAudioContext;
        if (!e3) return Promise.resolve(false);
        try {
          this.ac = new e3(), this.sfxGain = this.ac.createGain(), this.sfxGain.gain.value = 0.75 * !this.muted, this.sfxGain.connect(this.ac.destination), this.ac.onstatechange = () => {
            this.clockSample = null;
          };
        } catch {
          return this.ac = null, this.sfxGain = null, Promise.resolve(false);
        }
      }
      return this.resume(true);
    }
    resetContext() {
      let e2 = this.ac;
      if (this.ac = null, this.resumePromise = null, this.resumeStartedAt = null, this.clockSample = null, this.sfxGain && (this.sfxGain.gain.value = 0), this.sfxGain = null, e2) {
        e2.onstatechange = null;
        try {
          e2.close().catch(() => {
          });
        } catch {
        }
      }
    }
    sampleClock(e2) {
      this.clockSample && this.clockSample.audio === e2.currentTime || (this.clockSample = { audio: e2.currentTime, wall: performance.now() }), this.resumeStartedAt = null;
    }
    resume(e2 = false) {
      let t2, r2 = this.ac;
      if (!r2) return Promise.resolve(false);
      let l2 = r2.state;
      if ("running" === l2) return this.sampleClock(r2), Promise.resolve(true);
      if ("closed" === l2) return Promise.resolve(false);
      if (this.clockSample = null, this.resumePromise && !e2) return this.resumePromise;
      this.resumeStartedAt ??= performance.now();
      try {
        t2 = r2.resume();
      } catch {
        return Promise.resolve(false);
      }
      let i2 = t2.then(() => {
        let e3 = this.ac === r2 && "running" === r2.state;
        return (e3 && this.sampleClock(r2), e3 && (this.refs <= 0 || document.hidden)) ? (this.suspend(), false) : e3;
      }).catch(() => false);
      return this.resumePromise = i2, i2.finally(() => {
        this.resumePromise === i2 && (this.resumePromise = null);
      }), i2;
    }
    async suspend() {
      this.clockSample = null, this.resumeStartedAt = null;
      let e2 = this.ac;
      if (e2 && "closed" !== e2.state) {
        try {
          await e2.suspend();
        } catch {
        }
        this.ac === e2 && this.refs > 0 && !document.hidden && (this.resumePromise && await this.resumePromise, this.ac === e2 && this.refs > 0 && !document.hidden && this.resume());
      }
    }
    async eventFromGesture(e2) {
      let t2 = this.lifecycle, r2 = performance.now(), l2 = this.unlock(), i2 = this.ac;
      !await l2 || this.ac !== i2 || !this.canEmit(t2) || performance.now() - r2 > 250 || this.emit(e2);
    }
    canEmit(e2) {
      return this.isActive(e2) && !!this.ac && "running" === this.ac.state;
    }
    isActive(e2) {
      return this.refs > 0 && this.lifecycle === e2 && !document.hidden && !this.muted && !!this.ac;
    }
    env(e2, t2, r2, l2, i2) {
      e2.gain.setValueAtTime(0, t2), e2.gain.linearRampToValueAtTime(l2, t2 + r2), e2.gain.exponentialRampToValueAtTime(1e-4, t2 + r2 + i2);
    }
    tone(e2) {
      if (!this.ac || !this.sfxGain) return;
      let { type: t2 = "sine", f0: r2, f1: l2, dur: i2 = 0.2, a: a2 = 5e-3, peak: n2 = 0.3, lp: s2, delay: o2 = 0 } = e2, d2 = this.ac.currentTime + o2, c2 = this.ac.createOscillator();
      c2.type = t2, c2.frequency.setValueAtTime(r2, d2), void 0 !== l2 && c2.frequency.exponentialRampToValueAtTime(Math.max(l2, 1), d2 + i2);
      let u2 = this.ac.createGain();
      this.env(u2, d2, a2, n2, i2);
      let h2 = c2;
      if (s2) {
        let e3 = this.ac.createBiquadFilter();
        e3.type = "lowpass", e3.frequency.value = s2, c2.connect(e3), h2 = e3;
      }
      h2.connect(u2), u2.connect(this.sfxGain), c2.start(d2), c2.stop(d2 + i2 + a2 + 0.05);
    }
    noise(e2) {
      if (!this.ac || !this.sfxGain) return;
      let { dur: t2 = 0.3, lp: r2 = 1200, hp: l2, peak: i2 = 0.25, a: a2 = 3e-3, delay: n2 = 0, sweepTo: s2 } = e2, o2 = this.ac.currentTime + n2, d2 = Math.ceil(this.ac.sampleRate * (t2 + 0.1)), c2 = this.ac.createBuffer(1, d2, this.ac.sampleRate), u2 = c2.getChannelData(0);
      for (let e3 = 0; e3 < d2; e3++) u2[e3] = 2 * Math.random() - 1;
      let h2 = this.ac.createBufferSource();
      h2.buffer = c2;
      let f2 = this.ac.createBiquadFilter();
      f2.type = "lowpass", f2.frequency.setValueAtTime(r2, o2), s2 && f2.frequency.exponentialRampToValueAtTime(s2, o2 + t2);
      let p2 = f2;
      if (h2.connect(f2), l2) {
        let e3 = this.ac.createBiquadFilter();
        e3.type = "highpass", e3.frequency.value = l2, f2.connect(e3), p2 = e3;
      }
      let m2 = this.ac.createGain();
      this.env(m2, o2, a2, i2, t2), p2.connect(m2), m2.connect(this.sfxGain), h2.start(o2), h2.stop(o2 + t2 + 0.1);
    }
    arp(e2, t2 = {}) {
      let { type: r2 = "triangle", step: l2 = 0.12, dur: i2 = 0.5, peak: a2 = 0.16, lp: n2 } = t2;
      e2.forEach((e3, t3) => this.tone({ type: r2, f0: e3, dur: i2, peak: a2, lp: n2, delay: t3 * l2 }));
    }
    event(e2) {
      let t2 = this.lifecycle, r2 = this.ac;
      if (this.isActive(t2) && r2) {
        if ("running" !== r2.state) {
          let l2 = performance.now();
          this.resume().then((i2) => {
            i2 && this.ac === r2 && this.canEmit(t2) && performance.now() - l2 <= 250 && this.emit(e2);
          });
          return;
        }
        this.emit(e2);
      }
    }
    emit(e2) {
      switch (e2) {
        case "submit":
        case "submit_soft":
          this.tone({ f0: 1150, dur: 0.16, a: 3e-3, peak: "submit_soft" === e2 ? 0.04 : 0.16 });
          break;
        case "reject":
          this.noise({ dur: 0.22, lp: 420, peak: 0.2 }), this.tone({ f0: 150, f1: 62, dur: 0.36, peak: 0.22, lp: 700 });
          break;
        case "tierline":
          this.tone({ type: "triangle", f0: 780, f1: 1560, dur: 0.07, peak: 0.13, lp: 2500 });
          break;
        case "sink":
          this.tone({ f0: 1150, dur: 0.7, a: 0.01, peak: 0.1 }), this.noise({ dur: 1.3, lp: 1400, sweepTo: 180, peak: 0.16 }), this.tone({ f0: 300, f1: 60, dur: 1.3, peak: 0.1 });
          break;
        case "land_small":
          this.tone({ f0: 140, f1: 70, dur: 0.25, peak: 0.28, lp: 600 }), this.noise({ dur: 0.14, lp: 500, peak: 0.1 });
          break;
        case "land_big":
          this.tone({ f0: 80, f1: 45, dur: 0.6, peak: 0.38 }), this.noise({ dur: 0.7, lp: 900, sweepTo: 200, peak: 0.18, delay: 0.02 }), this.tone({ type: "triangle", f0: 523, dur: 0.4, peak: 0.09, delay: 0.15 });
          break;
        case "spare":
          this.arp([523.25, 783.99], { type: "sine", step: 0.09, dur: 0.22, peak: 0.1 });
          break;
        case "category":
          this.noise({ dur: 0.35, lp: 900, sweepTo: 4200, hp: 400, peak: 0.07 }), this.tone({ type: "triangle", f0: 988, dur: 0.32, a: 4e-3, peak: 0.13, lp: 4e3, delay: 0.12 }), this.tone({ type: "triangle", f0: 1319, dur: 0.55, a: 4e-3, peak: 0.13, lp: 4e3, delay: 0.24 });
          break;
        case "krillion":
          this.tone({ f0: 60, f1: 40, dur: 1.2, peak: 0.34 }), this.arp([784, 988, 1175, 1568], { step: 0.13, dur: 0.7, peak: 0.15, lp: 3e3 }), this.noise({ dur: 1.4, lp: 2500, hp: 1200, peak: 0.05, delay: 0.3 });
          break;
        case "miss":
          this.tone({ f0: 220, f1: 52, dur: 0.7, peak: 0.24 }), this.noise({ dur: 0.5, lp: 400, peak: 0.14, delay: 0.05 });
          break;
        case "tick":
          this.tone({ f0: 880, dur: 0.07, peak: 0.16 }), this.tone({ f0: 880, dur: 0.05, peak: 0.06, delay: 0.12 });
          break;
        case "surface":
          this.noise({ dur: 1.6, lp: 300, sweepTo: 3e3, peak: 0.16 }), this.tone({ f0: 80, f1: 600, dur: 1.5, peak: 0.08 });
          break;
        case "blub": {
          let e3 = 0.85 + 0.45 * Math.random();
          this.tone({ f0: 260 * e3, f1: 720 * e3, dur: 0.13, peak: 0.22, lp: 2200 }), this.noise({ dur: 0.05, lp: 1800, hp: 700, peak: 0.05 });
          break;
        }
        case "descend":
        case "begin":
          this.noise({ dur: 1.1, lp: 2e3, sweepTo: 240, peak: 0.15 }), this.tone({ f0: 110, f1: 48, dur: 1.2, peak: 0.32 }), this.tone({ type: "triangle", f0: 784, dur: 0.5, peak: 0.12, lp: 3e3 }), this.tone({ type: "triangle", f0: 523, dur: 0.75, peak: 0.12, lp: 3e3, delay: 0.22 });
      }
    }
  }
  let o = null;
  function d() {
    return o || (o = new s()), o;
  }
  e.s(["getDescentAudio", 0, d, "playSfx", 0, function(e2) {
    d().eventFromGesture(e2);
  }], 66732);
  var c = e.i(86968), u = e.i(12260);
  let h = "ds-source-pending";
  function f(e2) {
    return e2.complete && e2.naturalWidth > 0;
  }
  function p(e2, t2, r2) {
    let l2 = 0, i2 = false, a2 = false, n2 = false, s2 = null;
    e2.classList.add(h);
    let o2 = e2.ownerDocument.createElement("img");
    function d2() {
      if (o2.src = r2, "function" == typeof o2.decode) try {
        o2.decode().catch(() => {
        });
      } catch {
      }
    }
    function c2(o3) {
      if (n2) return;
      l2 += 1, i2 = o3, a2 = true, s2?.(), s2 = null;
      let d3 = o3 ? r2 : t2;
      if (e2.getAttribute("src") !== d3 && e2.setAttribute("src", d3), !o3 || (e2.classList.add(h), f(e2))) return void e2.classList.remove(h);
      let c3 = l2;
      s2 = (function(e3, t3) {
        let r3 = false, l3 = (l4) => {
          r3 || (r3 = true, e3.removeEventListener("load", i3), e3.removeEventListener("error", a3), t3(l4));
        }, i3 = () => l3(true), a3 = () => l3(false);
        if (f(e3)) return l3(true), () => {
        };
        if (e3.addEventListener("load", i3), e3.addEventListener("error", a3), "function" == typeof e3.decode) try {
          e3.decode().then(() => l3(f(e3)), () => {
            e3.complete && l3(f(e3));
          });
        } catch {
        }
        return () => l3(false);
      })(e2, (t3) => {
        s2 = null, t3 && !n2 && i2 && l2 === c3 && e2.getAttribute("src") === r2 && e2.classList.remove(h);
      });
    }
    return o2.decoding = "async", d2(), { setGold: c2, setSources(e3, l3) {
      !n2 && (e3 !== t2 || l3 !== r2) && (t2 = e3, r2 = l3, d2(), a2 && c2(i2));
    }, destroy() {
      n2 = true, l2 += 1, s2?.(), s2 = null, o2.removeAttribute("src");
    } };
  }
  e.s(["createGoldSpriteController", 0, p], 81801);
  let m = ["celebrate", "faint", "sad", "roll", "dart", "jet", "chomp", "punch"], g = ["roll", "punch"], v = (e2) => {
    let t2 = e2.split(/\s+/);
    return m.filter((e3) => t2.includes(e3));
  };
  function b(e2, t2) {
    let l2, i2 = (0, u.getSelectedCharacter)(), a2 = (0, c.getMascotCharacter)(i2), n2 = null, s2 = false, o2 = p(e2, a2.sprite, a2.goldSprite);
    e2.alt = a2.alt, t2?.(a2);
    let d2 = (function(e3) {
      let t3 = e3.parentElement;
      if (!t3 || "u" < typeof MutationObserver) return { dress() {
      }, destroy() {
      } };
      let r2 = e3.ownerDocument, l3 = null, i3 = null, a3 = (e4) => {
        let t4 = r2.createElement("img");
        return t4.className = `ds-fx-twin ds-fx-${e4}`, t4.alt = "", t4.decoding = "async", t4.draggable = false, t4.setAttribute("aria-hidden", "true"), t4;
      }, n3 = (e4, t4) => {
        let l4 = r2.createElement("span");
        for (let i4 of (l4.className = `ds-fx ds-fx-${e4}`, l4.setAttribute("aria-hidden", "true"), t4)) l4.appendChild(r2.createElement("i")).className = i4;
        return l4;
      };
      function s3(r3) {
        if (!l3) return;
        let a4 = v(e3.className);
        for (let e4 of [l3.aura, l3.sheen]) e4.classList.remove(...m), r3 && e4.offsetWidth, e4.classList.add(...a4);
        r3 && a4.some((e4) => g.includes(e4)) && (t3.removeAttribute("data-fx-play"), t3.offsetWidth, t3.setAttribute("data-fx-play", ""), i3 && clearTimeout(i3), i3 = setTimeout(() => t3.removeAttribute("data-fx-play"), 1400));
      }
      let o3 = new MutationObserver((t4) => {
        let r3 = v(e3.className).join(" ");
        t4.some((e4) => v(e4.oldValue ?? "").join(" ") !== r3) && s3(true);
      });
      return o3.observe(e3, { attributes: true, attributeFilter: ["class"], attributeOldValue: true }), { dress(r3, i4) {
        let o4, d3, c2, u2, h3 = r3.pokeFx;
        if (!h3) {
          t3.removeAttribute("data-fx"), t3.removeAttribute("data-fx-gold"), t3.removeAttribute("data-fx-play");
          return;
        }
        l3 ??= (o4 = n3("back", ["ds-fx-a"]), d3 = n3("front", Array.from({ length: 3 }, () => "ds-fx-glint")), c2 = a3("aura"), u2 = a3("sheen"), t3.insertBefore(o4, e3), e3.after(c2, u2, d3), { back: o4, front: d3, aura: c2, sheen: u2 }), t3.setAttribute("data-fx", h3.id), t3.toggleAttribute("data-fx-gold", i4);
        let f3 = i4 ? h3.goldAura : h3.aura;
        l3.aura.getAttribute("src") !== f3 && l3.aura.setAttribute("src", f3), h3.sheen ? l3.sheen.getAttribute("src") !== h3.sheen && l3.sheen.setAttribute("src", h3.sheen) : l3.sheen.removeAttribute("src"), s3(false);
      }, destroy() {
        if (o3.disconnect(), i3 && clearTimeout(i3), l3) for (let e4 of Object.values(l3)) e4.remove();
        for (let e4 of (l3 = null, ["data-fx", "data-fx-gold", "data-fx-play"])) t3.removeAttribute(e4);
      } };
    })(e2), h2 = () => d2.dress(a2, l2 ?? s2);
    h2();
    let f2 = () => {
      let r2 = n2 ?? (0, u.getSelectedCharacter)(), l3 = (0, c.getMascotCharacter)(r2);
      (r2 !== i2 || l3.sprite !== a2.sprite || l3.goldSprite !== a2.goldSprite) && (i2 = r2, e2.alt = (a2 = l3).alt, o2.setSources(a2.sprite, a2.goldSprite), t2?.(a2), h2());
    }, b2 = (0, u.subscribePreferences)(f2), y2 = (0, r.subscribeKrillSeason)(f2);
    return { setGold(e3) {
      s2 = e3, o2.setGold(l2 ?? s2), h2();
    }, setSources: o2.setSources, current: () => a2, preview(e3, t3) {
      n2 = e3, l2 = null === e3 ? void 0 : t3, f2(), o2.setGold(l2 ?? s2), h2();
    }, destroy() {
      b2(), y2(), d2.destroy(), o2.destroy();
    } };
  }
  function y(e2, t2, r2) {
    return Math.max(8, Math.min(e2 < 700 ? 175 : 210, (r2 - t2) / 2));
  }
  e.s(["createMascotSpriteController", 0, b], 57410);
  let k = { plankton: "#8fa3c4", tooclever: "#ff9f43", schooler: "#4de3ff", rare: "#ff5252", deepcut: "#9d7bff", krillion: "#ffd166" };
  function M(e2, t2) {
    return e2.quip ?? (e2.tier ? t2?.blurbs?.[e2.tier] ?? a.TIERS[e2.tier].blurb : e2.rawAnswer ? t2?.missTyped ?? "never made it onto the reef." : t2?.missEmpty ?? "the clock beat you to it.");
  }
  let x = { world: "ocean", skyTop: "#81cbe8", skyFallback: ["#8fd0f0", "#d8f0ff"], sky: "/gen/optimized/v1/bg-sky.webp", bgTop: "/gen/optimized/v1/bg-top.webp", bgMid: "/gen/optimized/v1/bg-mid.webp", bgTrench: "/gen/optimized/v1/bg-trench.webp", floor: "/water-bg.webp", stops: [[0, "#1d5580"], [150, "#123a5e"], [350, "#0b1526"], [800, "#081020"], [1400, "#050a14"], [2600, "#03070f"], [5200, "#02050b"]], ambient: [[60, "light begins to fade", "L"], [200, "most sunlight stops here", "R"], [332, "deepest scuba dive ever &mdash; 332m", "R"], [385, "sperm whales hunt below here", "L"], [535, "emperor penguins dive this deep", "R"], [660, "pressure: 67x the surface", "L"], [800, "siphonophore drift zone", "R"], [1040, "THE MIDNIGHT ZONE", "L", true], [1240, "anglerfish territory", "R"], [1550, "sperm whales duel giant squid here", "L"], [1850, "giant squid territory", "R"], [2150, "colossal squid eyes: football-sized", "L"], [2500, "the water is 2&deg;C and utterly black", "R"], [3e3, "THE ABYSSAL ZONE", "L", true], [3800, "the Titanic rests here &mdash; 3,800m", "R"], [4400, "cusk eels patrol the plain", "L"], [4900, "the abyssal plain stretches out", "R"], [5500, "deeper than most submarines survive", "L"], [6e3, "THE HADAL ZONE", "R", true], [6500, "named for Hades. fitting.", "L"], [7e3, "the trench floor &mdash; a perfect dive ends here", "R", true]], snow: ["200,220,255", "220,235,255"], particle: "200,235,255", sparkle: "#4de3ff", copy: { promptWord: "PROMPT", surfaceLabel: "SURFACE", completeLabel: "DIVE COMPLETE", hint: "&#9660; rarer answers sink deeper &#9660;", sinkVerb: "sink", unit: "m" } };
  e.s(["OCEAN_THEME", 0, x, "createDescentEngine", 0, function(e2, n2 = {}) {
    let s2 = n2.theme ?? x, o2 = "cinema" === s2.world, c2 = s2.copy, u2 = e2.clientWidth || innerWidth, h2 = e2.clientHeight || innerHeight, f2 = 0, p2 = 0, m2 = 0, g2 = 0, v2 = () => -f2, M2 = () => u2 + f2 + p2, S = () => -m2, w = () => h2 + m2 + g2, T = () => u2 / 2 - 24 * (u2 < 700), L = u2 < 700 ? 175 : 210, C = () => (h2 / 2 - L) / 2, E = (0, l.createWorldRenderer)(e2), R = (0, r.watchSeasonalKrillImages)(e2), A = E.revision, P = E.pixelRatio(u2, h2), $ = (e10, t2, r2) => e10 + (t2 - e10) * r2, q = (e10, t2) => e10 + Math.random() * (t2 - e10), I = (e10) => e10 < 0.5 ? 4 * e10 * e10 * e10 : 1 - Math.pow(-2 * e10 + 2, 3) / 2, G = (e10) => 1 - Math.pow(1 - e10, 3);
    e2.innerHTML = `
    <div class="ds-stage">
      <canvas class="ds-sea"></canvas>
      <div class="ds-world">
        <div class="ds-surface">
          <div class="ds-title"></div>
          <div class="ds-tagline"></div>
          <div class="ds-subline"></div>
        </div>
        <img class="ds-floor" src="${s2.floor}" alt="">
      </div>
      <canvas class="ds-fore"></canvas>
      <div class="ds-dim"></div>
      <div class="ds-vignette"></div>
      <div class="ds-edge"></div>
      <div class="ds-flash"></div>
      <div class="ds-hud">
        <div class="ds-pod ds-px"><div class="label">DEPTH</div><div class="ds-depth-num">0m</div></div>
        <div class="ds-hud-mid"><div class="ds-dots"></div><div class="ds-prompt-count">SURFACE</div></div>
        <div class="ds-pod ds-px ds-score-pod"><div class="label">SCORE</div><div class="ds-score-num">0</div></div>
      </div>
      <div class="ds-mascot" title="a friend">
        <span class="ds-mascot-sprite">
          <img src="/tiers/krillion.png" alt="krill">
        </span>
        <span class="ds-blub">blub!</span>
      </div>
      <div class="ds-crt"></div>
      <button class="ds-mute" type="button" aria-label="toggle sound"></button>
    </div>`;
    let D = e2.querySelector(".ds-stage"), F = e2.querySelector(".ds-sea");
    n2.steadyBackdrop && e2.insertBefore(F, D);
    let O = e2.querySelector(".ds-fore"), W = F.getContext("2d"), H = O.getContext("2d"), j = e2.querySelector(".ds-world"), N = e2.querySelector(".ds-dim"), B = e2.querySelector(".ds-edge"), _ = e2.querySelector(".ds-flash"), K = e2.querySelector(".ds-crt"), z = e2.querySelector(".ds-mascot"), V = z.querySelector("img"), U = (e10, t2) => {
      let r2 = parseInt(e10.slice(1), 16);
      return `rgba(${r2 >> 16 & 255}, ${r2 >> 8 & 255}, ${255 & r2}, ${t2})`;
    }, Y = b(V, (t2) => {
      z.style.setProperty("--dsm-color", t2.color), z.style.setProperty("--dsm-glow", U(t2.color, 0.7)), z.style.setProperty("--dsm-shadow", U(t2.color, 0.45)), e2.querySelector(".ds-blub").textContent = t2.blub;
    }), X = e2.querySelector(".ds-depth-num"), Z = e2.querySelector(".ds-score-num"), J = e2.querySelector(".ds-dots"), Q = e2.querySelector(".ds-prompt-count");
    {
      let t2 = e2.querySelector(".ds-title");
      if ("KRILLION".split("").forEach((e10, r2) => {
        let l2 = document.createElement("span");
        l2.textContent = e10, l2.style.animationDelay = 0.18 * r2 + "s", t2.appendChild(l2);
      }), e2.querySelector(".ds-surface").style.top = "-336px", e2.querySelector(".ds-tagline").textContent = n2.tagline ?? "THE DAILY DIVE", e2.querySelector(".ds-subline").textContent = n2.subline ?? "7 prompts \xB7 25 seconds each \xB7 rarer answers sink deeper", n2.surfaceNote) {
        let t3 = document.createElement("div");
        t3.className = "ds-surface-note", t3.textContent = n2.surfaceNote, e2.querySelector(".ds-surface").appendChild(t3);
      }
      e2.querySelector(".ds-floor").style.top = "14020px";
      for (let e10 = 0; e10 < 7; e10++) J.appendChild(document.createElement("i"));
    }
    let ee = false;
    function et() {
      ee = true, E.invalidate();
    }
    function er() {
      ee = false, u2 = e2.clientWidth || innerWidth, h2 = e2.clientHeight || innerHeight;
      let t2 = e2.getBoundingClientRect();
      f2 = Math.max(0, Math.round(t2.left)), m2 = Math.max(0, Math.round(t2.top)), p2 = Math.max(0, Math.round(innerWidth - t2.right)), g2 = Math.max(0, Math.round(innerHeight - t2.bottom)), P = E.pixelRatio(M2(), w()), O.width !== Math.floor(u2 * P) && (O.width = u2 * P), O.height !== Math.floor(h2 * P) && (O.height = h2 * P), O.style.width = u2 + "px", O.style.height = h2 + "px", H.setTransform(P, 0, 0, P, 0, 0), F.width !== Math.floor(M2() * P) && (F.width = M2() * P), F.height !== Math.floor(w() * P) && (F.height = w() * P), F.style.width = M2() + "px", F.style.height = w() + "px", F.style.left = v2() + "px", F.style.top = S() + "px", W.setTransform(P, 0, 0, P, f2 * P, m2 * P), (function() {
        let e10 = M2() * w() / 304500, t3 = Math.round(70 * E.particleScale * Math.min(e10, 2.4)), r2 = Math.round(26 * E.particleScale * Math.min(e10, 2.4));
        tg.length = Math.min(tg.length, t3), tv.length = Math.min(tv.length, r2);
        for (let e11 = tg.length; e11 < t3; e11++) tg.push({ x: v2() + Math.random() * M2(), y: S() + Math.random() * w(), par: 0.35 + 0.5 * Math.random(), r: 0.6 + 1.4 * Math.random(), a: 0.12 + 0.25 * Math.random(), ph: 9 * Math.random() });
        for (let e11 = tv.length; e11 < r2; e11++) tv.push({ x: v2() + Math.random() * M2(), y: S() + Math.random() * w(), par: 1.15 + 0.45 * Math.random(), r: 1 + 1.8 * Math.random(), a: 0.18 + 0.3 * Math.random(), ph: 9 * Math.random() });
      })();
    }
    addEventListener("resize", et);
    let el = new ResizeObserver(() => {
      (e2.clientWidth !== u2 || e2.clientHeight !== h2) && et();
    });
    el.observe(e2);
    let ei = "function" == typeof getComputedStyle && getComputedStyle(e2).fontFamily || "monospace", ea = d();
    ea.acquire(e2);
    let en = e2.querySelector(".ds-mute"), es = '<path d="M2 6h3l4-4v12l-4-4H2z"/>', eo = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${es}<rect x="11" y="6" width="2" height="4"/><rect x="15" y="3" width="2" height="10"/></svg>`, ed = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${es}<rect x="11" y="5" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/><rect x="15" y="9" width="2" height="2"/><rect x="15" y="5" width="2" height="2"/><rect x="11" y="9" width="2" height="2"/></svg>`, ec = () => {
      let e10 = ea.isMuted();
      en.innerHTML = e10 ? ed : eo, en.setAttribute("aria-label", e10 ? "turn sound on" : "turn sound off"), en.setAttribute("aria-pressed", e10 ? "true" : "false"), en.classList.toggle("off", e10);
    };
    ec();
    let eu = ea.subscribeMute(ec), eh = () => ea.toggleMuted();
    en.addEventListener("click", eh);
    let ef = -1, ep = -45, em = -45, eg = -45, ev = -45, eb = (e10) => {
      ep = em = eg = ev = e10;
    }, ey = (e10) => (e10 - eg) * 2 + h2 / 2, ek = [], eM = (e10, t2, r2, l2) => ek.push({ t0: performance.now(), dur: e10, ease: t2, upd: r2, done: l2 }), ex = "intro", eS = 0, ew = 0, eT = 0, eL = 0, eC = 0, eE = false, eR = null, eA = null, eP = 0, e$ = 0, eq = null, eI = false, eG = [], eD = (e10, t2) => eG.push(setTimeout(e10, t2));
    function eF() {
      Array.from(J.children).forEach((e10, t2) => {
        e10.className = t2 < eS ? "done" : t2 === eS && "intro" !== ex && eS < 7 ? "cur" : "";
      }), Q.textContent = "intro" === ex ? c2.surfaceLabel : eS >= 7 ? c2.completeLabel : c2.promptWord + " " + Math.min(eS + 1, 7) + " OF 7";
    }
    function eO(e10, t2) {
      let r2 = eT;
      eT = e10;
      let l2 = t2 ? 1100 : 700, i2 = performance.now(), a2 = (n3) => {
        if (eI) return;
        let s3 = Math.min((n3 - i2) / l2, 1), o3 = 1 - Math.pow(1 - s3, 4);
        Z.textContent = String(Math.round(r2 + (e10 - r2) * (t2 && o3 < 0.9 ? 1.06 * o3 : o3))), s3 < 1 ? requestAnimationFrame(a2) : (Z.textContent = String(e10), t2 && (Z.classList.add("slam"), setTimeout(() => Z.classList.remove("slam"), 520)));
      };
      requestAnimationFrame(a2);
    }
    for (let [e10, t2, r2, l2] of s2.ambient) {
      let i2 = document.createElement("div");
      i2.className = "ds-amb " + r2 + (l2 ? " major" : ""), i2.innerHTML = "L" === r2 ? '<span class="dash">\u2500\u2500</span> ' + t2 : t2 + ' <span class="dash">\u2500\u2500</span>', i2.style.top = 2 * e10 - 9 + "px", j.appendChild(i2);
    }
    function eW(e10 = false) {
      if (eq) {
        for (let t2 of eq) if (e10) t2.el.remove();
        else {
          let e11 = t2.el;
          e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
        }
        eq = null;
      }
    }
    function eH(t2, r2, l2, i2 = 0) {
      eA?.remove();
      let a2 = document.createElement("div");
      a2.className = "ds-card ds-px", a2.style.top = 2 * l2 + "px", i2 && (a2.style.animationDelay = i2 + "s"), a2.innerHTML = `<div class="rnd">${c2.promptWord} ${t2 + 1} OF 7</div><div class="prompt"></div><div class="hint">${c2.hint}</div>`, a2.querySelector(".prompt").textContent = r2, j.appendChild(a2), eA = a2;
      let n3 = e2.parentElement?.querySelector(".ds-dock");
      return L = y(u2, a2.offsetHeight, n3?.offsetTop ?? h2), a2;
    }
    function ej(e10, r2) {
      if (e10.tier && eq) for (let t2 of eq) t2.tier === e10.tier && (t2.el.style.transition = "opacity .5s", t2.el.style.opacity = "0");
      let l2 = document.createElement("div"), i2 = e10.tier ? `var(--tier-${e10.tier})` : "var(--tier-miss)";
      return l2.className = "ds-landed" + (e10.tier ? "" : " miss"), l2.style.top = 2 * r2 + "px", l2.style.setProperty("--tc", i2), l2.innerHTML = (e10.tier ? `<img class="icon" src="${(0, t.seasonalKrillSprite)(`/tiers/${e10.tier}.png`)}" alt="">` : "") + `<div class="tname">${e10.tier ? a.TIERS[e10.tier].name.toUpperCase() : "NOTHING LANDED"}</div><div class="tans"></div><div class="tpts"><b>+${e10.points} PTS</b>${e10.points > 0 ? ` &middot; ${c2.sinkVerb} ${(10 * e10.points).toLocaleString()}${c2.unit}` : ""}</div><div class="tsub"></div>`, l2.querySelector(".tans").textContent = e10.answerText ? `\u201C${e10.answerText}\u201D` : "\u2014", l2.querySelector(".tsub").textContent = e10.sub, j.appendChild(l2), l2;
    }
    function eN() {
      D.classList.remove("ds-shake"), D.offsetWidth, D.classList.add("ds-shake");
    }
    function eB() {
      K.classList.remove("zap"), K.offsetWidth, K.classList.add("zap");
    }
    function e_(e10, t2, r2) {
      let l2 = 0, i2 = () => {
        _.style.transition = "none", _.style.background = e10, _.style.opacity = ".42", requestAnimationFrame(() => requestAnimationFrame(() => {
          _.style.transition = "opacity " + r2 + "ms ease-out", _.style.opacity = "0";
        })), ++l2 < t2 && eD(i2, 2.1 * r2);
      };
      i2();
    }
    function eK(e10, t2, r2) {
      let l2 = r2 || 66;
      N.style.background = `radial-gradient(circle at calc(${e10}px + var(--kr-ad-left, 0px)) calc(${t2}px + var(--kr-ad-top, 0px)), transparent ${l2}px, rgba(2,4,10,.72) ${l2 + 90}px, rgba(2,4,10,.96) ${l2 + 260}px)`;
    }
    let ez = null, eV = null, eU = 0, eY = null, eX = null, eZ = null, eJ = false;
    function eQ(e10) {
      if (eJ = true, Y.setGold(true), z.classList.add("gold"), !e10) {
        z.classList.remove("gilding"), z.offsetWidth, z.classList.add("gilding"), eD(() => z.classList.remove("gilding"), 1200), te(tx, tS, "#ffd166", 16, 0.7);
        for (let e11 = 0; e11 < 12; e11++) {
          var t2, r2;
          t2 = tx + q(-18, 18), r2 = tS + q(-18, 18), e3.length > 250 || e3.push({ x: t2, d: e8(r2), vx: q(-24, 24), vd: q(-8, 20) / 2, r: 1.6 + 2.6 * Math.random(), life: 0.5 + 0.7 * Math.random(), t: 0, color: ["#ffd166", "#ffe9a8", "#ff5d8f", "#4de3ff"][4 * Math.random() | 0] });
        }
      }
    }
    function e0() {
      eJ = false, Y.setGold(false), z.classList.remove("gold", "gilding");
    }
    function e1() {
      eZ = null, z.classList.remove("perched");
    }
    let e22 = { plankton: { dur: 3400, ease: (e10) => -(Math.cos(Math.PI * e10) - 1) / 2 }, tooclever: { dur: 3e3, ease: I }, schooler: { dur: 3e3, ease: I }, rare: { dur: 3400, ease: I }, deepcut: { dur: 4300, ease: I }, krillion: { dur: 4600, ease: I } };
    function e5(e10, t2) {
      V.classList.remove("celebrate", "faint", "sad", "roll", "dart", "jet", "chomp", "punch"), V.offsetWidth, e10 && V.classList.add(e10), clearTimeout(tC), e10 && t2 && (tC = setTimeout(() => V.classList.remove(e10), t2));
    }
    let e4 = [], e3 = [], e6 = [], e8 = (e10) => eg + (e10 - h2 / 2) / 2;
    function e7(e10, t2, r2, l2) {
      e4.length > 90 || e4.push({ x: e10 + q(-3, 3), d: e8(t2), r: r2, vd: 14 + 18 * Math.random(), wob: 9 * Math.random(), life: 4, col: l2 || s2.particle });
    }
    function e9(e10, t2) {
      e7(e10, t2, 1.2 + 1.8 * Math.random(), "143,163,196");
      let r2 = e4[e4.length - 1];
      r2 && (r2.vd = 5 + 6 * Math.random());
    }
    function te(e10, t2, r2, l2, i2) {
      let a2 = e8(t2);
      for (let t3 = 0; t3 < l2 && e3.length < 260; t3++) {
        let t4 = Math.random() * Math.PI * 2, l3 = (30 + 130 * Math.random()) * i2;
        e3.push({ x: e10, d: a2, vx: Math.cos(t4) * l3, vd: Math.sin(t4) * l3 / 2, r: 1.5 + 2.5 * Math.random(), life: 0.6 + 0.8 * Math.random(), t: 0, color: r2 });
      }
    }
    function tt(e10, t2, r2) {
      let l2 = e8(t2);
      for (let t3 = 0; t3 < r2 && e6.length < 30; t3++) {
        let t4 = Math.random() * Math.PI * 2, r3 = q(6, 60);
        e6.push({ x: e10, d: l2, vx: Math.cos(t4) * r3, vd: Math.sin(t4) * r3 / 2, r: q(12, 44), life: q(1.2, 2.2), t: 0 });
      }
    }
    let tr = (e10) => {
      let t2 = new Image();
      return t2.src = e10, t2;
    }, tl = s2.skyTop, ti = tr(s2.sky), ta = s2.sky === x.sky ? tr("/gen/optimized/v1/bg-sky-upper-clean.webp") : null, tn = tr(s2.bgTop), ts = tr(s2.bgMid), to = tr(s2.bgTrench), td = tr((0, t.seasonalKrillSprite)("/tiers/krillion.png")), tc = (0, r.subscribeKrillSeason)(() => {
      td.src = (0, t.seasonalKrillSprite)("/tiers/krillion.png"), E.invalidate();
    }), tu = tr("/tiers/schooler.png"), th = s2.stops, tf = (e10) => [parseInt(e10.slice(1, 3), 16), parseInt(e10.slice(3, 5), 16), parseInt(e10.slice(5, 7), 16)];
    function tp(e10) {
      if (e10 <= th[0][0]) return th[0][1];
      for (let t2 = 0; t2 < th.length - 1; t2++) {
        let [r2, l2] = th[t2], [i2, a2] = th[t2 + 1];
        if (e10 <= i2) {
          let t3 = (e10 - r2) / (i2 - r2), n3 = tf(l2), s3 = tf(a2);
          return `rgb(${Math.round($(n3[0], s3[0], t3))},${Math.round($(n3[1], s3[1], t3))},${Math.round($(n3[2], s3[2], t3))})`;
        }
      }
      return th[th.length - 1][1];
    }
    let tm = (e10, t2) => tp(e10).replace("rgb(", "rgba(").replace(")", `,${t2})`), tg = [], tv = [];
    function tb(e10, t2, r2, l2) {
      if (!e10.complete || !e10.naturalWidth) return;
      let i2 = ey(t2), a2 = ey(r2);
      if (a2 < S() - 60 || i2 > h2 + g2 + 60) return;
      let n3 = M2() * e10.naturalHeight / e10.naturalWidth;
      W.save(), W.globalAlpha = l2, W.beginPath(), W.rect(v2(), i2, M2(), a2 - i2), W.clip();
      let s3 = i2 + Math.floor(Math.max(0, S() - i2) / n3) * n3;
      for (let t3 = s3; t3 < Math.min(a2, h2 + g2); t3 += n3) W.drawImage(e10, v2(), t3, M2(), n3 + 1);
      if (W.restore(), W.globalAlpha = 1, i2 > S() - 150 && i2 < h2 + g2) {
        let e11 = W.createLinearGradient(0, i2, 0, i2 + 150);
        e11.addColorStop(0, tm(t2, l2)), e11.addColorStop(1, tm(t2, 0)), W.fillStyle = e11, W.fillRect(v2(), i2, M2(), 150);
      }
      if (a2 > S() && a2 < h2 + g2 + 150) {
        let e11 = W.createLinearGradient(0, a2 - 150, 0, a2);
        e11.addColorStop(0, tm(r2, 0)), e11.addColorStop(1, tm(r2, l2)), W.fillStyle = e11, W.fillRect(v2(), a2 - 150, M2(), 150);
      }
    }
    function ty(e10, t2, r2, l2, i2) {
      e10.beginPath(), e10.ellipse(t2, r2, l2, 0.45 * l2, 0, 0, 7), e10.moveTo(t2 - i2 * l2, r2), e10.lineTo(t2 - i2 * l2 * 1.7, r2 - 0.5 * l2), e10.lineTo(t2 - i2 * l2 * 1.7, r2 + 0.5 * l2), e10.closePath(), e10.fill();
    }
    let tk = [];
    for (let t2 = 0; t2 < 4; t2++) tk.push({ x: Math.random() * (e2.clientWidth || 375), dOff: q(-180, 180), sp: q(14, 34) * (0.5 > Math.random() ? -1 : 1), s: q(7, 14), ph: 9 * Math.random() });
    let tM = (e10, t2) => {
      let r2 = ey(e10);
      return r2 > -t2 && r2 < h2 + t2;
    }, tx = -120, tS = 300, tw = 0, tT = 0, tL = 0, tC = null, tE = (0, i.bindMascotTap)(z, () => {
      let t2 = Y.current();
      ea.event("blub"), e5(t2.poke, t2.pokeMs);
      let r2 = e2.querySelector(".ds-blub");
      r2.classList.remove("show"), r2.offsetWidth, r2.classList.add("show");
      for (let e10 = 0; e10 < 6; e10++) e7(tx + q(-16, 26), tS - 16, 1 + 3 * Math.random());
      te(tx, tS, eJ ? "#ffd166" : t2.color, 10, 0.5);
    }), tR = 0, tA = (t2) => {
      let r2 = performance.now();
      !E.reducedMotion && eg > 550 && r2 - tR > 50 && e3.length < 250 && (tR = r2, E.invalidate(), e3.push({ x: t2.clientX - e2.getBoundingClientRect().left + q(-6, 6), d: e8(t2.clientY - e2.getBoundingClientRect().top) + q(-4, 4), vx: q(-14, 14), vd: q(-10, 10) / 2, r: 1.6, life: 0.9, t: 0, color: s2.sparkle }));
    };
    return e2.addEventListener("pointermove", tA), er(), eb(-45), eF(), E.start(function(t2, r2, l2) {
      if (eI) return;
      A !== E.revision && (A = E.revision, et());
      let i2 = C();
      if (ee && er(), eA && ("round" === ex || "descend" === ex)) {
        let t3 = e2.parentElement?.querySelector(".ds-dock");
        L = y(u2, eA.offsetHeight, t3?.offsetTop ?? h2);
      }
      let a2 = C() - i2;
      a2 && (em += a2, eg += a2, ev += a2, "round" === ex && (ep += a2));
      for (let e10 = ek.length - 1; e10 >= 0; e10--) {
        let r3 = ek[e10], l3 = (t2 - r3.t0) / r3.dur;
        l3 >= 1 ? (r3.upd(r3.ease(1)), ek.splice(e10, 1), r3.done?.()) : r3.upd(r3.ease(Math.max(0, l3)));
      }
      em += (ep - em) * (1 - Math.exp(-6 * r2)), ev = eg, eg = em + (E.reducedMotion ? 0 : 2.2 * Math.sin(0.45 * l2)), j.style.transform = `translate3d(0,${h2 / 2 - 2 * eg}px,0)`;
      let n3 = Math.round(ew).toLocaleString() + c2.unit;
      X.textContent !== n3 && (X.textContent = n3), e2.querySelector(".ds-vignette").style.opacity = Math.min(0.72, 0.25 + Math.max(0, eg) / 2400).toFixed(3), (function(e10, t3) {
        let r3 = eg - h2 / 4, l3 = eg + h2 / 4, i3 = W.createLinearGradient(0, 0, 0, h2);
        i3.addColorStop(0, tp(Math.max(0, r3))), i3.addColorStop(0.5, tp(Math.max(0, eg))), i3.addColorStop(1, tp(Math.max(0, l3))), W.fillStyle = i3, W.fillRect(v2(), S(), M2(), w()), tb(tn, 40, 470, 0.45), tb(ts, 480, 2620, 0.5), tb(to, 2950, 7060, 0.55);
        let a3 = ey(0);
        if (a3 > -40) {
          if (ti.complete && ti.naturalWidth) {
            let e11 = M2() * ti.naturalHeight / ti.naturalWidth, t4 = a3 + 6 - e11;
            if (t4 > S() && (W.fillStyle = tl, W.fillRect(v2(), S(), M2(), t4 - S() + 1)), W.drawImage(ti, v2(), t4, M2(), e11), ta?.complete && ta.naturalWidth) {
              let e12 = M2() / ta.naturalWidth, r4 = t4 - (ta.naturalHeight - 136) * e12;
              t4 + 136 * e12 > S() && W.drawImage(ta, v2(), r4, M2(), ta.naturalHeight * e12);
            }
          } else {
            let e11 = W.createLinearGradient(0, a3 - 400, 0, a3);
            e11.addColorStop(0, s2.skyFallback[0]), e11.addColorStop(1, s2.skyFallback[1]), W.fillStyle = e11, W.fillRect(v2(), S(), M2(), Math.max(0, a3 - S()));
          }
          if (o2) {
            let t4 = (t5) => a3 + 1.6 * Math.sin(4e-3 * t5 + 0.35 * e10) + 7 * Math.sin(t5 % 56 / 56 * Math.PI);
            W.beginPath(), W.moveTo(v2(), a3);
            for (let e11 = v2(); e11 <= v2() + M2(); e11 += 4) W.lineTo(e11, t4(e11));
            W.lineTo(v2() + M2(), a3 + 40), W.lineTo(v2(), a3 + 40), W.closePath(), W.fillStyle = tp(0), W.fill(), W.fillStyle = "rgba(20,8,16,0.35)";
            for (let r4 = v2(); r4 <= v2() + M2() + 56; r4 += 56) {
              let l4 = r4 + 2 * Math.sin(0.35 * e10);
              W.fillRect(l4 - 2, t4(r4), 4, 26);
            }
            W.beginPath();
            for (let e11 = v2(); e11 <= v2() + M2(); e11 += 4) {
              let r4 = t4(e11);
              e11 === v2() ? W.moveTo(e11, r4) : W.lineTo(e11, r4);
            }
            W.strokeStyle = "rgba(255,209,102,.75)", W.lineWidth = 2, W.stroke();
          } else {
            W.beginPath(), W.moveTo(v2(), a3);
            for (let t4 = v2(); t4 <= v2() + M2(); t4 += 8) W.lineTo(t4, a3 + 3 * Math.sin(0.02 * t4 + 1.6 * e10) + 2.4 * Math.sin(0.011 * t4 - e10));
            W.lineTo(v2() + M2(), a3 + 30), W.lineTo(v2(), a3 + 30), W.closePath(), W.fillStyle = tp(0), W.fill(), W.beginPath();
            for (let t4 = v2(); t4 <= v2() + M2(); t4 += 8) {
              let r4 = a3 + 3 * Math.sin(0.02 * t4 + 1.6 * e10) + 2.4 * Math.sin(0.011 * t4 - e10);
              t4 === v2() ? W.moveTo(t4, r4) : W.lineTo(t4, r4);
            }
            W.strokeStyle = "rgba(232,241,255,.6)", W.lineWidth = 2, W.stroke();
          }
        }
        let n4 = (eg - ev) * 2;
        for (let r4 of tg) r4.y -= n4 * r4.par - 7.2 * t3, r4.x += 9 * Math.sin(0.6 * e10 + r4.ph) * t3, r4.y > h2 + g2 + 10 && (r4.y -= w() + 20), r4.y < S() - 10 && (r4.y += w() + 20), r4.x > v2() + M2() + 10 && (r4.x = v2() - 10), r4.x < v2() - 10 && (r4.x = v2() + M2() + 10), W.fillStyle = `rgba(${s2.snow[0]},${r4.a})`, W.fillRect(r4.x, r4.y, r4.r, r4.r);
        !(function(e11, t4, r4) {
          if (o2) return (function(e12, t5, r5) {
            if (tM(85, 80)) for (let r6 = 0; r6 < 7; r6++) {
              let i5 = (20 * t5 + 62 * r6 + r6 * r6 * 9) % (u2 + 320) - 160, a5 = ey(85) + 14 * Math.sin(1.6 * t5 + r6) + r6 % 3 * 15;
              l5 = 0.35 * Math.sin(2 * t5 + 2 * r6), e12.save(), e12.translate(i5, a5), e12.rotate(l5), e12.fillStyle = "rgba(255,159,67,0.8)", e12.fillRect(-7, -0.55 * 7, 14, 1.1 * 7), e12.fillStyle = "rgba(90,40,20,0.85)", e12.fillRect(3.15, -0.55 * 7, 2, 1.1 * 7), e12.fillStyle = tp(Math.max(0, eg)), e12.fillRect(-9, -2, 3, 4), e12.fillRect(6, -2, 3, 4), e12.restore();
            }
            if (tM(800, 120)) for (let r6 = 0; r6 < 22; r6++) {
              let l6 = 0.12 * u2 + 0.034 * u2 * r6, i5 = ey(800) + 22 * Math.sin(0.7 * t5 + 0.55 * r6), a5 = 0.25 + 0.2 * Math.sin(3 * t5 + r6);
              e12.fillStyle = `rgba(255,209,102,${Math.max(0.06, a5)})`, e12.fillRect(l6 - 1, i5 - 1, 2.4, 2.4);
            }
            if (tM(980, 80)) for (let r6 = 0; r6 < 5; r6++) {
              let s3 = (12 * t5 + 130 * r6) % (u2 + 220) - 110, o3 = ey(980) + 20 * Math.sin(t5 + 2 * r6) + 9 * r6;
              var l5, i4, a4, n5 = 2 * t5 + r6;
              e12.save(), e12.translate(s3, o3), e12.scale(-1, 1), e12.rotate(0.2 * Math.sin(n5)), e12.fillStyle = "rgba(18,8,24,0.9)", e12.fillRect(-14, -5, 28, 10), e12.fillStyle = "rgba(122,74,134,0.55)", e12.fillRect(-10, -3, 8, 6), e12.fillRect(2, -3, 8, 6), e12.fillStyle = "rgba(200,180,220,0.5)";
              for (let t6 = -12; t6 < 14; t6 += 5) e12.fillRect(t6, -5, 1.6, 1.6), e12.fillRect(t6, 3.4, 1.6, 1.6);
              e12.restore();
            }
            if (tM(3800, 200)) {
              let t6 = 0.5 * u2, r6 = ey(3800);
              for (let l6 of (e12.save(), e12.translate(t6, r6), e12.rotate(-0.18), e12.strokeStyle = "rgba(4,9,18,0.9)", e12.lineWidth = 10, e12.beginPath(), e12.arc(0, 0, 78, 1.02 * Math.PI, 2.2 * Math.PI), e12.stroke(), e12.lineWidth = 5, [-0.9, -0.3, 0.4, 1])) e12.beginPath(), e12.moveTo(0, 0), e12.lineTo(72 * Math.cos(l6), 72 * Math.sin(l6)), e12.stroke();
              e12.fillStyle = "rgba(4,9,18,0.9)", e12.beginPath(), e12.arc(0, 0, 16, 0, 7), e12.fill(), e12.strokeStyle = "rgba(4,9,18,0.8)", e12.lineWidth = 6, e12.beginPath(), e12.moveTo(70, 30), e12.quadraticCurveTo(120, 44, 150, 30), e12.quadraticCurveTo(180, 18, 210, 34), e12.stroke(), e12.restore();
            }
            if (tM(4400, 80)) for (let r6 = 0; r6 < 5; r6++) {
              let l6 = Math.sin(4 * t5 + 3 * r6);
              if (l6 < 0.55) continue;
              let i5 = (0.19 * r6 + 0.08) * u2 + 12 * Math.sin(7 * r6), a5 = ey(4400) + r6 % 3 * 24 - 10;
              e12.strokeStyle = `rgba(255,159,67,${(l6 - 0.55) * 1.6})`, e12.lineWidth = 2, e12.beginPath(), e12.arc(i5, a5, 6, 0, 7), e12.stroke();
            }
            for (let l6 of tk) {
              l6.x += l6.sp * r5 * 0.6, l6.sp > 0 && l6.x > u2 + 60 && (l6.x = -60, l6.dOff = q(-200, 200)), l6.sp < 0 && l6.x < -60 && (l6.x = u2 + 60, l6.dOff = q(-200, 200));
              let n6 = ey(eg + l6.dOff) + 10 * Math.sin(t5 + l6.ph);
              eg + l6.dOff > 20 && (i4 = l6.x, a4 = 0.6 * l6.s, e12.fillStyle = "rgba(255,240,214,0.5)", e12.fillRect(i4 - 0.7 * a4, n6 - 0.3 * a4, a4, 0.8 * a4), e12.fillRect(i4, n6 - 0.7 * a4, 0.8 * a4, a4), e12.fillStyle = "rgba(255,209,102,0.4)", e12.fillRect(i4 - 0.2 * a4, n6 + 0.1 * a4, 0.6 * a4, 0.5 * a4));
            }
          })(e11, t4, r4);
          let l4 = "rgba(4,9,18,0.85)";
          if (tM(85, 80)) {
            e11.fillStyle = l4;
            for (let r5 = 0; r5 < 9; r5++) ty(e11, (26 * t4 + 46 * r5 + r5 * r5 * 7) % (u2 + 360) - 180, ey(85) + 12 * Math.sin(2 * t4 + r5) + r5 % 3 * 14, 8, 1);
          }
          if (tM(800, 120)) for (let r5 = 0; r5 < 22; r5++) {
            let l5 = 0.12 * u2 + 0.034 * u2 * r5, i4 = ey(800) + 22 * Math.sin(0.7 * t4 + 0.55 * r5), a4 = 0.25 + 0.2 * Math.sin(3 * t4 + r5);
            e11.fillStyle = `rgba(77,227,255,${Math.max(0.06, a4)})`, e11.beginPath(), e11.arc(l5, i4, 2.2, 0, 7), e11.fill();
          }
          if (tM(980, 80)) for (let r5 = 0; r5 < 6; r5++) {
            let i4 = (14 * t4 + 110 * r5) % (u2 + 200) - 100, a4 = ey(980) + 20 * Math.sin(t4 + 2 * r5) + 8 * r5;
            e11.fillStyle = l4, ty(e11, i4, a4, 5, -1), e11.fillStyle = `rgba(232,241,255,${0.25 + 0.25 * Math.sin(5 * t4 + r5)})`, e11.fillRect(i4 - 1, a4 - 1, 2, 2);
          }
          if (tM(3800, 160)) {
            let t5 = 0.5 * u2, r5 = ey(3800);
            e11.fillStyle = "rgba(4,9,18,0.9)", e11.save(), e11.translate(t5, r5), e11.rotate(0.06), e11.fillRect(-110, -8, 140, 22), e11.beginPath(), e11.moveTo(-110, -8), e11.lineTo(-132, 14), e11.lineTo(-110, 14), e11.closePath(), e11.fill();
            for (let t6 = 0; t6 < 3; t6++) e11.fillRect(-92 + 34 * t6, -22, 8, 14);
            e11.fillRect(58, -4, 60, 18), e11.restore();
          }
          if (tM(4400, 80)) for (let r5 = 0; r5 < 8; r5++) {
            let l5 = (0.13 * r5 + 0.05) * u2 + 14 * Math.sin(0.8 * t4 + 2 * r5), i4 = ey(4400) + 18 * Math.sin(1.3 * t4 + r5) + r5 % 3 * 10;
            e11.fillStyle = `rgba(255,93,143,${0.15 + 0.2 * Math.sin(4 * t4 + 3 * r5)})`, e11.fillRect(l5, i4, 2, 2);
          }
          for (let l5 of (e11.fillStyle = "rgba(4,9,18,0.7)", tk)) {
            l5.x += l5.sp * r4, l5.sp > 0 && l5.x > u2 + 60 && (l5.x = -60, l5.dOff = q(-200, 200)), l5.sp < 0 && l5.x < -60 && (l5.x = u2 + 60, l5.dOff = q(-200, 200));
            let i4 = ey(eg + l5.dOff) + 10 * Math.sin(t4 + l5.ph);
            eg + l5.dOff > 20 && ty(e11, l5.x, i4, l5.s, Math.sign(l5.sp));
          }
        })(W, e10, E.reducedMotion ? 0 : t3);
      })(l2, r2), (function(e10, t3) {
        H.clearRect(0, 0, u2, h2);
        let r3 = (eg - ev) * 2;
        for (let l3 of tv) l3.y -= r3 * l3.par - 12 * t3, l3.x += 13.2 * Math.sin(0.5 * e10 + l3.ph) * t3, l3.y > h2 + 12 && (l3.y -= h2 + 24), l3.y < -12 && (l3.y += h2 + 24), l3.x > u2 + 12 && (l3.x = -12), l3.x < -12 && (l3.x = u2 + 12), H.fillStyle = `rgba(${s2.snow[1]},${l3.a})`, H.fillRect(l3.x, l3.y, l3.r, l3.r);
        if (eE) {
          let t4 = T() + eC, r4 = ey(eL), l3 = H.createRadialGradient(t4, r4 - 32, 6, t4, r4 - 32, 80);
          if (l3.addColorStop(0, "rgba(77,227,255,.14)"), l3.addColorStop(1, "rgba(77,227,255,0)"), H.fillStyle = l3, H.beginPath(), H.arc(t4, r4 - 32, 80, 0, 7), H.fill(), "schooler" === eR && tu.complete) {
            let l4 = [[-64, -26], [-88, 10], [64, -18], [88, 18], [-40, 34], [44, 38]];
            for (let i3 = 0; i3 < l4.length; i3++) {
              let a3 = t4 + l4[i3][0], n4 = r4 + l4[i3][1] + 6 * Math.sin(4 * e10 + i3), s3 = l4[i3][0] > 0 ? -1 : 1;
              H.save(), H.translate(a3, n4), H.scale(s3, 1), H.drawImage(tu, -16, -16, 32, 32), H.restore();
            }
          }
        }
        if (ez) {
          let t4, r4;
          "follow" === eV && eE ? (t4 = T() + eC, r4 = ey(eL)) : eY ? (t4 = eY.x, r4 = ey(eY.d)) : (t4 = T(), r4 = h2 / 2), (function(e11, t5, r5, l3) {
            if (!ez || !o2 && !td.complete) return;
            let i3 = "hold" === eV ? 0.62 : 1;
            for (let a3 of ez) {
              let n4 = a3.rad * i3 * (1 + 7 * eU), s3 = r5 + Math.cos(a3.ang + t5 * a3.w) * n4 * 1.12, d2 = l3 + Math.sin(a3.ang + t5 * a3.w) * n4 * 0.62 + 4 * Math.sin(2.2 * t5 + a3.ph), c3 = -Math.sin(a3.ang + t5 * a3.w) * a3.w > 0 ? 1 : -1;
              if (e11.globalAlpha = Math.max(0, 0.92 - 1.15 * eU), e11.save(), e11.translate(s3, d2), o2) {
                let r6 = 0.8 * a3.s, l4 = 0.7 + 0.3 * Math.sin(5 * t5 + a3.ph);
                e11.fillStyle = `rgba(255,209,102,${l4})`, e11.fillRect(-r6 / 2, -1.5, r6, 3), e11.fillRect(-1.5, -r6 / 2, 3, r6), e11.fillStyle = `rgba(255,233,168,${l4})`, e11.fillRect(-2, -2, 4, 4);
              } else e11.scale(c3, 1), e11.drawImage(td, -a3.s / 2, -a3.s / 2, a3.s, a3.s);
              e11.restore();
            }
            e11.globalAlpha = 1;
          })(H, e10, t4, r4);
        }
        for (let r4 = e4.length - 1; r4 >= 0; r4--) {
          let l3 = e4[r4];
          l3.d -= l3.vd * t3 * (o2 ? 0.45 : 1), l3.life -= t3;
          let i3 = ey(l3.d);
          if (l3.life <= 0 || i3 < -30 || i3 > h2 + 60) {
            e4.splice(r4, 1);
            continue;
          }
          let a3 = l3.x + 3 * Math.sin(3 * e10 + l3.wob), n4 = Math.min(0.7, 0.5 * l3.life);
          if (o2) if (H.fillStyle = `rgba(${l3.col},${n4})`, l3.r > 2.6) {
            let e11 = 1.6 * l3.r;
            H.fillRect(a3 - e11 / 2, i3 - 1, e11, 2), H.fillRect(a3 - 1, i3 - e11 / 2, 2, e11), H.fillRect(a3 - 1.5, i3 - 1.5, 3, 3);
          } else H.fillRect(a3 - l3.r / 2, i3 - l3.r / 2, l3.r, l3.r);
          else H.strokeStyle = `rgba(${l3.col},${n4})`, H.lineWidth = 1.2, H.beginPath(), H.arc(a3, i3, l3.r, 0, 7), H.stroke();
        }
        for (let e11 = e6.length - 1; e11 >= 0; e11--) {
          let r4 = e6[e11];
          r4.t += t3;
          let l3 = r4.t / r4.life;
          if (l3 >= 1) {
            e6.splice(e11, 1);
            continue;
          }
          r4.vx *= 1 - 1.6 * t3, r4.vd *= 1 - 1.6 * t3, r4.x += r4.vx * t3, r4.d += r4.vd * t3;
          let i3 = ey(r4.d), a3 = r4.r * (0.4 + l3);
          H.globalAlpha = 0.55 * (1 - l3);
          let n4 = H.createRadialGradient(r4.x, i3, 0, r4.x, i3, a3);
          n4.addColorStop(0, "rgba(60,4,14,.95)"), n4.addColorStop(1, "rgba(20,0,6,0)"), H.fillStyle = n4, H.beginPath(), H.arc(r4.x, i3, a3, 0, 7), H.fill();
        }
        H.globalAlpha = 1;
        for (let e11 = e3.length - 1; e11 >= 0; e11--) {
          let r4 = e3[e11];
          if (r4.t += t3, r4.t > r4.life) {
            e3.splice(e11, 1);
            continue;
          }
          r4.x += r4.vx * t3, r4.d += r4.vd * t3, r4.vx *= 1 - 2.4 * t3, r4.vd *= 1 - 2.4 * t3, r4.vd += (r4.grav ? 26 : -8) * t3, H.globalAlpha = 1 - r4.t / r4.life, H.fillStyle = r4.color, H.fillRect(r4.x - r4.r / 2, ey(r4.d) - r4.r / 2, r4.r, r4.r);
        }
        H.globalAlpha = 1, (function() {
          let e11 = eg - h2 / 4, t4 = eg + h2 / 4, r4 = u2 - 14;
          H.strokeStyle = "rgba(125,147,184,.55)", H.lineWidth = 2, H.font = "13px " + ei, H.textAlign = "right";
          let l3 = Math.max(0, ey(0));
          l3 < h2 && (H.beginPath(), H.moveTo(r4, l3), H.lineTo(r4, h2), H.stroke());
          let i3 = ey(eS > 0 ? eP : -100);
          for (let l4 = Math.max(0, 10 * Math.floor(e11 / 10)); l4 <= t4; l4 += 10) {
            let e12 = ey(l4);
            if (e12 < -4 || e12 > h2 + 4) continue;
            let t5 = l4 % 100 == 0 ? 16 : l4 % 50 == 0 ? 10 : 5;
            H.beginPath(), H.moveTo(r4 - t5, e12), H.lineTo(r4, e12), H.stroke(), l4 % 100 != 0 || eS > 0 && 14 > Math.abs(e12 - i3) || (H.fillStyle = "rgba(125,147,184,.95)", H.fillText(0 === l4 ? "0" + c2.unit : "-" + l4.toLocaleString() + c2.unit, r4 - t5 - 5, e12 + 4));
          }
          i3 > -20 && i3 < h2 + 20 && eS > 0 && (H.fillStyle = "#ff5d8f", H.beginPath(), H.moveTo(r4 + 4, i3), H.lineTo(r4 + 12, i3 - 5), H.lineTo(r4 + 12, i3 + 5), H.closePath(), H.fill(), H.strokeStyle = "rgba(255,93,143,.85)", H.beginPath(), H.moveTo(r4 - 20, i3), H.lineTo(r4 + 4, i3), H.stroke(), H.font = "12px " + ei, H.fillText("YOU", r4 - 24, i3 + 4));
        })();
      })(l2, r2), (function(t3, r3) {
        let l3;
        if (eZ && !eZ.isConnected && e1(), eX) l3 = { x: eX.x + 44 * Math.cos(1.5 * t3) * (1 + 3.5 * eU), y: ey(eX.d) + 24 * Math.sin(1.5 * t3) * (1 + 3.5 * eU), rot: 18 * Math.sin(1.5 * t3) };
        else if (eZ) {
          let t4 = eZ.getBoundingClientRect();
          l3 = { x: t4.left - e2.getBoundingClientRect().left + t4.width / 2, y: t4.top - e2.getBoundingClientRect().top + t4.height / 2, rot: 0 }, z.classList.add("perched");
        } else l3 = "intro" === ex ? { x: 0.72 * u2, y: ey(0) + 105, rot: 0 } : "plunge" === ex ? { x: Math.min(T() + 95, u2 - 44), y: ey(eL) - 14, rot: 24 } : "landed" === ex ? { x: 0.16 * u2, y: 0.28 * h2, rot: -8 } : "round" === ex ? { x: 48, y: h2 - 168, rot: 0 } : "finale" === ex ? { x: 0.82 * u2, y: 0.16 * h2, rot: -6 } : { x: 0.72 * u2, y: 0.4 * h2, rot: 6 };
        let i3 = 1 - Math.exp((eX ? -4.6 : eZ ? -3.4 : -2.6) * r3);
        tx += (l3.x - tx) * i3, tS += (l3.y - tS) * i3, tw += (l3.rot - tw) * i3;
        let a3 = Math.sin(1.7 * t3) * (eZ ? 3 : 6), n4 = z.offsetWidth / 2;
        z.style.transform = `translate3d(${tx - n4}px,${tS - n4 + a3}px,0) rotate(${tw + Math.sin(1.1 * t3) * (eZ ? 1.5 : 4)}deg)`, !E.reducedMotion && t3 - tT > 2.2 + Math.random() && (tT = t3, e7(tx + 20, tS + a3 - 8, 1.5 + 2 * Math.random())), !E.reducedMotion && eJ && t3 - tL > 0.55 && e3.length < 200 && (tL = t3, e3.push({ x: tx + q(-10, 10), d: e8(tS + a3 + q(-4, 12)), vx: q(-10, 10), vd: q(-14, 6) / 2, r: 1.2 + 1.6 * Math.random(), life: 0.6 + 0.5 * Math.random(), t: 0, color: 0.5 > Math.random() ? "#ffd166" : "#ffe9a8" }));
      })(l2, r2);
    }, () => ek.length > 0 || "plunge" === ex || "descend" === ex || Math.abs(ep - em) > 0.1), { previewMascot(e10, t2) {
      Y.preview(e10, t2), z.classList.toggle("gold", t2 ?? eJ);
    }, intro() {
      E.invalidate(), j.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e10) => e10.remove()), eq = null, eA = null, j.classList.remove("ds-reveal"), N.classList.remove("on"), ek.length = 0, ez = null, eV = null, eU = 0, eY = null, eX = null, e1(), e0(), eP = 0, eS = 0, ew = 0, eT = 0, Z.textContent = "0", ex = "intro", ep = -45, eF();
    }, finale() {
      E.invalidate(), Y.setGold(eJ), j.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e11) => e11.remove()), eq = null, eA = null, j.classList.remove("ds-reveal"), N.classList.remove("on"), ez = null, eV = null, eU = 0, eY = null, eX = null, e1(), ex = "finale", ek.length = 0;
      let e10 = ep;
      eM(Math.min(9e3, Math.max(2500, 3 * e10)), G, (t2) => {
        ep = $(e10, -45, t2);
      }), ea.event("surface"), eF();
    }, descendToRound(e10, t2, r2 = 2200) {
      E.invalidate(), eW(), j.classList.remove("ds-reveal"), e1(), eX = null, j.querySelectorAll(".ds-landed").forEach((e11) => {
        e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
      }), eH(e10, t2, e$ = eP, 0.45), ex = "descend", eB(), eF();
      let l2 = ep;
      eM(r2, I, (e11) => {
        ep = $(l2, e$ + C(), e11);
      }, () => {
        ex = "round", eF();
      });
    }, restore(e10, t2, r2) {
      E.invalidate(), j.querySelectorAll(".ds-landed,.ds-card,.ds-tierline").forEach((e11) => e11.remove()), eq = null, eA = null, eS = r2.length, e1(), r2.some((e11) => "krillion" === e11.tier) ? eQ(true) : e0();
      let l2 = r2.reduce((e11, t3) => e11 + t3.points, 0);
      ew = eP = 10 * l2, eT = l2, Z.textContent = String(l2), e$ = eP, e10 < 7 && t2 && eH(e10, t2, e$), eb(e$ + C()), ex = "round", eF();
    }, plunge(e10, r2) {
      E.invalidate(), null !== e10.tier && (function(e11) {
        for (let r3 of (eW(true), eq = [], a.TIER_IDS)) {
          let l2 = a.TIERS[r3], i2 = e11 + 10 * l2.score, n3 = document.createElement("div");
          n3.className = "ds-tierline", n3.style.top = 2 * i2 + "px", n3.style.setProperty("--tc", `var(--tier-${r3})`), n3.innerHTML = `<div class="tag"><img src="${(0, t.seasonalKrillSprite)(`/tiers/${r3}.png`)}" alt="">${l2.name.toUpperCase()} &middot; ${l2.score}</div>`, n3.style.opacity = "0", j.appendChild(n3);
          let s3 = 90 * eq.length;
          requestAnimationFrame(() => {
            n3.style.transition = "opacity .55s ease-out " + s3 + "ms", n3.style.opacity = "1";
          }), eq.push({ d: i2, el: n3, tier: r3, passed: false });
        }
      })(e$), (function(e11, t2) {
        ex = "plunge", j.classList.add("ds-reveal");
        let r3 = e$, l2 = e11.tier ?? "miss";
        if (eR = l2, eA) {
          let e12 = eA;
          te(T(), ey(r3 + 60), "#4de3ff", 12, 0.6), e12.classList.add("gone"), setTimeout(() => e12.remove(), 650), eA = null;
        }
        if (!e11.tier) {
          let l3 = r3 + 40;
          eN(), eB(), ea.event("miss"), e_("rgba(61,79,110,.5)", 1, 200), e5("sad", 2600), eD(() => {
            ej(e11, l3), eP = r3, eS++, ep = l3 + 30, ew = r3, eO(e11.newScore, false), ex = "landed", eF(), eD(() => j.classList.remove("ds-reveal"), 900), t2();
          }, 900);
          return;
        }
        let i2 = a.TIERS[e11.tier], n3 = e22[e11.tier], s3 = r3 + 10 * i2.score, d2 = e11.answerText.toUpperCase(), c3 = document.createElement("div");
        c3.className = "ds-chip ds-px", c3.style.setProperty("--cc", `var(--tier-${e11.tier})`), c3.textContent = `\u201C${d2}\u201D`, j.appendChild(c3);
        let f3 = r3 + 90, p3 = ew;
        switch (eL = f3, eE = true, ea.event("sink"), l2) {
          case "plankton":
            e5("sad", n3.dur + 800);
            break;
          case "tooclever":
            e_("rgba(255,159,67,.7)", 3, 130), eN(), e5("faint", 2400), (function(e12) {
              let t3 = u2 < 700 ? 8 : 11;
              for (let r4 = 0; r4 < t3; r4++) {
                let t4;
                if (o2) (t4 = document.createElement("span")).className = "ds-swarm-fish ds-swarm-ticket";
                else {
                  let e13 = document.createElement("img");
                  e13.src = "/tiers/schooler.png", e13.alt = "", e13.className = "ds-swarm-fish", t4 = e13;
                }
                D.appendChild(t4);
                let l3 = r4 % 2 == 0, i3 = l3 ? -70 : u2 + 70, a2 = l3 ? u2 + 70 : -70, n4 = 0.42 * h2 + q(-130, 130), s4 = 110 * r4, d3 = q(1300, 2e3);
                t4.animate([{ transform: `translate(${i3}px,${n4}px) scaleX(${l3 ? 1 : -1})` }, { transform: `translate(${(i3 + a2) / 2}px,${0.42 * h2 + q(-30, 30)}px) scaleX(${l3 ? 1 : -1}) rotate(${q(-14, 14)}deg)`, offset: 0.5 }, { transform: `translate(${a2}px,${n4 + q(-60, 60)}px) scaleX(${l3 ? 1 : -1})` }], { duration: d3, delay: s4, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "both" }), setTimeout(() => t4.remove(), Math.min(s4 + d3 + 100, e12 + 1400));
              }
            })(n3.dur);
            break;
          case "rare":
            e_("rgba(255,82,82,.4)", 1, 220), tt(T(), ey(f3), 10);
            break;
          case "deepcut":
            eK(T(), ey(f3)), N.classList.add("on");
            break;
          case "krillion":
            e_("rgba(255,209,102,.45)", 1, 180), c3.classList.add("gold"), eV = "follow", eU = 0, ez = [];
            let m3 = u2 < 700 ? 14 : 20;
            for (let e12 = 0; e12 < m3; e12++) ez.push({ ang: Math.random() * Math.PI * 2, rad: 30 + 48 * Math.random(), w: (0.7 + 1.5 * Math.random()) * (0.5 > Math.random() ? -1 : 1), ph: 9 * Math.random(), s: 15 + 13 * Math.random() });
        }
        eM(n3.dur, n3.ease, (t3) => {
          eL = $(f3, s3, t3);
          let r4 = 0;
          "plankton" === l2 ? r4 = 0.55 * (eC = 36 * Math.sin(7 * t3) * (1 - 0.25 * t3)) : "tooclever" === l2 ? (eC = 7 * Math.sin(42 * t3) + q(-2, 2), r4 = q(-3, 3)) : r4 = "krillion" === l2 ? 0.5 * (eC = Math.sin(24 * t3) * (1 - t3) * 26) : 0.4 * (eC = Math.sin(16 * t3) * (1 - t3) * 14), c3.style.transform = `translate3d(calc(-50% + ${eC}px),${2 * eL}px,0) rotate(${r4}deg)`, ep = eL + 30, "krillion" !== l2 && (ew = $(p3, s3, t3));
          let i3 = T() + eC, a2 = ey(eL);
          if ("plankton" === l2 ? 0.25 > Math.random() && e9(i3 + q(-30, 30), a2) : "rare" === l2 ? 0.09 > Math.random() && tt(i3 + q(-20, 20), a2 - 10, 3) : "krillion" === l2 ? 0.5 > Math.random() && e7(i3 + q(-30, 30), a2, 1.5 + 2 * Math.random()) : "deepcut" === l2 ? (eK(i3, a2), 0.3 > Math.random() && e7(i3 + q(-20, 20), a2, 1 + 2 * Math.random())) : 0.6 > Math.random() && e7(i3 + q(-34, 34), a2 + q(-8, 4), 1.5 + 2.5 * Math.random()), eq) for (let t4 of eq) !t4.passed && eL > t4.d - 4 && (t4.passed = true, t4.el.classList.add("passed"), ea.event("tierline"), t4.tier !== e11.tier && te(T(), ey(t4.d), k[t4.tier], 7, 0.5));
        }, () => {
          eE = false, c3.remove(), (function(e12, t3, r4) {
            ex = "landed";
            let l3 = e12.tier;
            ea.event("krillion" === l3 ? "krillion" : "plankton" === l3 || "tooclever" === l3 ? "land_small" : "land_big");
            let i3 = ej(e12, t3);
            eP = t3, eS++, ep = t3 + 30;
            let a2 = T(), n4 = ey(t3), s4 = k[l3];
            switch (l3) {
              case "plankton":
                te(a2, n4, "#8fa3c4", 8, 0.4), ew = t3, eO(e12.newScore, false);
                break;
              case "tooclever":
                e_("rgba(255,159,67,.6)", 2, 130), eN(), te(a2, n4, s4, 18, 0.7), ew = t3, eO(e12.newScore, false);
                break;
              case "schooler":
                te(a2, n4, s4, 22, 0.8), ew = t3, eO(e12.newScore, false);
                break;
              case "rare":
                tt(a2, n4, 22), te(a2, n4, s4, 26, 0.9), eN(), e_("rgba(255,82,82,.45)", 1, 240), ew = t3, eO(e12.newScore, false);
                break;
              case "deepcut":
                eK(a2, n4, 200), te(a2, n4, s4, 18, 0.7), ew = t3, eO(e12.newScore, false), eD(() => N.classList.remove("on"), 2300);
                break;
              case "krillion":
                eV = "hold", eY = { x: a2, d: t3 }, i3.classList.add("perched"), e_("rgba(255,209,102,.35)", 1, 220), e5("celebrate", 1250), eX = { x: a2, d: t3 }, eD(() => {
                  eQ(), eM(1500, G, (e13) => {
                    eU = e13;
                  }, () => {
                    ez = null, eV = null, eU = 0;
                  }), eO(e12.newScore, true), eD(() => {
                    let e13, r5, l4;
                    return e13 = ew, r5 = 0, l4 = setInterval(() => {
                      ew = Math.round(e13 + (t3 - e13) * (1 - Math.pow(1 - ++r5 / 8, 2))), X.classList.remove("crank"), X.offsetWidth, X.classList.add("crank"), r5 >= 8 && (clearInterval(l4), ew = t3);
                    }, 110), void eG.push(l4);
                  }, 350), eD(() => {
                    eX = null, "landed" === ex && (eZ = i3.querySelector(".icon"));
                  }, 900);
                }, 1e3);
            }
            eF(), eW(), j.classList.remove("ds-reveal"), r4();
          })(e11, s3, t2);
        });
      })(e10, r2);
    }, showLanded(e10, t2) {
      E.invalidate();
      let r2 = e10.tier ? e$ + 10 * e10.points : e$ + 40;
      eA?.remove(), eA = null;
      let l2 = ej(e10, r2);
      "krillion" === e10.tier ? (eQ(true), l2.classList.add("perched"), eZ = l2.querySelector(".icon")) : e1(), eP = e10.tier ? r2 : e$, eS++, ew = eP, eT = e10.newScore, Z.textContent = String(e10.newScore), eb(r2 + 30), ex = "landed", eF(), t2 && requestAnimationFrame(() => t2());
    }, setUrgency(t2) {
      if (e2.style.setProperty("--ds-urgency", t2.toFixed(3)), B.classList.toggle("danger", t2 > 0.8), t2 > 0.8 && t2 < 1) {
        let e10 = Math.ceil((1 - t2) * 15);
        e10 !== ef && (ef = e10, ea.event("tick"));
      } else ef = -1;
    }, typeFx(e10, t2) {
      E.invalidate(), e7(e10 + q(-3, 3), t2 + q(4, 12), 1 + 2 * Math.random()), 0.3 > Math.random() && e7(e10 + q(-8, 8), t2 + q(2, 10), 1 + 1.6 * Math.random());
    }, submitFx(t2) {
      E.invalidate(), eB(), ea.event("submit");
      let r2 = e2.getBoundingClientRect().left, l2 = e2.getBoundingClientRect().top;
      for (let e10 = 0; e10 < 12; e10++) e7(t2.left - r2 + q(0, t2.width), t2.top - l2 + q(0, t2.height), 2 + 3 * Math.random());
      B.classList.remove("danger"), e2.style.setProperty("--ds-urgency", "0");
    }, rejectFx() {
      E.invalidate(), eB(), ea.event("reject"), e9(T() + q(-40, 40), h2 - 120), e9(T() + q(-40, 40), h2 - 130);
    }, destroy() {
      eI = true, Y.destroy(), E.destroy(), R(), tc(), removeEventListener("resize", et), el.disconnect(), e2.removeEventListener("pointermove", tA), tE(), en.removeEventListener("click", eh), eu(), ea.release(), eG.forEach((e10) => {
        clearTimeout(e10), clearInterval(e10);
      }), eG = [], ek.length = 0, e2.innerHTML = "";
    } };
  }, "outcomeToPlunge", 0, function(e2, t2, r2) {
    return { answerText: e2.answer ?? e2.rawAnswer ?? "", tier: e2.tier, points: e2.score, newScore: t2, sub: M(e2, r2) };
  }, "outcomeToRestored", 0, function(e2, t2) {
    return { answerText: e2.answer ?? e2.rawAnswer ?? "", tier: e2.tier, points: e2.score, sub: M(e2, t2) };
  }], 48992);
}]);
