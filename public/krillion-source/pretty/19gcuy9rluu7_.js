(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 75413, (e) => {
  e.v({ current: "GameHistoryModal-module__D_oMsa__current", dialog: "GameHistoryModal-module__D_oMsa__dialog", done: "GameHistoryModal-module__D_oMsa__done", grid: "GameHistoryModal-module__D_oMsa__grid", gridScroll: "GameHistoryModal-module__D_oMsa__gridScroll", header: "GameHistoryModal-module__D_oMsa__header", launcher: "GameHistoryModal-module__D_oMsa__launcher", panel: "GameHistoryModal-module__D_oMsa__panel", rule: "GameHistoryModal-module__D_oMsa__rule", tile: "GameHistoryModal-module__D_oMsa__tile", "tile-breathe": "GameHistoryModal-module__D_oMsa__tile-breathe", tileNote: "GameHistoryModal-module__D_oMsa__tileNote", tileNum: "GameHistoryModal-module__D_oMsa__tileNum" });
}, 50186, (e) => {
  e.v({ bestPrefix: "ArchiveCalendarModal-module__VJo9VG__bestPrefix", blank: "ArchiveCalendarModal-module__VJo9VG__blank", close: "ArchiveCalendarModal-module__VJo9VG__close", current: "ArchiveCalendarModal-module__VJo9VG__current", date: "ArchiveCalendarModal-module__VJo9VG__date", day: "ArchiveCalendarModal-module__VJo9VG__day", "day-breathe": "ArchiveCalendarModal-module__VJo9VG__day-breathe", dialog: "ArchiveCalendarModal-module__VJo9VG__dialog", dive: "ArchiveCalendarModal-module__VJo9VG__dive", done: "ArchiveCalendarModal-module__VJo9VG__done", grid: "ArchiveCalendarModal-module__VJo9VG__grid", gridScroll: "ArchiveCalendarModal-module__VJo9VG__gridScroll", launcher: "ArchiveCalendarModal-module__VJo9VG__launcher", monthNav: "ArchiveCalendarModal-module__VJo9VG__monthNav", panel: "ArchiveCalendarModal-module__VJo9VG__panel", score: "ArchiveCalendarModal-module__VJo9VG__score", unavailable: "ArchiveCalendarModal-module__VJo9VG__unavailable", weekdays: "ArchiveCalendarModal-module__VJo9VG__weekdays" });
}, 36513, (e) => {
  "use strict";
  var t = e.i(43476), a = e.i(36484), l = e.i(1900), r = e.i(71645), n = e.i(18566), i = e.i(95219), s = e.i(67334), o = e.i(33827), d = e.i(37812);
  async function c(t2, a2, l2 = {}) {
    let r2 = (0, o.progressOwner)(), n2 = (0, d.loadPackUnlockToken)(t2), i2 = (e2) => {
      let t3 = new Headers(l2.headers);
      return t3.set("x-krillion-unlock", e2 ?? ""), fetch(a2, { ...l2, headers: t3 });
    }, s2 = await i2(n2);
    if (402 !== s2.status || !r2 || l2.signal?.aborted) return s2;
    let { initializeAccount: h2, recoverAccountPurchases: u2 } = await e.A(10150);
    if (await h2(), (0, o.progressOwner)() !== r2) return s2;
    await u2(true);
    let f2 = (0, d.loadPackUnlockToken)(t2);
    return (0, o.progressOwner)() !== r2 || !f2 || f2 === n2 || l2.signal?.aborted ? s2 : i2(f2);
  }
  var h = e.i(80915), u = e.i(61194), f = e.i(87588), p = e.i(86062), m = e.i(67115), g = e.i(98890), v = e.i(55067), y = e.i(22016), x = e.i(39233), b = e.i(54801), M = e.i(77372), w = e.i(35406), k = e.i(40806), S = e.i(99363), C = e.i(28551), $ = e.i(89910), R = e.i(66732), T = e.i(57410);
  let j = { plankton: "#8fa3c4", tooclever: "#ff9f43", schooler: "#4de3ff", rare: "#ff5252", deepcut: "#9d7bff", krillion: "#ffd166" }, L = { hardwood: { pal: { o: "#e8842c", d: "#8a4014", h: "#ffb36b", k: "#5c2a0c" }, rows: ["..kkkkk..", ".khhdook.", "kohodoook", "kooodoook", "kdddddddk", "kooodoook", "kooodoook", ".koodook.", "..kkkkk.."] }, clay: { pal: { y: "#d8e84a", w: "#f4f8e0", k: "#7a8a1e" }, rows: ["..kkk..", ".kyywk.", "kyywyyk", "kywyyyk", "kyywyyk", ".kyywk.", "..kkk.."] }, ice: { pal: { k: "#0a0c12", g: "#2e3846", e: "#10141c" }, rows: ["kggggggk", "keeeeeek", "kkkkkkkk"] }, pitch: { pal: { w: "#e8ecf4", k: "#181c24", s: "#b8c0cc" }, rows: ["..kkkkk..", ".kwwwwwk.", "kwwwwwwwk", "kwwkkkwwk", "kwwkkkwwk", "kwwkkkssk", "kkwwwwssk", ".kwwwssk.", "..kkkkk.."] }, gridiron: { pal: { b: "#96522a", d: "#5c2e14", w: "#e8e4da", l: "#f4f0e6", k: "#3a1c0a" }, rows: ["...kkbbbkk...", ".kbwbbbbbwbk.", "kbbwlwlwlwbbk", "kbbbbbbbbbbbk", ".kbdbbbbbdbk.", "...kkdddkk..."] }, track: { pal: { g: "#ffd166", d: "#c98f2a", k: "#6e4a10" }, rows: ["kddddddddk", "dgggggggdk", "kddddddddk"] } }, A = (0, r.forwardRef)(function({ phase: e2, opts: a2, onReady: l2, children: n2 }, i2) {
    let s2 = (0, r.useRef)(null), o2 = (0, r.useRef)(null), d2 = (0, r.useRef)(l2);
    d2.current = l2;
    let c2 = (0, r.useRef)(a2);
    return (0, r.useEffect)(() => {
      if (!s2.current) return;
      let e3 = (function(e4, t2) {
        let a3 = t2.theme, l3 = a3.copy, r2 = e4.clientWidth || innerWidth, n3 = e4.clientHeight || innerHeight, i3 = 0, s3 = 0, o3 = 0, d3 = 0, c3 = () => -i3, h2 = () => r2 + i3 + s3, u2 = () => -o3, f2 = () => n3 + o3 + d3, m2 = () => 0.68 * n3, g2 = () => 0.8 * n3, v2 = () => r2 < 700 ? 8 : 30, y2 = (0, C.createWorldRenderer)(e4), x2 = (0, S.watchSeasonalKrillImages)(e4), b2 = y2.revision, M2 = y2.pixelRatio(r2, n3), w2 = (e10, t3, a4) => e10 + (t3 - e10) * a4, A2 = (e10, t3) => e10 + Math.random() * (t3 - e10), N2 = (e10) => e10 < 0.5 ? 4 * e10 * e10 * e10 : 1 - Math.pow(-2 * e10 + 2, 3) / 2, E2 = (e10) => 1 - Math.pow(1 - e10, 3);
        e4.innerHTML = `
    <div class="ds-stage">
      <canvas class="ds-sea"></canvas>
      <div class="ds-world">
        <div class="ds-surface">
          <div class="ds-title"></div>
          <div class="ds-tagline"></div>
          <div class="ds-subline"></div>
        </div>
        <img class="gl-tunnel" src="${a3.tunnel}" alt="">
        <img class="ds-floor gl-podium" src="${a3.podium}" alt="">
      </div>
      <canvas class="ds-fore"></canvas>
      <div class="ds-dim"></div>
      <div class="ds-vignette"></div>
      <div class="ds-edge"></div>
      <div class="ds-flash"></div>
      <div class="ds-hud">
        <div class="ds-pod ds-px"><div class="label">${l3.hudLabel}</div><div class="ds-depth-num">0</div></div>
        <div class="ds-hud-mid"><div class="ds-dots"></div><div class="ds-prompt-count">${l3.surfaceLabel}</div></div>
        <div class="ds-pod ds-px ds-score-pod"><div class="label">SCORE</div><div class="ds-score-num">0</div></div>
      </div>
      <div class="ds-mascot" title="a friend">
        <span class="ds-mascot-sprite">
          <img src="/tiers/krillion.png" alt="krill">
        </span>
        <span class="ds-blub">go!</span>
      </div>
      <div class="ds-crt"></div>
      <button class="ds-mute" type="button" aria-label="toggle sound"></button>
    </div>`;
        let I2 = e4.querySelector(".ds-stage"), _2 = e4.querySelector(".ds-sea"), P2 = e4.querySelector(".ds-fore"), q2 = _2.getContext("2d"), D2 = P2.getContext("2d"), G2 = e4.querySelector(".ds-world"), H2 = e4.querySelector(".ds-dim"), F2 = e4.querySelector(".ds-edge"), W2 = e4.querySelector(".ds-flash"), O2 = e4.querySelector(".ds-crt"), U2 = e4.querySelector(".ds-mascot"), V2 = U2.querySelector("img"), z2 = (0, T.createMascotSpriteController)(V2), B2 = e4.querySelector(".ds-depth-num"), K2 = e4.querySelector(".ds-score-num"), J2 = e4.querySelector(".ds-dots"), Y2 = e4.querySelector(".ds-prompt-count");
        {
          let a4 = e4.querySelector(".ds-title");
          "KRILLION".split("").forEach((e10, t3) => {
            let l5 = document.createElement("span");
            l5.textContent = e10, l5.style.animationDelay = 0.18 * t3 + "s", a4.appendChild(l5);
          });
          let l4 = e4.querySelector(".ds-surface");
          l4.style.left = "-690px", l4.style.width = "1200px", e4.querySelector(".ds-tagline").textContent = t2.tagline ?? "THE DEEP BENCH", e4.querySelector(".ds-subline").textContent = t2.subline ?? "7 rounds \xB7 25 seconds each \xB7 rarer answers run farther", e4.querySelector(".gl-tunnel").style.left = "-540px", e4.querySelector(".gl-podium").style.left = "11220px";
          for (let e10 = 0; e10 < 7; e10++) J2.appendChild(document.createElement("i"));
        }
        let X2 = false;
        function Z2() {
          X2 = true, y2.invalidate();
        }
        function Q2() {
          X2 = false, r2 = e4.clientWidth || innerWidth, n3 = e4.clientHeight || innerHeight;
          let t3 = e4.getBoundingClientRect();
          i3 = Math.max(0, Math.round(t3.left)), o3 = Math.max(0, Math.round(t3.top)), s3 = Math.max(0, Math.round(innerWidth - t3.right)), d3 = Math.max(0, Math.round(innerHeight - t3.bottom)), M2 = y2.pixelRatio(h2(), f2()), P2.width !== Math.floor(r2 * M2) && (P2.width = r2 * M2), P2.height !== Math.floor(n3 * M2) && (P2.height = n3 * M2), P2.style.width = r2 + "px", P2.style.height = n3 + "px", D2.setTransform(M2, 0, 0, M2, 0, 0), _2.width !== Math.floor(h2() * M2) && (_2.width = h2() * M2), _2.height !== Math.floor(f2() * M2) && (_2.height = f2() * M2), _2.style.width = h2() + "px", _2.style.height = f2() + "px", _2.style.left = c3() + "px", _2.style.top = u2() + "px", q2.setTransform(M2, 0, 0, M2, i3 * M2, o3 * M2), (function() {
            to.length = td.length = 0;
            let e10 = r2 * n3 / 304500, t4 = h2() * f2() / 304500, a4 = Math.round(30 * y2.particleScale * Math.min(t4, 2.4)), l4 = Math.round(10 * y2.particleScale * Math.min(e10, 2.4));
            for (let e11 = 0; e11 < a4; e11++) to.push({ x: c3() + Math.random() * h2(), y: u2() + Math.random() * f2(), par: 0.35 + 0.5 * Math.random(), r: 0.6 + 1.4 * Math.random(), a: 0.06 + 0.12 * Math.random(), ph: 9 * Math.random() });
            for (let e11 = 0; e11 < l4; e11++) td.push({ x: Math.random() * r2, y: Math.random() * n3, par: 1.15 + 0.45 * Math.random(), r: 1 + 1.8 * Math.random(), a: 0.08 + 0.15 * Math.random(), ph: 9 * Math.random() });
          })();
        }
        addEventListener("resize", Z2);
        let ee2 = new ResizeObserver(() => {
          (e4.clientWidth !== r2 || e4.clientHeight !== n3) && Z2();
        });
        ee2.observe(e4);
        let et2 = (0, R.getDescentAudio)();
        et2.acquire(e4);
        let ea2 = e4.querySelector(".ds-mute"), el2 = '<path d="M2 6h3l4-4v12l-4-4H2z"/>', er2 = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${el2}<rect x="11" y="6" width="2" height="4"/><rect x="15" y="3" width="2" height="10"/></svg>`, en2 = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${el2}<rect x="11" y="5" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/><rect x="15" y="9" width="2" height="2"/><rect x="15" y="5" width="2" height="2"/><rect x="11" y="9" width="2" height="2"/></svg>`, ei2 = () => {
          let e10 = et2.isMuted();
          ea2.innerHTML = e10 ? en2 : er2, ea2.setAttribute("aria-label", e10 ? "turn sound on" : "turn sound off"), ea2.setAttribute("aria-pressed", e10 ? "true" : "false"), ea2.classList.toggle("off", e10);
        };
        ei2();
        let es2 = et2.subscribeMute(ei2), eo2 = () => et2.toggleMuted();
        ea2.addEventListener("click", eo2);
        let ed2 = -1, ec2 = -45, eh2 = -45, eu2 = -45, ef2 = -45, ep2 = (e10) => {
          ec2 = eh2 = eu2 = ef2 = e10;
        }, em2 = (e10) => (e10 - eu2) * 2 + r2 / 2, eg2 = [], ev2 = (e10, t3, a4, l4) => eg2.push({ t0: performance.now(), dur: e10, ease: t3, upd: a4, done: l4 }), ey2 = "intro", ex2 = 0, eb2 = 0, eM2 = 0, ew2 = 0, ek2 = 0, eS = false, eC = null, e$ = 0, eR = 0, eT = null, ej = false, eL = [], eA = (e10, t3) => eL.push(setTimeout(e10, t3));
        function eN() {
          Array.from(J2.children).forEach((e10, t3) => {
            e10.className = t3 < ex2 ? "done" : t3 === ex2 && "intro" !== ey2 && ex2 < 7 ? "cur" : "";
          }), Y2.textContent = "intro" === ey2 ? l3.surfaceLabel : ex2 >= 7 ? l3.completeLabel : l3.promptWord + " " + Math.min(ex2 + 1, 7) + " OF 7";
        }
        function eE(e10, t3) {
          let a4 = eM2;
          eM2 = e10;
          let l4 = t3 ? 1100 : 700, r3 = performance.now(), n4 = (i4) => {
            if (ej) return;
            let s4 = Math.min((i4 - r3) / l4, 1), o4 = 1 - Math.pow(1 - s4, 4);
            K2.textContent = String(Math.round(a4 + (e10 - a4) * (t3 && o4 < 0.9 ? 1.06 * o4 : o4))), s4 < 1 ? requestAnimationFrame(n4) : (K2.textContent = String(e10), t3 && (K2.classList.add("slam"), setTimeout(() => K2.classList.remove("slam"), 520)));
          };
          requestAnimationFrame(n4);
        }
        for (let [e10, t3, l4, r3] of a3.ambient) {
          let a4 = document.createElement("div");
          a4.className = "ds-amb " + l4 + (r3 ? " major" : ""), a4.innerHTML = r3 ? t3 : '<span class="dash">\u2500\u2500</span> ' + t3 + ' <span class="dash">\u2500\u2500</span>', a4.style.left = 2 * e10 + "px", G2.appendChild(a4);
        }
        function eI(e10 = false) {
          if (eT) {
            for (let t3 of eT) if (e10) t3.el.remove();
            else {
              let e11 = t3.el;
              e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
            }
            eT = null;
          }
        }
        function e_(e10, t3, a4, r3 = 0) {
          eC?.remove();
          let n4 = document.createElement("div");
          return n4.className = "ds-card ds-px", n4.style.left = 2 * a4 + "px", r3 && (n4.style.animationDelay = r3 + "s"), n4.innerHTML = `<div class="rnd">${l3.promptWord} ${e10 + 1} OF 7</div><div class="prompt"></div><div class="hint">${l3.hint}</div>`, n4.querySelector(".prompt").textContent = t3, G2.appendChild(n4), eC = n4, n4;
        }
        function eP(e10, t3) {
          if (e10.tier && eT) for (let t4 of eT) t4.tier === e10.tier && (t4.el.style.transition = "opacity .5s", t4.el.style.opacity = "0");
          let a4 = document.createElement("div"), r3 = e10.tier ? `var(--tier-${e10.tier})` : "var(--tier-miss-lit)";
          return a4.className = "ds-landed" + (e10.tier ? "" : " miss"), a4.style.left = 2 * t3 + "px", a4.style.setProperty("--tc", r3), a4.innerHTML = (e10.tier ? `<img class="icon" src="${(0, k.seasonalKrillSprite)(`/tiers/${e10.tier}.png`)}" alt="">` : "") + `<div class="tname">${e10.tier ? p.TIERS[e10.tier].name.toUpperCase() : l3.missTitle}</div><div class="tans"></div><div class="tpts"><b>+${e10.points} PTS</b>${e10.points > 0 ? ` &middot; ${l3.driveVerb} ${l3.fmtDist(e10.points)}` : ""}</div><div class="tsub"></div>`, a4.querySelector(".tans").textContent = e10.answerText ? `\u201C${e10.answerText}\u201D` : "\u2014", a4.querySelector(".tsub").textContent = e10.sub, G2.appendChild(a4), a4;
        }
        function eq() {
          I2.classList.remove("ds-shake"), I2.offsetWidth, I2.classList.add("ds-shake");
        }
        function eD() {
          O2.classList.remove("zap"), O2.offsetWidth, O2.classList.add("zap");
        }
        function eG(e10, t3, a4) {
          let l4 = 0, r3 = () => {
            W2.style.transition = "none", W2.style.background = e10, W2.style.opacity = ".42", requestAnimationFrame(() => requestAnimationFrame(() => {
              W2.style.transition = "opacity " + a4 + "ms ease-out", W2.style.opacity = "0";
            })), ++l4 < t3 && eA(r3, 2.1 * a4);
          };
          r3();
        }
        function eH(e10, t3, a4) {
          let l4 = a4 || 66;
          H2.style.background = `radial-gradient(circle at calc(${e10}px + var(--kr-ad-left, 0px)) calc(${t3}px + var(--kr-ad-top, 0px)), transparent ${l4}px, rgba(3,4,9,.78) ${l4 + 90}px, rgba(3,4,9,.97) ${l4 + 260}px)`;
        }
        let eF = null, eW = null, eO = 0, eU = null, eV = null, ez = false;
        function eB(e10) {
          if (ez = true, z2.setGold(true), U2.classList.add("gold"), !e10) {
            U2.classList.remove("gilding"), U2.offsetWidth, U2.classList.add("gilding"), eA(() => U2.classList.remove("gilding"), 1200), e6(tp, tm, "#ffd166", 16, 0.7);
            for (let e11 = 0; e11 < 12; e11++) e8(tp + A2(-18, 18), tm + A2(-18, 18));
          }
        }
        function eK() {
          ez = false, z2.setGold(false), U2.classList.remove("gold", "gilding");
        }
        function eJ() {
          eV = null, U2.classList.remove("perched");
        }
        let eY = { plankton: { dur: 3400, ease: (e10) => -(Math.cos(Math.PI * e10) - 1) / 2 }, tooclever: { dur: 3e3, ease: N2 }, schooler: { dur: 3e3, ease: N2 }, rare: { dur: 3400, ease: N2 }, deepcut: { dur: 4300, ease: N2 }, krillion: { dur: 4600, ease: N2 } }, eX = null;
        function eZ(e10, t3) {
          V2.classList.remove("celebrate", "faint", "sad", "roll", "punch"), V2.offsetWidth, e10 && V2.classList.add(e10), clearTimeout(eX), e10 && t3 && (eX = setTimeout(() => V2.classList.remove(e10), t3));
        }
        let eQ = [], e0 = [], e1 = [], e22 = [], e5 = (e10) => eu2 + (e10 - r2 / 2) / 2;
        function e42(e10, t3, l4, r3) {
          eQ.length > 90 || eQ.push({ x: e5(e10 + A2(-3, 3)), y: t3, vy: 14 + 18 * Math.random(), wob: 9 * Math.random(), life: 4, col: r3 || a3.particle, r: l4 });
        }
        function e32(e10, t3) {
          e1.length > 30 || e1.push({ x: e5(e10), y: t3, vx: A2(-14, -4) / 2, vy: A2(-16, -6), r: A2(4, 9), life: A2(0.8, 1.5), t: 0, col: ["rgba(30,34,44,.95)", "rgba(10,12,18,0)"] });
        }
        function e6(e10, t3, a4, l4, r3) {
          let n4 = e5(e10);
          for (let e11 = 0; e11 < l4 && e0.length < 260; e11++) {
            let e12 = Math.random() * Math.PI * 2, l5 = (30 + 130 * Math.random()) * r3;
            e0.push({ x: n4, y: t3, vx: Math.cos(e12) * l5 / 2, vy: Math.sin(e12) * l5, r: 1.5 + 2.5 * Math.random(), life: 0.6 + 0.8 * Math.random(), t: 0, color: a4 });
          }
        }
        function e8(e10, t3) {
          e0.length > 250 || e0.push({ x: e5(e10), y: t3, vx: A2(-24, 24) / 2, vy: A2(-20, 8), r: 1.6 + 2.6 * Math.random(), life: 0.5 + 0.7 * Math.random(), t: 0, color: ["#ffd166", "#ffe9a8", "#ffb000", "#ffffff"][4 * Math.random() | 0] });
        }
        function e9(e10, t3, a4) {
          let l4 = e5(e10);
          for (let e11 = 0; e11 < a4 && e1.length < 30; e11++) e1.push({ x: l4, y: t3, vx: A2(-40, -6) / 2, vy: A2(-26, -4), r: A2(10, 26), life: A2(0.9, 1.8), t: 0, col: ["rgba(226,222,210,.8)", "rgba(226,222,210,0)"] });
        }
        let e7 = (e10) => {
          let t3 = new Image();
          return t3.src = e10, t3;
        }, te = e7(a3.farBowl), tt = e7(a3.divider), ta = a3.venues.map((e10) => ({ ...e10, img: e7(e10.pane) })), tl = (e10) => !!e10 && e10.complete && e10.naturalWidth > 0, tr = {};
        for (let [e10, t3] of Object.entries(L)) tr[e10] = (function(e11) {
          let t4 = e11.rows[0].length, a4 = e11.rows.length, l4 = document.createElement("canvas");
          l4.width = 3 * t4, l4.height = 3 * a4;
          let r3 = l4.getContext("2d");
          return e11.rows.forEach((t5, a5) => {
            for (let l5 = 0; l5 < t5.length; l5++) {
              let n4 = e11.pal[t5[l5]];
              n4 && (r3.fillStyle = n4, r3.fillRect(3 * l5, 3 * a5, 3, 3));
            }
          }), l4;
        })(t3);
        let tn = { hardwood: ["#8a5426", "#6e3f1a"], clay: ["#a34e2e", "#7e3a22"], ice: ["#c8dcec", "#9cb8d0"], pitch: ["#256637", "#1a4d28"], gridiron: ["#2b6338", "#1e4a29"], pool: ["#1f6f8e", "#155069"], track: ["#933a30", "#6e2a23"] }, ti = [], ts = 0, to = [], td = [], tc = 0, th = null, tu = false;
        function tf(e10) {
          let t3 = ta[0].surface;
          for (let a4 of ta) if (e10 >= a4.from) t3 = a4.surface;
          else break;
          return t3;
        }
        let tp = -120, tm = 300, tg = 0, tv = 0, ty = -60, tx = 0, tb = 0, tM = 0, tw = 0, tk = NaN, tS = NaN, tC = (0, $.bindMascotTap)(U2, () => {
          et2.event("blub");
          let t3 = z2.current();
          eZ("mantis-shrimp" === t3.id ? t3.poke : "roll", "mantis-shrimp" === t3.id ? t3.pokeMs : 950);
          let a4 = e4.querySelector(".ds-blub");
          a4.classList.remove("show"), a4.offsetWidth, a4.classList.add("show");
          for (let e10 = 0; e10 < 6; e10++) e42(tp + A2(-16, 26), tm - 16, 1 + 3 * Math.random());
          e6(tp, tm, "#ffb000", 10, 0.5), e6(tp, tm - 12, "#fffbe8", 8, 0.4);
        }), t$ = 0, tR = (t3) => {
          let l4 = performance.now();
          !y2.reducedMotion && eu2 > 440 && l4 - t$ > 50 && e0.length < 250 && (t$ = l4, y2.invalidate(), e0.push({ x: e5(t3.clientX - e4.getBoundingClientRect().left + A2(-6, 6)), y: t3.clientY - e4.getBoundingClientRect().top + A2(-4, 4), vx: A2(-14, 14) / 2, vy: A2(-10, 10), r: 1.6, life: 0.9, t: 0, color: a3.sparkle }));
        };
        return e4.addEventListener("pointermove", tR), Q2(), ep2(-45), eN(), y2.start(function(t3, l4, i4) {
          if (ej) return;
          b2 !== y2.revision && (b2 = y2.revision, Z2()), X2 && Q2();
          for (let e10 = eg2.length - 1; e10 >= 0; e10--) {
            let a4 = eg2[e10], l5 = (t3 - a4.t0) / a4.dur;
            l5 >= 1 ? (a4.upd(a4.ease(1)), eg2.splice(e10, 1), a4.done?.()) : a4.upd(a4.ease(Math.max(0, l5)));
          }
          eh2 += (ec2 - eh2) * (1 - Math.exp(("plunge" === ey2 ? -11 : -6) * l4)), ef2 = eu2, eu2 = eh2 + (y2.reducedMotion ? 0 : 1.4 * Math.sin(0.45 * i4)), G2.style.transform = `translate3d(${r2 / 2 - 2 * eu2}px,0,0)`;
          let s4 = String(Math.floor(Math.max(0, eb2) / 8));
          B2.textContent !== s4 && (B2.textContent = s4), e4.querySelector(".ds-vignette").style.opacity = Math.min(0.72, 0.25 + Math.max(0, eu2) / 2400).toFixed(3);
          let o4 = q2.createLinearGradient(0, 0, 0, m2());
          o4.addColorStop(0, a3.skyTint[0]), o4.addColorStop(0.55, a3.skyTint[1]), o4.addColorStop(1, a3.skyTint[2]), q2.fillStyle = o4, q2.fillRect(c3(), u2(), h2(), m2() + 6 - u2()), q2.fillStyle = a3.skyTint[0], q2.fillRect(c3(), m2(), h2(), n3 + d3 - m2()), (function(e10, t4, a4) {
            if (!tl(e10)) return;
            let l5 = a4 * e10.naturalWidth / e10.naturalHeight, r3 = 2 * eu2 * 0.3;
            q2.save(), q2.globalAlpha = 0.85;
            let n4 = Math.floor((r3 + c3()) / l5) - 1, i5 = Math.floor((r3 + c3() + h2()) / l5) + 1;
            for (let s5 = n4; s5 <= i5; s5++) q2.drawImage(e10, s5 * l5 - r3, t4 - a4, l5 + 1, a4);
            q2.restore();
          })(te, 0.52 * n3, 0.5 * n3), y2.reducedMotion || (function(e10) {
            Math.random() < ((ts = Math.max(0, ts - e10)) > 0 ? 26 : 2.2) * y2.particleScale * e10 && ti.length < 40 && ti.push({ x: e5(A2(c3(), c3() + h2())), y: A2(0.1 * n3, 0.6 * n3), t: 0 });
            for (let t4 = ti.length - 1; t4 >= 0; t4--) {
              let a4 = ti[t4];
              if (a4.t += e10, a4.t > 0.22) {
                ti.splice(t4, 1);
                continue;
              }
              let l5 = a4.t < 0.06 ? 0.85 : 0.85 * (1 - (a4.t - 0.06) / 0.16), r3 = em2(a4.x);
              !(r3 < c3() - 10 || r3 > c3() + h2() + 10) && (q2.fillStyle = `rgba(255,255,255,${l5})`, q2.fillRect(r3 - 1, a4.y - 1, 3, 3), a4.t < 0.06 && (q2.fillStyle = `rgba(255,255,255,${0.35 * l5})`, q2.fillRect(r3 - 3, a4.y, 7, 1), q2.fillRect(r3, a4.y - 3, 1, 7)));
            }
          })(l4), (function() {
            let e10 = m2();
            for (let t4 = 0; t4 < ta.length - 1; t4++) {
              let a4 = em2((ta[t4].to + ta[t4 + 1].from) / 2);
              if (!(a4 < c3() - 200 || a4 > c3() + h2() + 200)) if (tl(tt)) {
                let t5 = 0.62 * n3, l5 = t5 * tt.naturalWidth / tt.naturalHeight;
                q2.drawImage(tt, a4 - l5 / 2, e10 - t5 + 8, l5, t5);
              } else q2.fillStyle = "#0c1018", q2.fillRect(a4 - 70, 0.14 * n3, 140, e10 - 0.14 * n3 + 8), q2.fillStyle = "#05070c", q2.beginPath(), q2.arc(a4, e10 - 20, 46, Math.PI, 0), q2.rect(a4 - 46, e10 - 20, 92, 20), q2.fill();
            }
          })(), (function() {
            let e10 = m2();
            for (let t4 of ta) {
              let a4 = em2(t4.from), l5 = em2(t4.to);
              if (l5 < c3() - 80 || a4 > c3() + h2() + 80) continue;
              let r3 = l5 - a4;
              if (!tl(t4.img)) {
                let [i6, s5] = tn[t4.surface], o5 = q2.createLinearGradient(0, e10, 0, n3);
                o5.addColorStop(0, i6), o5.addColorStop(1, s5), q2.fillStyle = o5, q2.fillRect(a4, e10, r3, n3 + d3 - e10), q2.fillStyle = "rgba(240,244,250,0.5)", q2.fillRect(a4, e10, r3, 2), q2.fillRect(a4 + 2, e10, 2, n3 + d3 - e10), q2.fillRect(l5 - 4, e10, 2, n3 + d3 - e10);
                let c4 = (a4 + l5) / 2;
                q2.fillRect(c4 - 1, e10, 2, n3 + d3 - e10);
                continue;
              }
              let i5 = Math.min(r3 * t4.img.naturalHeight / t4.img.naturalWidth, 0.96 * n3);
              q2.drawImage(t4.img, a4, n3 - i5 + (t4.dy ?? 0), r3, i5);
            }
            for (let t4 = 0; t4 < ta.length - 1; t4++) {
              let a4 = ta[t4].to, l5 = ta[t4 + 1].from, r3 = em2(a4), i5 = em2(l5);
              if (i5 < c3() - 40 || r3 > c3() + h2() + 40) continue;
              let s5 = q2.createLinearGradient(0, e10, 0, n3);
              s5.addColorStop(0, "#181c24"), s5.addColorStop(1, "#0a0d14"), q2.fillStyle = s5, q2.fillRect(r3, e10 + 2, i5 - r3, n3 + d3 - e10 - 2);
            }
            {
              let t4 = em2(ta[0].from);
              if (t4 > c3() - 40) {
                let a4 = q2.createLinearGradient(0, e10, 0, n3);
                a4.addColorStop(0, "#181c24"), a4.addColorStop(1, "#0a0d14"), q2.fillStyle = a4, q2.fillRect(c3() - 40, e10 + 2, Math.min(t4, c3() + h2() + 40) - (c3() - 40), n3 + d3 - e10 - 2);
              }
            }
            {
              let t4 = em2(ta[ta.length - 1].to);
              if (t4 < c3() + h2() + 40) {
                let a4 = q2.createLinearGradient(0, e10, 0, n3);
                a4.addColorStop(0, "#1a1e26"), a4.addColorStop(1, "#0c0f16"), q2.fillStyle = a4, q2.fillRect(Math.max(c3() - 40, t4), e10 + 2, c3() + h2() + 40 - Math.max(c3() - 40, t4), n3 + d3 - e10 - 2);
              }
            }
          })();
          let p2 = (eu2 - ef2) * 2;
          for (let e10 of to) e10.x -= p2 * e10.par - 9 * Math.sin(0.6 * i4 + e10.ph) * l4, e10.y += 6 * Math.sin(0.4 * i4 + e10.ph) * l4, e10.x > c3() + h2() + 10 && (e10.x = c3() - 10), e10.x < c3() - 10 && (e10.x = c3() + h2() + 10), e10.y > n3 + d3 + 10 && (e10.y -= f2() + 20), e10.y < u2() - 10 && (e10.y += f2() + 20), q2.fillStyle = `rgba(${a3.dust[0]},${e10.a})`, q2.fillRect(e10.x, e10.y, e10.r, e10.r);
          !(function(e10, t4) {
            D2.clearRect(0, 0, r2, n3);
            let l5 = (eu2 - ef2) * 2;
            for (let n4 of td) n4.x -= l5 * n4.par - 13.2 * Math.sin(0.5 * e10 + n4.ph) * t4, n4.x > r2 + 12 && (n4.x = -12), n4.x < -12 && (n4.x = r2 + 12), D2.fillStyle = `rgba(${a3.dust[1]},${n4.a})`, D2.fillRect(n4.x, n4.y, n4.r, n4.r);
            {
              let e11 = tp, t5 = g2() + 30, a4 = 0.5 * Math.max(0, g2() - 12 - tm);
              D2.save(), D2.translate(e11, t5), D2.scale(1, 0.2), D2.fillStyle = `rgba(0,0,0,${Math.max(0.2, 0.5 - 0.01 * a4)})`, D2.beginPath(), D2.arc(0, 0, Math.max(18, 30 - 0.3 * a4), 0, 7), D2.fill(), D2.restore();
            }
            if (!(function(e11, t5, a4, l6) {
              let r3 = tf(ty);
              if (r3 !== th && (th && e6(a4 + 20, g2() - 14, "#ffe9a8", 6, 0.4), th = r3, tc = 0), "pool" === r3) {
                l6 > 12 && 0.5 > Math.random() && e42(a4 - 24 + A2(-6, 6), g2() + A2(2, 10), 1 + 1.6 * Math.random(), "205,232,246");
                return;
              }
              let n4 = tr[r3];
              if (!n4) return;
              let i5 = l6 > 6;
              if (D2.save(), "hardwood" === r3 || "clay" === r3) {
                let e12 = Math.abs(Math.sin(tc += (y2.reducedMotion ? 0 : t5) * (("clay" === r3 ? 3.1 : 2.2) + Math.min(l6, 260) * ("clay" === r3 ? 0.014 : 0.011)) * Math.PI)), i6 = a4 + 28 + Math.min(0.05 * l6, 14), s5 = g2() - 4 - e12 * ("clay" === r3 ? 15 : 27) - n4.height / 2, o5 = e12 < 0.14;
                o5 && !tu && e42(i6, g2() + 2, 1 + Math.random(), "clay" === r3 ? "199,120,80" : "236,220,190"), tu = o5, D2.translate(Math.round(i6), Math.round(s5)), o5 && D2.scale(1.15, 0.8), D2.drawImage(n4, -n4.width / 2, -n4.height / 2);
              } else if ("ice" === r3) {
                let t6 = a4 + 30 + 7 * Math.sin(3.1 * e11) + Math.min(0.05 * l6, 12), r4 = g2() - n4.height / 2 + 2;
                i5 && 0.3 > Math.random() && e42(t6 - 8, g2() + 3, 0.8 + Math.random(), "225,238,248"), D2.translate(Math.round(t6), Math.round(r4)), D2.drawImage(n4, -n4.width / 2, -n4.height / 2);
              } else if ("pitch" === r3) {
                let e12 = a4 + 28 + Math.min(0.04 * l6, 10), t6 = 6 * !!i5 * Math.abs(Math.sin(ty / 45)), r4 = g2() - n4.height / 2 - 1 - t6;
                D2.translate(Math.round(e12), Math.round(r4)), D2.rotate(2 * ty / (n4.width / 2) * 0.35), D2.drawImage(n4, -n4.width / 2, -n4.height / 2);
              } else if ("gridiron" === r3) {
                let e12 = g2() - 30 - 2 * Math.abs(Math.sin(tc));
                tc += (y2.reducedMotion ? 0 : t5) * (2 + 0.01 * l6) * Math.PI, D2.translate(Math.round(a4 + 10), Math.round(e12)), D2.rotate(-0.18), D2.drawImage(n4, -n4.width / 2, -n4.height / 2);
              } else {
                tc += (y2.reducedMotion ? 0 : t5) * (3 + 0.02 * l6) * Math.PI;
                let e12 = g2() - 24;
                D2.translate(Math.round(a4 + 16), Math.round(e12)), D2.rotate(0.45 * Math.sin(tc)), D2.drawImage(n4, -n4.width / 2, -n4.height / 2);
              }
              D2.restore();
            })(e10, t4, tp, tx), eS) {
              let e11 = em2(ew2), t5 = g2() + ek2, a4 = D2.createRadialGradient(e11, t5 - 26, 6, e11, t5 - 26, 84);
              a4.addColorStop(0, "rgba(255,231,186,.1)"), a4.addColorStop(1, "rgba(255,231,186,0)"), D2.fillStyle = a4, D2.beginPath(), D2.arc(e11, t5 - 26, 84, 0, 7), D2.fill();
            }
            if (eF) {
              let t5, a4;
              "follow" === eW && eS ? (t5 = em2(ew2), a4 = g2() + ek2) : eU ? (t5 = eU.x, a4 = m2() + 20) : (t5 = r2 / 2, a4 = n3 / 2), (function(e11, t6, a5, l6) {
                if (!eF) return;
                let r3 = "hold" === eW ? 0.62 : 1;
                for (let n4 of eF) {
                  let i5 = n4.rad * r3 * (1 + 7 * eO), s5 = a5 + Math.cos(n4.ang + t6 * n4.w) * i5 * 1.12, o5 = l6 + Math.sin(n4.ang + t6 * n4.w) * i5 * 0.62 + 4 * Math.sin(2.2 * t6 + n4.ph);
                  e11.globalAlpha = Math.max(0, 0.92 - 1.15 * eO), e11.save(), e11.translate(s5, o5);
                  let d4 = 0.8 * n4.s, c4 = 0.7 + 0.3 * Math.sin(5 * t6 + n4.ph);
                  e11.fillStyle = `rgba(255,209,102,${c4})`, e11.fillRect(-d4 / 2, -1.5, d4, 3), e11.fillRect(-1.5, -d4 / 2, 3, d4), e11.fillStyle = `rgba(255,233,168,${c4})`, e11.fillRect(-2, -2, 4, 4), e11.restore();
                }
                e11.globalAlpha = 1;
              })(D2, e10, t5, a4);
            }
            for (let a4 = eQ.length - 1; a4 >= 0; a4--) {
              let l6 = eQ[a4];
              l6.y -= l6.vy * t4, l6.life -= t4;
              let n4 = em2(l6.x) + 3 * Math.sin(3 * e10 + l6.wob);
              if (l6.life <= 0 || l6.y < -30 || n4 < -40 || n4 > r2 + 40) {
                eQ.splice(a4, 1);
                continue;
              }
              let i5 = Math.min(0.7, 0.5 * l6.life);
              if (D2.fillStyle = `rgba(${l6.col},${i5})`, l6.r > 2.6) {
                let e11 = 1.6 * l6.r;
                D2.fillRect(n4 - e11 / 2, l6.y - 1, e11, 2), D2.fillRect(n4 - 1, l6.y - e11 / 2, 2, e11), D2.fillRect(n4 - 1.5, l6.y - 1.5, 3, 3);
              } else D2.fillRect(n4 - l6.r / 2, l6.y - l6.r / 2, l6.r, l6.r);
            }
            for (let e11 = e1.length - 1; e11 >= 0; e11--) {
              let a4 = e1[e11];
              a4.t += t4;
              let l6 = a4.t / a4.life;
              if (l6 >= 1) {
                e1.splice(e11, 1);
                continue;
              }
              a4.x += a4.vx * t4, a4.y += a4.vy * t4, a4.vy *= 1 - 1.2 * t4;
              let r3 = em2(a4.x), n4 = a4.r * (0.5 + l6);
              D2.globalAlpha = 0.4 * (1 - l6);
              let i5 = D2.createRadialGradient(r3, a4.y, 0, r3, a4.y, n4);
              i5.addColorStop(0, a4.col[0]), i5.addColorStop(1, a4.col[1]), D2.fillStyle = i5, D2.beginPath(), D2.arc(r3, a4.y, n4, 0, 7), D2.fill();
            }
            D2.globalAlpha = 1;
            for (let a4 = e22.length - 1; a4 >= 0; a4--) {
              let l6 = e22[a4];
              if (l6.t += t4, l6.t > l6.life) {
                e22.splice(a4, 1);
                continue;
              }
              l6.x += l6.vx * t4 + 24 * Math.sin(2.4 * e10 + l6.ph) * t4 / 2, l6.y += l6.vy * t4;
              let i5 = em2(l6.x);
              if (i5 < -30 || i5 > r2 + 30 || l6.y > n3 + 20) {
                e22.splice(a4, 1);
                continue;
              }
              D2.globalAlpha = Math.min(1, (l6.life - l6.t) * 1.4), D2.save(), D2.translate(i5, l6.y), D2.rotate(1.1 * Math.sin(3 * e10 + l6.ph)), D2.fillStyle = l6.color, D2.fillRect(-(1.1 * l6.r), -(0.4 * l6.r), 2.2 * l6.r, 0.8 * l6.r), D2.restore();
            }
            D2.globalAlpha = 1;
            for (let e11 = e0.length - 1; e11 >= 0; e11--) {
              let a4 = e0[e11];
              if (a4.t += t4, a4.t > a4.life) {
                e0.splice(e11, 1);
                continue;
              }
              a4.x += a4.vx * t4, a4.y += a4.vy * t4, a4.vx *= 1 - 2.4 * t4, a4.vy *= 1 - 2.4 * t4, a4.vy += 30 * t4, D2.globalAlpha = 1 - a4.t / a4.life, D2.fillStyle = a4.color, D2.fillRect(em2(a4.x) - a4.r / 2, a4.y - a4.r / 2, a4.r, a4.r);
            }
            D2.globalAlpha = 1;
          })(i4, l4), (function(t4, a4) {
            eV && !eV.isConnected && eJ();
            let l5 = ty, n4 = "finale" === ey2 ? 0.12 : null;
            if (null !== n4) ty = eu2 + (r2 * n4 - r2 / 2) / 2;
            else if ("plunge" === ey2) ty = ew2;
            else {
              let e10 = "intro" === ey2 ? -60 : e$;
              ty += (e10 - ty) * (1 - Math.exp(("descend" === ey2 ? -1.5 : -3.4) * a4));
            }
            let i5 = Math.abs(ty - l5) / Math.max(a4, 1e-4);
            tx += (i5 - tx) * (1 - Math.exp(-8 * a4));
            let s5 = "plunge" === ey2 ? ek2 : 0, o5 = "pool" === tf(ty);
            tb += (y2.reducedMotion ? 0 : a4) * (3.4 + 0.075 * Math.min(tx, 280));
            let d4 = Math.abs(Math.sin(tb)), c4 = o5 ? 5 * Math.sin(2.6 * t4) : d4 * Math.min(2.5 + 0.03 * tx, 7), h3 = tp, u3 = 0;
            if (h3 = em2(ty), u3 = g2() - 26 + s5 - c4 + 10 * !!o5, eV) {
              let t5 = eV.getBoundingClientRect();
              h3 = t5.left - e4.getBoundingClientRect().left + t5.width / 2, u3 = t5.top - e4.getBoundingClientRect().top + t5.height / 2, U2.classList.add("perched");
            }
            !Number.isNaN(tk) && (Math.abs(h3 - tk) > 60 || Math.abs(u3 - tS) > 60) && (tM -= h3 - tk, tw -= u3 - tS), tk = h3, tS = u3;
            let f3 = 1 - Math.exp(-6.5 * a4);
            tM -= tM * f3, tw -= tw * f3, tp = h3 + tM, tm = u3 + tw;
            let p3 = eV ? 0 : o5 ? -6 : Math.min(11, 0.05 * tx) + 1.2 * Math.sin(0.9 * t4);
            tg += (p3 - tg) * f3;
            let m3 = U2.offsetWidth / 2;
            U2.style.transform = `translate3d(${tp - m3}px,${tm - m3}px,0) rotate(${tg}deg)`, !y2.reducedMotion && ez && t4 - tv > 0.55 && e0.length < 200 && (tv = t4, e0.push({ x: e5(tp + A2(-10, 10)), y: tm + A2(-4, 12), vx: A2(-10, 10) / 2, vy: A2(-14, 6), r: 1.2 + 1.6 * Math.random(), life: 0.6 + 0.5 * Math.random(), t: 0, color: 0.5 > Math.random() ? "#ffd166" : "#ffe9a8" }));
          })(i4, l4);
        }, () => eg2.length > 0 || "plunge" === ey2 || "descend" === ey2 || Math.abs(ec2 - eh2) > 0.1), { intro() {
          y2.invalidate(), G2.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e10) => e10.remove()), eT = null, eC = null, G2.classList.remove("ds-reveal"), H2.classList.remove("on"), eg2.length = 0, eF = null, eW = null, eO = 0, eU = null, eJ(), eK(), e$ = 0, ex2 = 0, eb2 = 0, eM2 = 0, K2.textContent = "0", ey2 = "intro", ec2 = -45, ty = -60, eN();
        }, finale() {
          y2.invalidate(), z2.setGold(ez), G2.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e11) => e11.remove()), eT = null, eC = null, G2.classList.remove("ds-reveal"), H2.classList.remove("on"), eF = null, eW = null, eO = 0, eU = null, eJ(), ey2 = "finale", eg2.length = 0;
          let e10 = ec2;
          ev2(Math.min(9e3, Math.max(2500, 3 * e10)), E2, (t3) => {
            ec2 = w2(e10, -45, t3);
          }), et2.event("surface"), eN();
        }, descendToRound(e10, t3, a4 = 2200) {
          y2.invalidate(), eI(), G2.classList.remove("ds-reveal"), eJ(), G2.querySelectorAll(".ds-landed").forEach((e11) => {
            e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
          }), e_(e10, t3, eR = e$, 0.45), ey2 = "descend", eD(), eN();
          let l4 = ec2, r3 = eR;
          ev2(a4, N2, (e11) => {
            ec2 = w2(l4, r3, e11);
          }, () => {
            ey2 = "round", eN();
          });
        }, restore(e10, t3, a4) {
          y2.invalidate(), G2.querySelectorAll(".ds-landed,.ds-card,.ds-tierline").forEach((e11) => e11.remove()), eT = null, eC = null, ex2 = a4.length, eJ(), a4.some((e11) => "krillion" === e11.tier) ? eB(true) : eK();
          let l4 = a4.reduce((e11, t4) => e11 + t4.points, 0);
          eb2 = e$ = 8 * l4, eM2 = l4, K2.textContent = String(l4), eR = e$, e10 < 7 && t3 && e_(e10, t3, eR), ep2(eR), ty = eR, ey2 = "round", eN();
        }, plunge(e10, t3) {
          y2.invalidate(), null !== e10.tier && (function(e11) {
            for (let t4 of (eI(true), eT = [], p.TIER_IDS)) {
              let a4 = p.TIERS[t4], l4 = e11 + 8 * a4.score, r3 = document.createElement("div");
              r3.className = "ds-tierline", r3.style.left = 2 * l4 + "px", r3.style.setProperty("--tc", `var(--tier-${t4})`), r3.innerHTML = `<div class="tag"><img src="${(0, k.seasonalKrillSprite)(`/tiers/${t4}.png`)}" alt="">${a4.name.toUpperCase()} &middot; ${a4.score}</div><i class="pole"></i>`, r3.style.setProperty("--tag-y", eT.length % 2 ? "-52px" : "-24px"), r3.style.opacity = "0", G2.appendChild(r3);
              let n4 = 90 * eT.length;
              requestAnimationFrame(() => {
                r3.style.transition = "opacity .55s ease-out " + n4 + "ms", r3.style.opacity = "1";
              }), eT.push({ d: l4, el: r3, tier: t4, passed: false });
            }
          })(eR), (function(e11, t4) {
            ey2 = "plunge", G2.classList.add("ds-reveal");
            let l4 = eR, i4 = e11.tier ?? "miss";
            if (eC) {
              let e12 = eC;
              e6(em2(l4), m2() - 40, "#ffd166", 12, 0.6), e12.classList.add("gone"), setTimeout(() => e12.remove(), 650), eC = null;
            }
            if (!e11.tier) {
              let a4 = l4 + 40;
              eq(), eD(), et2.event("miss"), eG("rgba(61,79,110,.5)", 1, 200), eZ("sad", 2600);
              for (let e12 = 0; e12 < 7; e12++) e32(em2(l4) + A2(-30, 30), g2() + A2(-10, 6));
              eA(() => {
                eP(e11, a4), e$ = l4, ex2++, ec2 = a4 + v2(), eb2 = l4, eE(e11.newScore, false), ey2 = "landed", eN(), eA(() => G2.classList.remove("ds-reveal"), 900), t4();
              }, 900);
              return;
            }
            let s4 = p.TIERS[e11.tier], o4 = eY[e11.tier], d4 = l4 + 8 * s4.score, c4 = e11.answerText.toUpperCase(), h3 = document.createElement("div");
            h3.className = "ds-chip gl-plate-wrap", h3.style.setProperty("--cc", `var(--tier-${e11.tier})`), h3.style.top = Math.round(g2() - 126) + "px", h3.innerHTML = `<span class="gl-plate">\u201C${c4}\u201D</span>`, G2.appendChild(h3);
            let u3 = ty, f3 = eb2;
            switch (ew2 = u3, eS = true, et2.event("sink"), i4) {
              case "plankton":
                eZ("sad", o4.dur + 800);
                break;
              case "tooclever":
                eG("rgba(255,159,67,.7)", 3, 130), eq(), eZ("faint", 2400), (function(e12) {
                  let t5 = r2 < 700 ? 6 : 9;
                  for (let a4 = 0; a4 < t5; a4++) {
                    let t6 = document.createElement("span");
                    t6.className = "ds-swarm-fish gl-swarm-jersey", I2.appendChild(t6);
                    let l5 = a4 % 2 == 0, i5 = l5 ? -90 : r2 + 90, s5 = l5 ? r2 + 90 : -90, o5 = 0.74 * n3 + A2(-26, 40), d5 = 110 * a4, c5 = A2(1100, 1800);
                    t6.animate([{ transform: `translate(${i5}px,${o5}px) scaleX(${l5 ? 1 : -1})` }, { transform: `translate(${(i5 + s5) / 2}px,${o5 + A2(-8, 8)}px) scaleX(${l5 ? 1 : -1})`, offset: 0.5 }, { transform: `translate(${s5}px,${o5}px) scaleX(${l5 ? 1 : -1})` }], { duration: c5, delay: d5, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "both" }), setTimeout(() => t6.remove(), Math.min(d5 + c5 + 100, e12 + 1400));
                  }
                })(o4.dur);
                break;
              case "rare":
                eG("rgba(255,82,82,.4)", 1, 220), e9(em2(u3), g2() + 8, 10);
                break;
              case "deepcut":
                eH(em2(u3), g2()), H2.classList.add("on");
                break;
              case "krillion":
                eG("rgba(255,209,102,.45)", 1, 180), h3.classList.add("gold"), eW = "follow", eO = 0, eF = [];
                let y3 = r2 < 700 ? 14 : 20;
                for (let e12 = 0; e12 < y3; e12++) eF.push({ ang: Math.random() * Math.PI * 2, rad: 30 + 48 * Math.random(), w: (0.7 + 1.5 * Math.random()) * (0.5 > Math.random() ? -1 : 1), ph: 9 * Math.random(), s: 15 + 13 * Math.random() });
            }
            ev2(o4.dur, o4.ease, (t5) => {
              ew2 = w2(u3, d4, t5);
              let a4 = 0;
              "plankton" === i4 ? (ek2 = 10 * Math.sin(7 * t5) * (1 - 0.25 * t5), a4 = 2 * Math.sin(9 * t5)) : "tooclever" === i4 ? (ek2 = 4 * Math.sin(42 * t5) + A2(-1.5, 1.5), a4 = A2(-2, 2)) : "krillion" === i4 ? (ek2 = Math.sin(24 * t5) * (1 - t5) * 8, a4 = 1.5 * Math.sin(18 * t5)) : (ek2 = Math.sin(16 * t5) * (1 - t5) * 5, a4 = 1.2 * Math.sin(12 * t5)), h3.style.transform = `translate3d(calc(${2 * ew2}px - 50%), ${ek2}px, 0) rotate(${a4}deg)`, ec2 = ew2 + v2(), "krillion" !== i4 && (eb2 = w2(f3, d4, t5));
              let l5 = em2(ew2), r3 = g2() + ek2;
              if ("plankton" === i4 ? 0.25 > Math.random() && e32(l5 - 30, r3 + 4) : "rare" === i4 ? 0.12 > Math.random() && e9(l5 - 24, r3 + 8, 3) : "krillion" === i4 ? 0.5 > Math.random() && e42(l5 - 28, r3 + A2(-16, 4), 1.5 + 2 * Math.random()) : "deepcut" === i4 ? (eH(l5, r3), 0.3 > Math.random() && e42(l5 - 26, r3, 1 + 2 * Math.random())) : 0.6 > Math.random() && e42(l5 - 28 + A2(-6, 6), r3 + A2(-4, 8), 1.5 + 2.5 * Math.random()), eT) for (let t6 of eT) !t6.passed && ew2 > t6.d - 4 && (t6.passed = true, t6.el.classList.add("passed"), et2.event("tierline"), t6.tier !== e11.tier && e6(em2(t6.d), m2() + 24, j[t6.tier], 7, 0.5));
            }, () => {
              eS = false, h3.remove(), (function(e12, t5, l5) {
                ey2 = "landed";
                let i5 = e12.tier;
                et2.event("krillion" === i5 ? "krillion" : "plankton" === i5 || "tooclever" === i5 ? "land_small" : "land_big");
                let s5 = eP(e12, t5);
                e$ = t5, ex2++, ec2 = t5 + v2();
                let o5 = em2(t5), d5 = g2() - 6, c5 = j[i5];
                switch (i5) {
                  case "plankton":
                    e6(o5, d5, "#8fa3c4", 8, 0.4), eb2 = t5, eE(e12.newScore, false);
                    break;
                  case "tooclever":
                    eG("rgba(255,159,67,.6)", 2, 130), eq(), e6(o5, d5, c5, 18, 0.7), eb2 = t5, eE(e12.newScore, false);
                    break;
                  case "schooler":
                    e6(o5, d5, c5, 22, 0.8), eb2 = t5, eE(e12.newScore, false);
                    break;
                  case "rare":
                    e9(o5, d5, 18), e6(o5, d5, c5, 26, 0.9), eq(), eG("rgba(255,82,82,.45)", 1, 240), eb2 = t5, eE(e12.newScore, false);
                    break;
                  case "deepcut":
                    eH(o5, d5, 200), e6(o5, d5, c5, 18, 0.7), eb2 = t5, eE(e12.newScore, false), eA(() => H2.classList.remove("on"), 550);
                    break;
                  case "krillion":
                    eW = "hold", eU = { x: o5, d: t5 }, s5.classList.add("perched"), eG("rgba(255,255,255,.5)", 4, 110), ts = 3.2, (function() {
                      let e13 = r2 < 700 ? 60 : 110;
                      for (let t6 = 0; t6 < e13 && e22.length < 220; t6++) e22.push({ x: e5(A2(-(0.1 * r2), 1.1 * r2)), y: A2(-(0.25 * n3), 0.3 * n3), vx: A2(-16, 16) / 2, vy: A2(30, 90), r: A2(3, 5.5), life: A2(2.4, 4.4), t: 0, ph: A2(0, 9), color: a3.confetti[Math.random() * a3.confetti.length | 0] });
                    })();
                    for (let e13 = 0; e13 < 14; e13++) eA(() => e8(A2(0.1 * r2, 0.9 * r2), A2(0.2 * n3, 0.8 * n3)), 90 * e13);
                    eZ("celebrate", 1250), eA(() => {
                      eB(), ev2(1500, E2, (e13) => {
                        eO = e13;
                      }, () => {
                        eF = null, eW = null, eO = 0;
                      }), eE(e12.newScore, true), eA(() => {
                        let e13, a4, l6;
                        return e13 = eb2, a4 = 0, l6 = setInterval(() => {
                          eb2 = Math.round(e13 + (t5 - e13) * (1 - Math.pow(1 - ++a4 / 8, 2))), B2.classList.remove("crank"), B2.offsetWidth, B2.classList.add("crank"), a4 >= 8 && (clearInterval(l6), eb2 = t5);
                        }, 110), void eL.push(l6);
                      }, 350), eA(() => {
                        "landed" === ey2 && (eV = s5.querySelector(".icon"));
                      }, 900);
                    }, 1e3);
                }
                eN(), eI(), G2.classList.remove("ds-reveal"), l5();
              })(e11, d4, t4);
            });
          })(e10, t3);
        }, showLanded(e10, t3) {
          y2.invalidate();
          let a4 = e10.tier ? eR + 8 * e10.points : eR + 40;
          eC?.remove(), eC = null;
          let l4 = eP(e10, a4);
          "krillion" === e10.tier ? (eB(true), l4.classList.add("perched"), eV = l4.querySelector(".icon")) : eJ(), e$ = e10.tier ? a4 : eR, ex2++, eb2 = e$, eM2 = e10.newScore, K2.textContent = String(e10.newScore), ep2(a4 + v2()), ty = e$, ey2 = "landed", eN(), t3 && requestAnimationFrame(() => t3());
        }, setUrgency(t3) {
          if (e4.style.setProperty("--ds-urgency", t3.toFixed(3)), F2.classList.toggle("danger", t3 > 0.8), t3 > 0.8 && t3 < 1) {
            let e10 = Math.ceil((1 - t3) * 15);
            e10 !== ed2 && (ed2 = e10, et2.event("tick"));
          } else ed2 = -1;
        }, typeFx(e10, t3) {
          y2.invalidate(), e42(e10 + A2(-3, 3), t3 + A2(4, 12), 1 + 2 * Math.random()), 0.3 > Math.random() && e42(e10 + A2(-8, 8), t3 + A2(2, 10), 1 + 1.6 * Math.random());
        }, submitFx(t3) {
          y2.invalidate(), eD(), et2.event("submit");
          let a4 = e4.getBoundingClientRect().left, l4 = e4.getBoundingClientRect().top;
          for (let e10 = 0; e10 < 12; e10++) e42(t3.left - a4 + A2(0, t3.width), t3.top - l4 + A2(0, t3.height), 2 + 3 * Math.random());
          F2.classList.remove("danger"), e4.style.setProperty("--ds-urgency", "0");
        }, rejectFx() {
          y2.invalidate(), eD(), et2.event("reject"), e32(r2 / 2 + A2(-40, 40), n3 - 120), e32(r2 / 2 + A2(-40, 40), n3 - 130);
        }, destroy() {
          ej = true, z2.destroy(), y2.destroy(), x2(), removeEventListener("resize", Z2), ee2.disconnect(), e4.removeEventListener("pointermove", tR), tC(), ea2.removeEventListener("click", eo2), es2(), et2.release(), eL.forEach((e10) => {
            clearTimeout(e10), clearInterval(e10);
          }), eL = [], eg2.length = 0, e4.innerHTML = "";
        } };
      })(s2.current, c2.current);
      return o2.current = e3, d2.current?.(), () => {
        e3.destroy(), o2.current = null;
      };
    }, []), (0, r.useImperativeHandle)(i2, () => ({ intro: (...e3) => o2.current?.intro(...e3), finale: (...e3) => o2.current?.finale(...e3), descendToRound: (...e3) => o2.current?.descendToRound(...e3), restore: (...e3) => o2.current?.restore(...e3), plunge: (...e3) => o2.current?.plunge(...e3), showLanded: (...e3) => o2.current?.showLanded(...e3), setUrgency: (...e3) => o2.current?.setUrgency(...e3), typeFx: (...e3) => o2.current?.typeFx(...e3), submitFx: (...e3) => o2.current?.submitFx(...e3), rejectFx: (...e3) => o2.current?.rejectFx(...e3), destroy: () => {
    } }), []), (0, t.jsx)(w.default, { phase: e2, disabled: "tour" === e2, children: (0, t.jsxs)("div", { className: "ds-root", "data-phase": e2, "data-world": "gauntlet", children: [(0, t.jsx)("div", { ref: s2, style: { position: "absolute", inset: 0 } }), n2] }) });
  }), N = { plankton: "#8fa3c4", tooclever: "#ff9f43", schooler: "#4de3ff", rare: "#ff5252", deepcut: "#9d7bff", krillion: "#ffd166" }, E = { savanna: { pal: { k: "#141b26", b: "#2e3c50", s: "#ffe9a8" }, rows: ["kkk..kkk", "kbbkkbbk", "kbskkbsk", "kbbkkbbk", "kkk..kkk"] }, amazon: { pal: { h: "#9a6f38", n: "#bfe8ff", m: "#4de3ff", k: "#4a3010" }, rows: ["......nnn..", ".....n...n.", ".....n.m.n.", "......n.n..", "....k..n...", "...hh......", "..hh.......", ".hh........", "hh........."] }, alps: { pal: { w: "#b8895a", d: "#7a5528", k: "#3a260e", s: "#e8d5b0" }, rows: [".ss.", "sww.", ".wd.", ".wd.", ".wd.", ".wd.", ".wd.", ".wd.", ".kk."] }, greatwall: { pal: { p: "#9a6f38", r: "#ff5a3c", o: "#ffb46b", g: "#ffd166", k: "#4a3010" }, rows: ["ppppppp..", "......p..", "......k..", ".....rrr.", "....rooor", "....roggr", "....rooor", ".....rrr.", "......k.."] }, outback: { pal: { w: "#d8a869", d: "#9a6f38" }, rows: ["wwd...", ".wwd..", "..wwd.", "...www", "..wwd.", ".wwd..", "wwd..."] }, canyon: { pal: { g: "#c9a24a", d: "#8a6a24", k: "#3a2a0e", c: "#4de3ff" }, rows: [".......kkk", "ddgggggkck", "kdgggggkck", ".......kkk"] }, antarctica: { pal: { p: "#d8dce4", r: "#ff5a3c", d: "#b33a22", k: "#20242c" }, rows: ["prrrrr...", "prrrrrrr.", "prrdrr...", "prrr.....", "p........", "p........", "p........", "p........", "k........"] } }, I = (0, r.forwardRef)(function({ phase: e2, opts: a2, onReady: l2, children: n2 }, i2) {
    let s2 = (0, r.useRef)(null), o2 = (0, r.useRef)(null), d2 = (0, r.useRef)(l2);
    d2.current = l2;
    let c2 = (0, r.useRef)(a2);
    return (0, r.useEffect)(() => {
      if (!s2.current) return;
      let e3 = (function(e4, t2) {
        let a3 = t2.theme, l3 = a3.copy, r2 = 2 * Math.PI, n3 = r2 / 700, i3 = e4.clientWidth || innerWidth, s3 = e4.clientHeight || innerHeight, o3 = 0, d3 = 0, c3 = 0, h2 = 0, u2 = () => -o3, f2 = () => i3 + o3 + d3, m2 = () => -c3, g2 = 1e3, v2 = 0, y2 = 0, x2 = 0, b2 = (0, C.createWorldRenderer)(e4), M2 = (0, S.watchSeasonalKrillImages)(e4), w2 = b2.revision, j2 = b2.pixelRatio(i3, s3), L2 = () => i3 < 700 ? 3 : 7, A2 = (e10, t3, a4) => e10 + (t3 - e10) * a4, I2 = (e10, t3) => e10 + Math.random() * (t3 - e10), _2 = (e10) => e10 < 0.5 ? 4 * e10 * e10 * e10 : 1 - Math.pow(-2 * e10 + 2, 3) / 2, P2 = (e10) => 1 - Math.pow(1 - e10, 3), q2 = (e10) => (e10 % 700 + 700) % 700, D2 = (e10, t3) => {
          let a4 = q2(e10) - q2(t3);
          return a4 > 350 && (a4 -= 700), a4 < -350 && (a4 += 700), a4;
        };
        e4.innerHTML = `
    <div class="ds-stage">
      <canvas class="ds-sea"></canvas>
      <div class="ds-world">
        <div class="ds-surface">
          <div class="ds-title"></div>
          <div class="ds-tagline"></div>
          <div class="ds-subline"></div>
        </div>
      </div>
      <canvas class="ds-fore"></canvas>
      <div class="ds-dim"></div>
      <div class="ds-vignette"></div>
      <div class="ds-edge"></div>
      <div class="ds-flash"></div>
      <div class="ds-hud">
        <div class="ds-pod ds-px"><div class="label">${l3.hudLabel}</div><div class="ds-depth-num">0</div></div>
        <div class="ds-hud-mid"><div class="ds-dots"></div><div class="ds-prompt-count">${l3.surfaceLabel}</div></div>
        <div class="ds-pod ds-px ds-score-pod"><div class="label">SCORE</div><div class="ds-score-num">0</div></div>
      </div>
      <div class="ds-mascot" title="a friend">
        <span class="ds-mascot-sprite">
          <img src="/tiers/krillion.png" alt="krill">
        </span>
        <span class="ds-blub">onward!</span>
      </div>
      <div class="ds-crt"></div>
      <button class="ds-mute" type="button" aria-label="toggle sound"></button>
    </div>`;
        let G2 = e4.querySelector(".ds-stage"), H2 = e4.querySelector(".ds-sea"), F2 = e4.querySelector(".ds-fore"), W2 = H2.getContext("2d"), O2 = F2.getContext("2d"), U2 = e4.querySelector(".ds-world"), V2 = e4.querySelector(".ds-dim"), z2 = e4.querySelector(".ds-edge"), B2 = e4.querySelector(".ds-flash"), K2 = e4.querySelector(".ds-crt"), J2 = e4.querySelector(".ds-mascot"), Y2 = J2.querySelector("img"), X2 = (0, T.createMascotSpriteController)(Y2), Z2 = e4.querySelector(".ds-depth-num"), Q2 = e4.querySelector(".ds-score-num"), ee2 = e4.querySelector(".ds-dots"), et2 = e4.querySelector(".ds-prompt-count");
        {
          let a4 = e4.querySelector(".ds-title");
          "KRILLION".split("").forEach((e10, t3) => {
            let l4 = document.createElement("span");
            l4.textContent = e10, l4.style.animationDelay = 0.18 * t3 + "s", a4.appendChild(l4);
          }), e4.querySelector(".ds-tagline").textContent = t2.tagline ?? "GEOGRAPHY", e4.querySelector(".ds-subline").textContent = t2.subline ?? "around the world in seven answers";
          for (let e10 = 0; e10 < 7; e10++) ee2.appendChild(document.createElement("i"));
        }
        let ea2 = false;
        function el2() {
          ea2 = true, b2.invalidate();
        }
        addEventListener("resize", el2);
        let er2 = new ResizeObserver(() => {
          (e4.clientWidth !== i3 || e4.clientHeight !== s3) && el2();
        });
        er2.observe(e4);
        let en2 = (0, R.getDescentAudio)();
        en2.acquire(e4);
        let ei2 = e4.querySelector(".ds-mute"), es2 = '<path d="M2 6h3l4-4v12l-4-4H2z"/>', eo2 = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${es2}<rect x="11" y="6" width="2" height="4"/><rect x="15" y="3" width="2" height="10"/></svg>`, ed2 = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${es2}<rect x="11" y="5" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/><rect x="15" y="9" width="2" height="2"/><rect x="15" y="5" width="2" height="2"/><rect x="11" y="9" width="2" height="2"/></svg>`, ec2 = () => {
          let e10 = en2.isMuted();
          ei2.innerHTML = e10 ? ed2 : eo2, ei2.setAttribute("aria-label", e10 ? "turn sound on" : "turn sound off"), ei2.setAttribute("aria-pressed", e10 ? "true" : "false"), ei2.classList.toggle("off", e10);
        };
        ec2();
        let eh2 = en2.subscribeMute(ec2), eu2 = () => en2.toggleMuted();
        ei2.addEventListener("click", eu2);
        let ef2 = -1, ep2 = -45, em2 = -45, eg2 = -45, ev2 = -45, ey2 = (e10) => {
          ep2 = em2 = eg2 = ev2 = e10;
        };
        function ex2(e10, t3 = 0) {
          let a4 = D2(e10, eg2 + L2()) * n3, l4 = g2 + t3;
          return { x: v2 + l4 * Math.sin(a4), y: y2 - l4 * Math.cos(a4), phi: a4 };
        }
        let eb2 = [], eM2 = (e10, t3, a4, l4) => eb2.push({ t0: performance.now(), dur: e10, ease: t3, upd: a4, done: l4 }), ew2 = "intro", ek2 = 0, eS = 0, eC = 0, e$ = 0, eR = 0, eT = false, ej = null, eL = 0, eA = 0, eN = null, eE = false, eI = [], e_ = (e10, t3) => eI.push(setTimeout(e10, t3));
        function eP() {
          Array.from(ee2.children).forEach((e10, t3) => {
            e10.className = t3 < ek2 ? "done" : t3 === ek2 && "intro" !== ew2 && ek2 < 7 ? "cur" : "";
          }), et2.textContent = "intro" === ew2 ? l3.surfaceLabel : ek2 >= 7 ? l3.completeLabel : l3.promptWord + " " + Math.min(ek2 + 1, 7) + " OF 7";
        }
        function eq(e10, t3) {
          let a4 = eC;
          eC = e10;
          let l4 = t3 ? 1100 : 700, r3 = performance.now(), n4 = (i4) => {
            if (eE) return;
            let s4 = Math.min((i4 - r3) / l4, 1), o4 = 1 - Math.pow(1 - s4, 4);
            Q2.textContent = String(Math.round(a4 + (e10 - a4) * (t3 && o4 < 0.9 ? 1.06 * o4 : o4))), s4 < 1 ? requestAnimationFrame(n4) : (Q2.textContent = String(e10), t3 && (Q2.classList.add("slam"), setTimeout(() => Q2.classList.remove("slam"), 520)));
          };
          requestAnimationFrame(n4);
        }
        let eD = [];
        for (let [e10, t3, l4, r3] of a3.ambient) {
          let a4 = document.createElement("div");
          a4.className = "ds-amb gl-amb " + l4 + (r3 ? " major" : ""), a4.innerHTML = r3 ? t3 : '<span class="dash">\u2500\u2500</span> ' + t3 + ' <span class="dash">\u2500\u2500</span>', U2.appendChild(a4), eD.push({ d: e10, el: a4, h: "L" === l4 ? 0.57 * s3 : 0.4 * s3 });
        }
        function eG(e10 = false) {
          if (eN) {
            for (let t3 of eN) if (e10) t3.el.remove();
            else {
              let e11 = t3.el;
              e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
            }
            eN = null;
          }
        }
        function eH(e10, t3, a4 = 0) {
          ej?.remove();
          let r3 = document.createElement("div");
          return r3.className = "ds-card ds-px", a4 && (r3.style.animationDelay = a4 + "s"), r3.innerHTML = `<div class="rnd">${l3.promptWord} ${e10 + 1} OF 7</div><div class="prompt"></div><div class="hint">${l3.hint}</div>`, r3.querySelector(".prompt").textContent = t3, U2.appendChild(r3), ej = r3, r3;
        }
        function eF(e10, t3) {
          if (e10.tier && eN) for (let t4 of eN) t4.tier === e10.tier && (t4.el.style.transition = "opacity .5s", t4.el.style.opacity = "0");
          let a4 = document.createElement("div"), r3 = e10.tier ? `var(--tier-${e10.tier})` : "var(--tier-miss-lit)";
          return a4.className = "ds-landed" + (e10.tier ? "" : " miss"), a4.style.setProperty("--tc", r3), a4.innerHTML = (e10.tier ? `<img class="icon" src="${(0, k.seasonalKrillSprite)(`/tiers/${e10.tier}.png`)}" alt="">` : "") + `<div class="tname">${e10.tier ? p.TIERS[e10.tier].name.toUpperCase() : l3.missTitle}</div><div class="tans"></div><div class="tpts"><b>+${e10.points} PTS</b>${e10.points > 0 ? ` &middot; ${l3.driveVerb} ${l3.fmtDist(e10.points)}` : ""}</div><div class="tsub"></div>`, a4.querySelector(".tans").textContent = e10.answerText ? `\u201C${e10.answerText}\u201D` : "\u2014", a4.querySelector(".tsub").textContent = e10.sub, U2.appendChild(a4), a4;
        }
        function eW() {
          G2.classList.remove("ds-shake"), G2.offsetWidth, G2.classList.add("ds-shake");
        }
        function eO() {
          K2.classList.remove("zap"), K2.offsetWidth, K2.classList.add("zap");
        }
        function eU(e10, t3, a4) {
          let l4 = 0, r3 = () => {
            B2.style.transition = "none", B2.style.background = e10, B2.style.opacity = ".42", requestAnimationFrame(() => requestAnimationFrame(() => {
              B2.style.transition = "opacity " + a4 + "ms ease-out", B2.style.opacity = "0";
            })), ++l4 < t3 && e_(r3, 2.1 * a4);
          };
          r3();
        }
        function eV(e10, t3, a4) {
          let l4 = a4 || 66;
          V2.style.background = `radial-gradient(circle at calc(${e10}px + var(--kr-ad-left, 0px)) calc(${t3}px + var(--kr-ad-top, 0px)), transparent ${l4}px, rgba(3,4,10,.78) ${l4 + 90}px, rgba(3,4,10,.97) ${l4 + 260}px)`;
        }
        let ez = [], eB = null, eK = null, eJ = 0, eY = null, eX = false;
        function eZ(e10) {
          if (eX = true, X2.setGold(true), J2.classList.add("gold"), !e10) {
            J2.classList.remove("gilding"), J2.offsetWidth, J2.classList.add("gilding"), e_(() => J2.classList.remove("gilding"), 1200), ta(tO, tU, "#ffd166", 16, 0.7);
            for (let e11 = 0; e11 < 12; e11++) tl(tO + I2(-18, 18), tU + I2(-18, 18));
          }
        }
        function eQ() {
          eX = false, X2.setGold(false), J2.classList.remove("gold", "gilding");
        }
        function e0() {
          eY = null, J2.classList.remove("perched");
        }
        let e1 = { plankton: { dur: 3400, ease: (e10) => -(Math.cos(Math.PI * e10) - 1) / 2 }, tooclever: { dur: 3e3, ease: _2 }, schooler: { dur: 3e3, ease: _2 }, rare: { dur: 3400, ease: _2 }, deepcut: { dur: 4300, ease: _2 }, krillion: { dur: 4600, ease: _2 } }, e22 = null;
        function e5(e10, t3) {
          Y2.classList.remove("celebrate", "faint", "sad", "roll", "punch"), Y2.offsetWidth, e10 && Y2.classList.add(e10), clearTimeout(e22), e10 && t3 && (e22 = setTimeout(() => Y2.classList.remove(e10), t3));
        }
        let e42 = [], e32 = [], e6 = [], e8 = [], e9 = (e10) => e10 / (g2 * n3);
        function e7(e10, t3) {
          let a4 = e10 - v2, l4 = y2 - t3, r3 = Math.atan2(a4, l4), i4 = Math.sqrt(a4 * a4 + l4 * l4);
          return { d: eg2 + L2() + r3 / n3, h: i4 - g2 };
        }
        function te(e10, t3, l4, r3) {
          if (e42.length > 90) return;
          let n4 = e7(e10 + I2(-3, 3), t3);
          e42.push({ d: n4.d, h: n4.h, vh: 14 + 18 * Math.random(), wob: 9 * Math.random(), life: 4, col: r3 || a3.particle, r: l4 });
        }
        function tt(e10, t3) {
          if (e6.length > 30) return;
          let a4 = e7(e10, t3);
          e6.push({ d: a4.d, h: a4.h, vd: e9(I2(-14, -4)), vh: I2(6, 16), r: I2(4, 9), life: I2(0.8, 1.5), t: 0, col: ["rgba(30,34,44,.95)", "rgba(10,12,18,0)"] });
        }
        function ta(e10, t3, a4, l4, r3) {
          let n4 = e7(e10, t3);
          for (let e11 = 0; e11 < l4 && e32.length < 260; e11++) {
            let e12 = Math.random() * Math.PI * 2, t4 = (30 + 130 * Math.random()) * r3;
            e32.push({ d: n4.d, h: n4.h, vd: e9(Math.cos(e12) * t4), vh: -Math.sin(e12) * t4, r: 1.5 + 2.5 * Math.random(), life: 0.6 + 0.8 * Math.random(), t: 0, color: a4 });
          }
        }
        function tl(e10, t3) {
          if (e32.length > 250) return;
          let a4 = e7(e10, t3);
          e32.push({ d: a4.d, h: a4.h, vd: e9(I2(-24, 24)), vh: I2(-8, 20), r: 1.6 + 2.6 * Math.random(), life: 0.5 + 0.7 * Math.random(), t: 0, color: ["#ffd166", "#ffe9a8", "#ff6b3d", "#ffffff"][4 * Math.random() | 0] });
        }
        function tr(e10, t3, a4) {
          let l4 = e7(e10, t3);
          for (let e11 = 0; e11 < a4 && e6.length < 30; e11++) e6.push({ d: l4.d, h: l4.h, vd: e9(I2(-60, -14)), vh: I2(2, 20), r: I2(10, 26), life: I2(0.9, 1.8), t: 0, col: ["rgba(255,120,80,.55)", "rgba(255,120,80,0)"] });
          for (let e11 = 0; e11 < a4 && e32.length < 250; e11++) e32.push({ d: l4.d, h: l4.h + I2(-4, 8), vd: e9(I2(-46, 8)), vh: I2(8, 50), r: 1.2 + 2 * Math.random(), life: 0.4 + 0.5 * Math.random(), t: 0, color: 0.5 > Math.random() ? "#ff6b3d" : "#ffe9a8" });
        }
        let tn = (e10) => {
          let t3 = new Image();
          return t3.src = e10, t3;
        }, ti = (e10) => !!e10 && e10.complete && e10.naturalWidth > 0, ts = (e10) => ({ src: e10, w: e10.naturalWidth, h: e10.naturalHeight });
        function to(e10, t3) {
          let a4 = e10.naturalWidth, l4 = e10.naturalHeight, r3 = document.createElement("canvas");
          r3.width = a4, r3.height = l4;
          let n4 = r3.getContext("2d");
          n4.drawImage(e10, 0, 0);
          let i4 = Math.round(a4 * t3);
          n4.globalCompositeOperation = "destination-out";
          let s4 = n4.createLinearGradient(0, 0, i4, 0);
          return s4.addColorStop(0, "rgba(0,0,0,1)"), s4.addColorStop(1, "rgba(0,0,0,0)"), n4.fillStyle = s4, n4.fillRect(0, 0, i4, l4), (s4 = n4.createLinearGradient(a4, 0, a4 - i4, 0)).addColorStop(0, "rgba(0,0,0,1)"), s4.addColorStop(1, "rgba(0,0,0,0)"), n4.fillStyle = s4, n4.fillRect(a4 - i4, 0, i4, l4), { src: r3, w: a4, h: l4 };
        }
        function td(e10) {
          let t3 = e10.naturalWidth, a4 = e10.naturalHeight, l4 = document.createElement("canvas");
          l4.width = t3, l4.height = a4;
          let r3 = l4.getContext("2d");
          r3.drawImage(e10, 0, 0);
          let n4 = r3.getImageData(0, 0, t3, a4), i4 = n4.data;
          for (let e11 = 0; e11 < i4.length; e11 += 4) {
            let t4 = (i4[e11] - i4[e11 + 2] + 4) / 22, a5 = t4 <= 0 ? 0 : t4 >= 1 ? 1 : t4 * t4 * (3 - 2 * t4);
            i4[e11 + 3] = Math.min(i4[e11 + 3], Math.round(255 * a5));
          }
          return r3.putImageData(n4, 0, 0), { src: l4, w: t3, h: a4 };
        }
        let tc = tn(a3.baseCamp), th = tn(a3.pole), tu = null, tf = null;
        tc.onload = () => {
          tu = td(tc);
        }, th.onload = () => {
          tf = ts(th);
        }, ti(tc) && (tu = td(tc)), ti(th) && (tf = ts(th));
        let tp = a3.continents.map((e10) => {
          let t3 = tn(e10.pane), a4 = { ...e10, img: t3, art: null };
          return t3.onload = () => {
            a4.art = to(t3, 0.03);
          }, ti(t3) && (a4.art = to(t3, 0.03)), a4;
        }), tm = {};
        for (let [e10, t3] of Object.entries(E)) tm[e10] = (function(e11) {
          let t4 = e11.rows[0].length, a4 = e11.rows.length, l4 = document.createElement("canvas");
          l4.width = 3 * t4, l4.height = 3 * a4;
          let r3 = l4.getContext("2d");
          return e11.rows.forEach((t5, a5) => {
            for (let l5 = 0; l5 < t5.length; l5++) {
              let n4 = e11.pal[t5[l5]];
              n4 && (r3.fillStyle = n4, r3.fillRect(3 * l5, 3 * a5, 3, 3));
            }
          }), l4;
        })(t3);
        let tg = { savanna: "#3a2e1a", amazon: "#16301e", alps: "#26324a", greatwall: "#2c2438", outback: "#422214", canyon: "#301a1e", antarctica: "#20304a" };
        function tv(e10) {
          let t3 = q2(e10);
          for (let e11 of tp) if (t3 >= e11.from && t3 <= e11.to) return e11.zone;
          return t3 >= 678 || t3 <= tp[0].from - 6 ? "harbor" : "ocean";
        }
        function ty(e10) {
          if (e10 < tp[0].from) return tp[0].zone;
          if (e10 > tp[tp.length - 1].to) return tp[tp.length - 1].zone;
          let t3 = tp[0].zone;
          for (let a4 of tp) if (e10 >= a4.from) t3 = a4.zone;
          else break;
          return t3;
        }
        let tx = [];
        function tb() {
          tx.length > 10 || tx.push({ x: u2() + I2(0.15 * f2(), 0.95 * f2()), y: m2() + I2(0.03 * s3, 0.26 * s3), vx: -I2(340, 520), vy: I2(90, 170), t: 0, life: I2(0.5, 0.8) });
        }
        let tM = [];
        for (let e10 = 0; e10 < 1400; e10++) {
          let e11 = Math.random();
          tM.push({ d: 700 * Math.random(), hf: 0.04 + 1.5 * Math.pow(Math.random(), 0.8), r: e11 < 0.62 ? 1 : e11 < 0.9 ? 2 : 3, w: 0.6 + 2.6 * Math.random(), ph: 9 * Math.random(), col: e11 < 0.76 ? "200,214,255" : e11 < 0.92 ? "255,233,168" : "255,166,138" });
        }
        let tw = (e10) => {
          let t3 = 43758.5453 * Math.sin(127.1 * e10 + 311.7);
          return t3 - Math.floor(t3);
        }, tk = [[0.815, 0.257], [0.762, 0.303], [0.789, 0.362], [0.804, 0.366], [0.833, 0.376], [0.792, 0.405], [0.841, 0.388]], tS = [[0.55, 0.585], [0.612, 0.588], [0.291, 0.252], [0.845, 0.415]], tC = [0.545, 0.765], t$ = [0.816, 0.545], tR = [], tT = [], tj = [], tL = null, tA = {}, tN = (e10, t3, a4) => !!b2.particleScale && (tA[e10] = (tA[e10] ?? I2(0, t3)) - a4 * b2.particleScale, !(tA[e10] > 0) && (tA[e10] = t3 * I2(0.7, 1.4), true)), tE = (e10) => Math.abs(D2((e10.from + e10.to) / 2, eg2 + L2())) < (e10.to - e10.from) / 2 + 95, tI = () => {
          if (!tu) return null;
          let e10 = 0.3 * s3;
          return { centerD: 0, arcLg: e10 * (tu.w / tu.h) / (g2 * n3), drawH: e10, sink: 2 };
        };
        function t_(e10, t3, a4, l4, r3, n4 = 2, i4 = 3) {
          W2.save(), W2.translate(e10, t3), W2.rotate(a4), W2.fillStyle = r3.replace("$", l4.toFixed(3)), W2.fillRect(-n4 / 2, -i4 / 2, n4, i4), W2.restore();
        }
        let tP = 0;
        function tq(e10, t3, a4, l4, r3 = 0) {
          let i4 = a4 * g2 * n3, s4 = Math.max(6, Math.ceil(i4 / 26)), o4 = e10.w / s4, d4 = i4 / s4 / g2 * l4 / 2 + 1;
          for (let c4 = 0; c4 < s4; c4++) {
            let h3 = D2(t3 - a4 / 2 + (c4 + 0.5) / s4 * a4, eg2 + L2()) * n3;
            if (Math.abs(h3) > 1.15) continue;
            let u3 = v2 + g2 * Math.sin(h3), f3 = y2 - g2 * Math.cos(h3);
            W2.save(), W2.translate(u3, f3), W2.rotate(h3), W2.drawImage(e10.src, o4 * c4, 0, o4, e10.h, -i4 / (2 * s4) - d4, -l4 + r3, i4 / s4 + 2 * d4, l4), W2.restore();
          }
        }
        function tD(e10) {
          if (!e10.art) return null;
          let t3 = e10.to - e10.from, a4 = s3 * (i3 < 700 ? 0.5 : 0.56), l4 = e10.art.w / e10.art.h, r3 = Math.min(t3 * g2 * n3, a4 * l4);
          return { centerD: (e10.from + e10.to) / 2, arcLg: r3 / (g2 * n3), drawH: r3 / l4, sink: 4 };
        }
        function tG(e10, t3, a4) {
          return { d: e10.centerD + (t3 - 0.5) * e10.arcLg, h: e10.drawH * (1 - a4) - e10.sink };
        }
        let tH = 0, tF = 0, tW = null, tO = 0, tU = 0, tV = 0, tz = 0, tB = -26, tK = 0, tJ = 0, tY = 0, tX = 0, tZ = NaN, tQ = NaN, t0 = (0, $.bindMascotTap)(J2, () => {
          en2.event("blub");
          let t3 = X2.current();
          e5("mantis-shrimp" === t3.id ? t3.poke : "roll", "mantis-shrimp" === t3.id ? t3.pokeMs : 950);
          let a4 = e4.querySelector(".ds-blub");
          a4.classList.remove("show"), a4.offsetWidth, a4.classList.add("show");
          for (let e10 = 0; e10 < 6; e10++) te(tO + I2(-16, 26), tU - 16, 1 + 3 * Math.random());
          ta(tO, tU, "#ff6b3d", 10, 0.5), tr(tO - 6, tU + 20, 6);
        }), t1 = -26;
        return el2(), ey2(-26 - L2() + 3), eP(), b2.start(function(t3, l4, p2) {
          let M3;
          if (eE) return;
          w2 !== b2.revision && (w2 = b2.revision, el2()), ea2 && (ea2 = false, i3 = e4.clientWidth || innerWidth, s3 = e4.clientHeight || innerHeight, o3 = Math.max(0, Math.round((M3 = e4.getBoundingClientRect()).left)), c3 = Math.max(0, Math.round(M3.top)), d3 = Math.max(0, Math.round(innerWidth - M3.right)), h2 = Math.max(0, Math.round(innerHeight - M3.bottom)), j2 = b2.pixelRatio(f2(), s3 + c3 + h2), F2.width !== Math.floor(i3 * j2) && (F2.width = i3 * j2), F2.height !== Math.floor(s3 * j2) && (F2.height = s3 * j2), F2.style.width = i3 + "px", F2.style.height = s3 + "px", O2.setTransform(j2, 0, 0, j2, 0, 0), H2.width !== Math.floor(f2() * j2) && (H2.width = f2() * j2), H2.height !== Math.floor((s3 + c3 + h2) * j2) && (H2.height = (s3 + c3 + h2) * j2), H2.style.width = f2() + "px", H2.style.height = s3 + c3 + h2 + "px", H2.style.left = u2() + "px", H2.style.top = m2() + "px", W2.setTransform(j2, 0, 0, j2, o3 * j2, c3 * j2), x2 = s3 * (i3 < 700 ? 0.66 : 0.62), g2 = Math.max(1.05 * s3, 0.58 * i3), v2 = 0.5 * i3, y2 = x2 + g2);
          for (let e10 = eb2.length - 1; e10 >= 0; e10--) {
            let a4 = eb2[e10], l5 = (t3 - a4.t0) / a4.dur;
            l5 >= 1 ? (a4.upd(a4.ease(1)), eb2.splice(e10, 1), a4.done?.()) : a4.upd(a4.ease(Math.max(0, l5)));
          }
          "intro" !== ew2 || b2.reducedMotion || (ep2 += 1.1 * l4), em2 += (ep2 - em2) * (1 - Math.exp(("plunge" === ew2 ? -11 : -6) * l4)), ev2 = eg2, eg2 = em2 + (b2.reducedMotion ? 0 : 0.35 * Math.sin(0.45 * p2));
          let k2 = String(Math.max(0, Math.floor(eS)));
          for (let t4 of (Z2.textContent !== k2 && (Z2.textContent = k2), e4.querySelector(".ds-vignette").style.opacity = Math.min(0.55, 0.22 + Math.max(0, q2(eg2)) / 1100).toFixed(3), !(function(e10, t5) {
            let l5, i4 = W2.createLinearGradient(0, 0, 0, x2);
            i4.addColorStop(0, a3.skyTint[0]), i4.addColorStop(0.6, a3.skyTint[1]), i4.addColorStop(1, a3.skyTint[2]), W2.fillStyle = i4, W2.fillRect(u2(), m2(), f2(), s3 + c3 + h2), (function(e11) {
              for (let t6 of tM) {
                let a4 = D2(t6.d, eg2 + L2()) * n3;
                if (Math.abs(a4) > 1.35) continue;
                let l6 = t6.hf * s3, r3 = g2 + l6, i5 = v2 + r3 * Math.sin(a4), o5 = y2 - r3 * Math.cos(a4);
                if (o5 < m2() - 8 || o5 > s3 + h2 + 8 || i5 < u2() - 8 || i5 > u2() + f2() + 8) continue;
                let d4 = 0.62 + 0.38 * Math.sin(e11 * t6.w + t6.ph), c4 = Math.min(1, l6 / (0.16 * s3)), p3 = (3 === t6.r ? 0.95 : 0.72) * d4 * c4;
                p3 < 0.04 || (W2.fillStyle = `rgba(${t6.col},${p3})`, 3 === t6.r ? (W2.fillRect(i5 - 2, o5, 5, 1), W2.fillRect(i5, o5 - 2, 1, 5)) : W2.fillRect(i5, o5, t6.r, t6.r));
              }
            })(e10);
            let o4 = ty(eg2 + L2());
            Math.random() < t5 * ("canyon" === o4 ? 0.14 : "outback" === o4 ? 0.07 : 0.015) * b2.particleScale && tb(), !(function(e11, t6) {
              if (t6 < 0.06) return;
              let a4 = Math.ceil(f2() / 14) + 1;
              for (let l6 = 0; l6 < 3; l6++) {
                let r3 = 1 === l6 ? "168,120,255" : "125,255,176", i5 = s3 * (0.05 + 0.06 * l6), o5 = eg2 * g2 * n3 * (0.04 + 0.02 * l6);
                for (let n4 = 0; n4 < a4; n4++) {
                  let a5 = u2() + 14 * n4, d4 = i5 + (34 * Math.sin((a5 + o5) * 6e-3 + e11 * (0.32 + 0.11 * l6) + 2.1 * l6) + 14 * Math.sin((a5 + o5) * 0.017 - 0.21 * e11 + l6)), c4 = s3 * (0.15 + 0.05 * Math.sin((a5 + o5) * 4e-3 + 0.18 * e11 + 3 * l6)), h3 = 0.75 + 0.5 * (0.5 * Math.sin(37.7 * n4 + 9.1 * l6) + 0.5), f3 = t6 * (0.16 - 0.03 * l6) * (0.7 + 0.3 * Math.sin(0.05 * a5 + 1.7 * e11 + l6)) * h3, p3 = [1, 0.72, 0.48, 0.28, 0.13];
                  for (let e12 = 0; e12 < p3.length; e12++) W2.fillStyle = `rgba(${r3},${f3 * p3[e12]})`, W2.fillRect(a5, d4 + 0.2 * c4 * e12, 15, 0.2 * c4);
                }
              }
            })(e10, Math.min(1, (l5 = Math.max(0, Math.min(1, 1 - Math.abs(D2(590, eg2 + L2())) / 130))) * l5 + Math.min(1, Math.max(0, tP) / 1.5))), tP = Math.max(0, tP - t5);
            for (let e11 = tx.length - 1; e11 >= 0; e11--) {
              let a4 = tx[e11];
              if (a4.t += t5, a4.t > a4.life) {
                tx.splice(e11, 1);
                continue;
              }
              a4.x += a4.vx * t5, a4.y += a4.vy * t5;
              let l6 = 0.85 * Math.sin(a4.t / a4.life * Math.PI);
              W2.strokeStyle = `rgba(232,240,255,${l6})`, W2.lineWidth = 2, W2.beginPath(), W2.moveTo(a4.x, a4.y), W2.lineTo(a4.x - 0.09 * a4.vx, a4.y - 0.09 * a4.vy), W2.stroke();
            }
            !(function(e11) {
              let t6 = W2.createRadialGradient(v2, y2, 0.82 * g2, v2, y2, g2 + 2);
              t6.addColorStop(0, "#05060c"), t6.addColorStop(0.75, "#0b0d18"), t6.addColorStop(0.97, "#1a1c2c"), t6.addColorStop(1, "#262a40"), W2.fillStyle = t6, W2.beginPath(), W2.arc(v2, y2, g2, 0, r2), W2.fill(), W2.strokeStyle = "rgba(70,60,80,0.25)", W2.lineWidth = 3, W2.beginPath(), W2.arc(v2, y2, g2 - 26, 0, r2), W2.stroke(), W2.strokeStyle = "rgba(70,60,80,0.15)", W2.beginPath(), W2.arc(v2, y2, g2 - 58, 0, r2), W2.stroke();
              let a4 = [], l6 = tp[tp.length - 1].to;
              for (let e12 of tp) e12 === tp[0] ? (a4.push([l6, 674]), a4.push([726, 700 + e12.from])) : a4.push([l6, e12.from]), l6 = e12.to;
              W2.lineWidth = 14, W2.strokeStyle = "#241a12";
              {
                let e12 = D2(674, eg2 + L2()) * n3, t7 = D2(26, eg2 + L2()) * n3;
                (1.2 > Math.abs(e12) || 1.2 > Math.abs(t7)) && (W2.beginPath(), W2.arc(v2, y2, g2 - 3, e12 - Math.PI / 2, t7 - Math.PI / 2), W2.stroke());
              }
              for (let [t7, l7] of (W2.lineWidth = 13, a4)) for (let a5 = t7; a5 < l7 - 0.1; a5 += 2.2) {
                let t8 = D2(a5, eg2 + L2()) * n3;
                if (Math.abs(t8) > 1.15) continue;
                let l8 = 0.55 + 0.45 * Math.sin(1.7 * a5 + 1.9 * e11);
                if (W2.strokeStyle = `rgba(28,52,84,${0.75 + 0.1 * l8})`, W2.beginPath(), W2.arc(v2, y2, g2 - 5, t8 - Math.PI / 2 - 1.05 * n3, t8 - Math.PI / 2 + 1.15 * n3), W2.stroke(), (7.3 * a5 | 0) % 5 == 0) {
                  let e12 = { x: v2 + (g2 - 2) * Math.sin(t8), y: y2 - (g2 - 2) * Math.cos(t8) };
                  W2.fillStyle = `rgba(150,200,255,${0.12 + 0.3 * l8})`, W2.fillRect(e12.x - 1, e12.y - 1, 3, 2);
                }
              }
              for (let e12 of tp) {
                let t7 = tD(e12);
                if (!t7) {
                  W2.lineWidth = 16, W2.strokeStyle = tg[e12.zone];
                  let t8 = D2(e12.from, eg2 + L2()) * n3, a5 = D2(e12.to, eg2 + L2()) * n3;
                  (1.2 > Math.abs(t8) || 1.2 > Math.abs(a5)) && (W2.beginPath(), W2.arc(v2, y2, g2 - 2, t8 - Math.PI / 2, a5 - Math.PI / 2), W2.stroke());
                  continue;
                }
                tq(e12.art, t7.centerD, t7.arcLg, t7.drawH, t7.sink);
              }
              if (tu) {
                let e12 = 0.3 * s3, t7 = e12 * (tu.w / tu.h) / (g2 * n3);
                tq(tu, 0, t7, e12, 2);
              }
              if (tf) {
                let e12 = 0.22 * s3, t7 = e12 * (tf.w / tf.h) / (g2 * n3);
                tq(tf, 598, t7, e12, 2);
              }
              {
                let t7 = Math.max(-6, eg2 + L2() - 80);
                for (let a5 = 2.8 * Math.ceil(t7 / 2.8); a5 < t1 - 1; a5 += 2.8) {
                  let t8 = D2(a5, eg2 + L2()) * n3;
                  if (Math.abs(t8) > 1.1) continue;
                  let l7 = 0.35 + 0.4 * Math.max(0, 1 - (t1 - a5) / 260) + 0.04 * Math.sin(2 * e11 + 0.4 * a5);
                  W2.save(), W2.translate(v2 + (g2 + 7) * Math.sin(t8), y2 - (g2 + 7) * Math.cos(t8)), W2.rotate(t8), W2.fillStyle = `rgba(255,107,61,${l7})`, W2.fillRect(-5, -1.5, 10, 3), W2.restore();
                }
              }
            })(e10), (function(e11, t6) {
              let a4 = tI();
              for (let e12 of tp) {
                let a5 = tD(e12);
                if (a5 && tE(e12)) switch (e12.zone) {
                  case "savanna":
                    if (tR.filter((e13) => "firefly" === e13.kind).length < 12 && tN("sv-ff", 0.5, t6)) {
                      let e13 = tG(a5, I2(0.06, 0.94), I2(0.62, 0.85));
                      tR.push({ d: e13.d, h: e13.h, vd: e9(I2(-5, 5)), vh: I2(-3, 6), t: 0, life: I2(4, 8), ph: I2(0, 9), kind: "firefly" });
                    }
                    if (tT.length < 2 && tN("sv-eyes", 7, t6)) {
                      let e13 = tG(a5, I2(0.1, 0.9), I2(0.7, 0.8));
                      tT.push({ d: e13.d, h: Math.max(6, 0.3 * e13.h), t: 0, life: I2(4.5, 7), ph: I2(0, 9) });
                    }
                    break;
                  case "amazon":
                    if (tR.filter((e13) => "morpho" === e13.kind).length < 3 && tN("am-mo", 2.2, t6)) {
                      let e13 = tG(a5, I2(0.2, 0.8), I2(0.35, 0.6));
                      tR.push({ d: e13.d, h: e13.h, vd: e9(I2(-7, 7)), vh: I2(-4, 4), t: 0, life: I2(5, 9), ph: I2(0, 9), kind: "morpho" });
                    }
                    if (tN("am-ff", 0.9, t6)) {
                      let e13 = tG(a5, I2(0.1, 0.9), I2(0.55, 0.8));
                      tR.push({ d: e13.d, h: e13.h, vd: e9(I2(-4, 4)), vh: I2(-2, 5), t: 0, life: I2(3, 6), ph: I2(0, 9), kind: "firefly" });
                    }
                    break;
                  case "alps":
                    tj.filter((e13) => !e13.blow).length < 70 && tN("al-snow", 0.05, t6) && tj.push({ d: a5.centerD + I2(-0.55, 0.55) * a5.arcLg, h: I2(0.25 * a5.drawH, 1.05 * a5.drawH), vd: e9(I2(-7, 7)), vh: -I2(13, 26), blow: false, ph: I2(0, 9) });
                    break;
                  case "greatwall":
                    if (tR.filter((e13) => "lantern" === e13.kind).length < 7 && tN("gw-lan", 2.4, t6)) {
                      let e13 = tG(a5, I2(0.2, 0.72), I2(0.5, 0.6));
                      tR.push({ d: e13.d, h: e13.h, vd: e9(I2(-2, 4)), vh: I2(11, 18), t: 0, life: I2(9, 14), ph: I2(0, 9), kind: "lantern" });
                    }
                    break;
                  case "outback":
                    if (tN("ob-ember", 0.4, t6)) {
                      let e13 = tG(a5, tC[0] + I2(-4e-3, 4e-3), tC[1]);
                      tR.push({ d: e13.d, h: e13.h + 2, vd: e9(I2(-3, 3)), vh: I2(16, 30), t: 0, life: I2(0.8, 1.8), ph: I2(0, 9), kind: "ember" });
                    }
                    break;
                  case "antarctica":
                    if (tj.filter((e13) => e13.blow).length < 55 && tN("an-blow", 0.05, t6) && tj.push({ d: a5.centerD + I2(-0.6, 0.6) * a5.arcLg, h: I2(4, 52), vd: e9(-I2(45, 110)), vh: I2(-6, 3), blow: true, ph: I2(0, 9) }), tN("an-breath", 3.6, t6)) {
                      let e13 = tG(a5, 0.47 + I2(-0.02, 0.02), 0.735);
                      tR.push({ d: e13.d, h: e13.h + 4, vd: e9(I2(-2, 2)), vh: I2(6, 10), t: 0, life: I2(1.2, 1.9), ph: I2(0, 9), kind: "breath" });
                    }
                }
              }
              if (a4 && 60 > Math.abs(D2(0, eg2 + L2()))) {
                if (tN("bc-smoke", 0.75, t6)) {
                  let e12 = tG(a4, 0.355 + I2(-6e-3, 6e-3), 0.885);
                  tR.push({ d: e12.d, h: e12.h + 4, vd: e9(I2(-3, 1)), vh: I2(14, 22), t: 0, life: I2(2.4, 3.6), ph: I2(0, 9), kind: "smoke" });
                }
                if (tN("bc-ember", 1.1, t6)) {
                  let e12 = tG(a4, 0.355, 0.885);
                  tR.push({ d: e12.d, h: e12.h + 3, vd: e9(I2(-2, 2)), vh: I2(18, 30), t: 0, life: I2(0.6, 1.2), ph: I2(0, 9), kind: "ember" });
                }
              }
              if (tL) tL.t += t6, tL.t > 7.5 && (tL = null);
              else if (tN("whale", 6, t6)) {
                let e12 = eg2 + L2() + I2(6, 36);
                "ocean" === tv(e12) && (tL = { d: e12, t: 0 });
              }
              for (let a5 = tR.length - 1; a5 >= 0; a5--) {
                let l6 = tR[a5];
                if (l6.t += t6, l6.t > l6.life) {
                  tR.splice(a5, 1);
                  continue;
                }
                l6.d += l6.vd * t6, l6.h += l6.vh * t6, "ember" === l6.kind && (l6.vh *= 1 - 1.4 * t6), "firefly" === l6.kind && (l6.vd += e9(6 * Math.sin(1.7 * e11 + l6.ph)) * t6), "morpho" === l6.kind && (l6.vh = 9 * Math.sin(5 * e11 + l6.ph));
              }
              for (let e12 = tT.length - 1; e12 >= 0; e12--) tT[e12].t += t6, tT[e12].t > tT[e12].life && tT.splice(e12, 1);
            })(e10, t5), (function(e11) {
              for (let t7 of tp) {
                let a4 = tD(t7);
                if (a4 && tE(t7)) {
                  if ("amazon" === t7.zone) {
                    let t8 = tG(a4, 0.515, 0.795), l6 = D2(t8.d, eg2 + L2()) * n3;
                    if (1.1 > Math.abs(l6)) {
                      let i5 = tG(a4, 0.515, 0.335).h - t8.h, s4 = Math.max(7, 0.016 * a4.arcLg * g2 * n3), o5 = g2 + t8.h;
                      W2.save(), W2.translate(v2 + o5 * Math.sin(l6), y2 - o5 * Math.cos(l6)), W2.rotate(l6), W2.fillStyle = `rgba(120,220,235,${0.04 + 0.02 * Math.sin(1.3 * e11)})`, W2.fillRect(-(1.7 * s4), -i5, 3.4 * s4, i5);
                      for (let t9 = 0; t9 < 11; t9++) {
                        let a5 = t9 / 10 - 0.5, l7 = 1 - 1.7 * Math.abs(a5);
                        if (l7 <= 0.05) continue;
                        let r3 = a5 * s4 * 2, n4 = 150 + 140 * tw(7.3 * t9);
                        for (let a6 = 0; a6 < 3; a6++) {
                          let s5 = i5 + 30, o6 = (e11 * n4 + tw(13.7 * t9 + 5.1 * a6) * s5 * 3) % s5, d5 = 9 + 15 * tw(3.3 * a6 + t9), c4 = (0.1 + 0.2 * tw(3.1 * t9 + 9.7 * a6)) * l7 * Math.min(1, o6 / 26, (s5 - o6) / 26);
                          c4 <= 0.012 || (W2.fillStyle = `rgba(214,246,255,${c4})`, W2.fillRect(r3 - 1, -i5 + o6 - d5, 2, d5));
                        }
                      }
                      let d4 = Math.floor(9 * e11);
                      for (let e12 = 0; e12 < 9; e12++) {
                        let t9 = (tw(17.9 * e12 + d4) - 0.5) * s4 * 3.2, a5 = -(6 * tw(7.7 * e12 + 1.3 * d4));
                        W2.fillStyle = `rgba(226,248,255,${0.2 + 0.4 * tw(3.3 * e12 + 2.1 * d4)})`, W2.fillRect(t9, a5, 2, 2);
                      }
                      for (let t9 = 0; t9 < 3; t9++) {
                        let a5 = 10 + 8 * t9 + 3 * Math.sin(0.9 * e11 + 2.4 * t9), l7 = -4 - 6 * t9, n4 = 0.045 + 0.03 * Math.sin(0.7 * e11 + 2.1 * t9), i6 = W2.createRadialGradient(0, l7, 0, 0, l7, a5);
                        i6.addColorStop(0, `rgba(190,235,245,${Math.max(0, n4)})`), i6.addColorStop(1, "rgba(190,235,245,0)"), W2.fillStyle = i6, W2.beginPath(), W2.arc(0, l7, a5, 0, r2), W2.fill();
                      }
                      W2.restore();
                    }
                  }
                  if ("alps" === t7.zone || "greatwall" === t7.zone) {
                    let l6 = "alps" === t7.zone ? tk : tS;
                    for (let t8 = 0; t8 < l6.length; t8++) {
                      let r3 = tG(a4, l6[t8][0], l6[t8][1]), i5 = D2(r3.d, eg2 + L2()) * n3;
                      if (Math.abs(i5) > 1.1) continue;
                      let s4 = g2 + r3.h, o5 = 0.3 + 0.34 * (0.5 + 0.5 * Math.sin(e11 * (1.1 + tw(3.7 * t8)) + 2.6 * t8));
                      t_(v2 + s4 * Math.sin(i5), y2 - s4 * Math.cos(i5), i5, o5, "rgba(255,209,102,$)");
                    }
                  }
                  if ("outback" === t7.zone || "canyon" === t7.zone) {
                    let [l6, i5] = "outback" === t7.zone ? tC : t$, s4 = tG(a4, l6, i5), o5 = D2(s4.d, eg2 + L2()) * n3;
                    if (1.1 > Math.abs(o5)) {
                      let t8 = g2 + s4.h, a5 = v2 + t8 * Math.sin(o5), l7 = y2 - t8 * Math.cos(o5), n4 = 0.5 + 0.28 * Math.sin(9.1 * e11) + 0.22 * tw(Math.floor(13 * e11)), i6 = W2.createRadialGradient(a5, l7, 0, a5, l7, 22);
                      i6.addColorStop(0, `rgba(255,159,67,${0.16 * n4})`), i6.addColorStop(1, "rgba(255,159,67,0)"), W2.fillStyle = i6, W2.beginPath(), W2.arc(a5, l7, 22, 0, r2), W2.fill(), t_(a5, l7, o5, 0.55 + 0.4 * n4, "rgba(255,209,102,$)", 2, 2 + Math.round(2 * n4));
                    }
                  }
                  if ("antarctica" === t7.zone) {
                    let t8 = Math.floor(1.6 * e11);
                    for (let l6 = 0; l6 < 7; l6++) {
                      let r3 = tG(a4, tw(9.13 * l6 + 0.61 * t8), 0.62 + 0.28 * tw(4.7 * l6 + 1.13 * t8)), i5 = D2(r3.d, eg2 + L2()) * n3;
                      if (Math.abs(i5) > 1.05) continue;
                      let s4 = Math.sin(1.6 * e11 % 1 * Math.PI), o5 = g2 + r3.h;
                      W2.fillStyle = `rgba(210,240,255,${0.5 * s4})`, W2.fillRect(v2 + o5 * Math.sin(i5) - 1, y2 - o5 * Math.cos(i5) - 1, 2, 2);
                    }
                  }
                }
              }
              let t6 = tI();
              if (t6 && 60 > Math.abs(D2(0, eg2 + L2()))) {
                let a4 = tG(t6, 0.355, 0.885), l6 = D2(a4.d, eg2 + L2()) * n3;
                if (1.15 > Math.abs(l6)) {
                  let n4 = g2 + a4.h, i5 = v2 + n4 * Math.sin(l6), s4 = y2 - n4 * Math.cos(l6), o5 = 0.55 + 0.25 * Math.sin(10.7 * e11) + 0.2 * tw(Math.floor(14 * e11)), d4 = W2.createRadialGradient(i5, s4 - 3, 0, i5, s4 - 3, 30);
                  d4.addColorStop(0, `rgba(255,159,67,${0.2 * o5})`), d4.addColorStop(1, "rgba(255,159,67,0)"), W2.fillStyle = d4, W2.beginPath(), W2.arc(i5, s4 - 3, 30, 0, r2), W2.fill(), t_(i5, s4 - 2, l6, 0.5 + 0.45 * o5, "rgba(255,209,102,$)", 3, 3 + Math.round(3 * o5));
                  let c4 = tG(t6, 0.53, 0.85), h3 = g2 + c4.h, u3 = v2 + h3 * Math.sin(l6), f3 = y2 - h3 * Math.cos(l6), p3 = W2.createRadialGradient(u3, f3, 0, u3, f3, 34);
                  p3.addColorStop(0, `rgba(255,196,120,${0.07 + 0.025 * Math.sin(1.9 * e11)})`), p3.addColorStop(1, "rgba(255,196,120,0)"), W2.fillStyle = p3, W2.beginPath(), W2.arc(u3, f3, 34, 0, r2), W2.fill();
                }
              }
              for (let t7 of tR) {
                let a4 = D2(t7.d, eg2 + L2()) * n3;
                if (Math.abs(a4) > 1.15) continue;
                let l6 = g2 + t7.h, i5 = v2 + l6 * Math.sin(a4), s4 = y2 - l6 * Math.cos(a4), o5 = t7.t / t7.life;
                switch (t7.kind) {
                  case "lantern": {
                    let e12 = Math.min(t7.t / 1.4, 1, (t7.life - t7.t) / 2.2), a5 = 2 * Math.sin(1.3 * t7.t + t7.ph), l7 = W2.createRadialGradient(i5 + a5, s4, 0, i5 + a5, s4, 9);
                    l7.addColorStop(0, `rgba(255,180,107,${0.4 * e12})`), l7.addColorStop(1, "rgba(255,180,107,0)"), W2.fillStyle = l7, W2.beginPath(), W2.arc(i5 + a5, s4, 9, 0, r2), W2.fill(), W2.fillStyle = `rgba(255,180,107,${0.9 * e12})`, W2.fillRect(i5 + a5 - 1.5, s4 - 2, 3, 4), W2.fillStyle = `rgba(255,233,168,${0.9 * e12})`, W2.fillRect(i5 + a5 - 0.5, s4 - 1, 1, 2);
                    break;
                  }
                  case "smoke": {
                    let e12 = 2 + 5 * o5;
                    W2.fillStyle = `rgba(96,104,128,${0.3 * (1 - o5)})`, W2.beginPath(), W2.arc(i5 + 3 * Math.sin(1.9 * t7.t + t7.ph), s4, e12, 0, r2), W2.fill();
                    break;
                  }
                  case "breath":
                    W2.fillStyle = `rgba(226,240,255,${0.5 * (1 - o5)})`, W2.fillRect(i5 - 1, s4 - 1, 2 + 2 * o5, 2);
                    break;
                  case "ember":
                    W2.fillStyle = `rgba(${o5 < 0.5 ? "255,209,102" : "255,107,61"},${0.85 * (1 - o5)})`, W2.fillRect(i5 - 1, s4 - 1, 2, 2);
                    break;
                  case "firefly": {
                    let a5 = Math.min(t7.t / 0.8, 1, (t7.life - t7.t) / 1.2) * (0.35 + 0.65 * Math.max(0, Math.sin(2.6 * e11 + t7.ph)));
                    W2.fillStyle = `rgba(255,224,130,${0.9 * a5})`, W2.fillRect(i5, s4, 2, 2);
                    break;
                  }
                  case "morpho": {
                    let a5 = Math.abs(Math.sin(9 * e11 + t7.ph)), l7 = Math.min(t7.t / 0.8, 1, (t7.life - t7.t) / 1.2);
                    W2.fillStyle = `rgba(77,227,255,${0.8 * l7})`, W2.fillRect(i5 - 1 - a5, s4, 2, 2), W2.fillRect(i5 + 1 + a5, s4, 2, 2);
                  }
                }
              }
              for (let t7 of tT) {
                let a4 = D2(t7.d, eg2 + L2()) * n3;
                if (Math.abs(a4) > 1.05) continue;
                let l6 = Math.min(t7.t / 0.9, 1, (t7.life - t7.t) / 0.9), r3 = (0.9 * e11 + t7.ph) % 1.9 > 0.16 ? 1 : 0.06, i5 = g2 + t7.h;
                W2.save(), W2.translate(v2 + i5 * Math.sin(a4), y2 - i5 * Math.cos(a4)), W2.rotate(a4), W2.fillStyle = `rgba(255,196,80,${0.8 * l6 * r3})`, W2.fillRect(-4, -1, 2, 2), W2.fillRect(2, -1, 2, 2), W2.restore();
              }
              if (tL) {
                let t7 = D2(tL.d, eg2 + L2()) * n3;
                if (1.2 > Math.abs(t7)) {
                  let a4 = Math.sin(Math.min(1, tL.t / 1.7, (7.5 - tL.t) / 1.7) * Math.PI * 0.5), l6 = g2 - 9 + 12 * a4;
                  if (W2.save(), W2.translate(v2 + l6 * Math.sin(t7), y2 - l6 * Math.cos(t7)), W2.rotate(t7), W2.fillStyle = "rgba(13,18,30,0.95)", W2.beginPath(), W2.ellipse(0, 0, 26, 8, 0, Math.PI, r2), W2.fill(), W2.beginPath(), W2.moveTo(6, -7), W2.lineTo(10, -12), W2.lineTo(13, -7), W2.fill(), W2.strokeStyle = `rgba(150,200,255,${0.25 * a4})`, W2.lineWidth = 1, W2.beginPath(), W2.moveTo(-30, 2), W2.lineTo(30, 2), W2.stroke(), tL.t > 1.8 && tL.t < 3.4) {
                    let t8 = (tL.t - 1.8) / 1.6, a5 = 20 * Math.sin(t8 * Math.PI);
                    for (let l7 = 0; l7 < 7; l7++) {
                      let r3 = -8 - a5 * (l7 + 1) / 7, n4 = -6 + (tw(3.1 * l7 + Math.floor(12 * e11)) - 0.5) * (3 + 1.6 * l7);
                      W2.fillStyle = `rgba(220,240,255,${0.55 * Math.sin(t8 * Math.PI) * (1 - l7 / 8)})`, W2.fillRect(n4 - 6, r3, 2, 2);
                    }
                  }
                  W2.restore();
                }
              }
            })(e10);
          })(p2, b2.reducedMotion ? 0 : l4), !(function(e10, t5) {
            O2.clearRect(0, 0, i3, s3);
            {
              let t6 = 0.8 + 0.12 * Math.sin(6.3 * e10) + 0.08 * Math.sin(15.7 * e10 + 1.3), a4 = O2.createRadialGradient(tO, tU + 6, 4, tO, tU + 6, 120);
              a4.addColorStop(0, `rgba(255,196,120,${0.13 * t6})`), a4.addColorStop(0.5, `rgba(255,170,90,${0.055 * t6})`), a4.addColorStop(1, "rgba(255,170,90,0)"), O2.fillStyle = a4, O2.beginPath(), O2.arc(tO, tU + 6, 120, 0, r2), O2.fill();
              let l5 = O2.createRadialGradient(tO, tU, 2, tO, tU, 34);
              l5.addColorStop(0, `rgba(255,226,160,${0.16 * t6})`), l5.addColorStop(1, "rgba(255,226,160,0)"), O2.fillStyle = l5, O2.beginPath(), O2.arc(tO, tU, 34, 0, r2), O2.fill();
            }
            {
              let e11 = ex2(tB, 2);
              e11.y, O2.save(), O2.translate(e11.x, e11.y), O2.rotate(e11.phi), O2.scale(1, 0.2), O2.fillStyle = "rgba(0,0,0,0.45)", O2.beginPath(), O2.arc(0, 0, 26, 0, 7), O2.fill(), O2.restore();
            }
            if (!(function(e11, t6) {
              let a4 = ty(tB);
              a4 !== tW && (tW && ta(tO + 20, tU + 8, "#ffe9a8", 6, 0.4), tW = a4, tH = 0, tF = 0);
              let l5 = tm[a4];
              if (!l5) return;
              let r3 = ex2(tB, 0);
              if (O2.save(), O2.translate(Math.round(r3.x), Math.round(r3.y)), O2.rotate(r3.phi + 0), "savanna" === a4) {
                tH += e11 * (2 + 0.09 * t6) * Math.PI, tF > 0 ? tF = Math.max(0, tF - e11) : Math.random() < 0.25 * e11 && (tF = 1.5);
                let a5 = tF > 0 ? Math.min(1, (1.5 - tF) * 6, 6 * tF) : 0, n4 = 2 * Math.sin(tH) * (1 - a5);
                O2.translate(16, -24 - 14 * a5 + n4), O2.rotate(-(0.08 * a5)), O2.drawImage(l5, -l5.width / 2, -l5.height / 2), a5 > 0.9 && Math.random() < 2 * e11 && te(r3.x + 30, r3.y - 44, 1 + Math.random(), "255,233,168");
              } else if ("amazon" === a4) {
                tH += e11 * (2 + 0.09 * t6) * Math.PI, tF > 0 ? tF = Math.max(0, tF - e11) : t6 > 5 && Math.random() < 0.5 * e11 && (tF = 0.4);
                let a5 = tF > 0 ? Math.sin((1 - tF / 0.4) * Math.PI) : 0, n4 = 3 * Math.sin(tH);
                O2.translate(18, -26 + n4), O2.rotate(-0.25 - 0.9 * a5), O2.drawImage(l5, -l5.width / 2, -l5.height / 2), a5 > 0.85 && te(r3.x + 26, r3.y - 44, 1.4 + Math.random(), "77,227,255");
              } else if ("alps" === a4) {
                let a5 = Math.sin(tH += e11 * (3 + 0.14 * t6) * Math.PI);
                O2.translate(18, -22), O2.rotate(0.35 * a5), O2.drawImage(l5, -l5.width / 2, -l5.height / 2), a5 > 0.94 && t6 > 4 && 0.5 > Math.random() && te(r3.x + 24, r3.y - 4, 0.9 + 0.8 * Math.random(), "232,240,255");
              } else if ("greatwall" === a4) {
                let a5 = 0.22 * Math.sin(0.7 * (tH += e11 * (2 + 0.09 * t6) * Math.PI)), n4 = O2.createRadialGradient(34, -32, 4, 34, -32, 64);
                n4.addColorStop(0, "rgba(255,180,107,.22)"), n4.addColorStop(1, "rgba(255,180,107,0)"), O2.fillStyle = n4, O2.beginPath(), O2.arc(34, -32, 64, 0, 7), O2.fill(), O2.translate(26, -40), O2.rotate(a5), O2.drawImage(l5, -(0.3 * l5.width), -4), Math.random() < 1.6 * e11 && te(r3.x + 36, r3.y - 34, 0.9 + 0.9 * Math.random(), "255,180,107");
              } else if ("outback" === a4) if (tH += e11 * (2 + 0.09 * t6) * Math.PI, tF > 0) {
                let t7 = 1 - (tF = Math.max(0, tF - e11)) / 1.15, a5 = Math.sin(t7 * Math.PI);
                O2.translate(20 + 130 * a5, -36 - 24 * Math.sin(t7 * Math.PI * 2) - 34 * a5), O2.rotate(t7 * Math.PI * 6), O2.drawImage(l5, -l5.width / 2, -l5.height / 2), 0 === tF && ta(r3.x + 22, r3.y - 30, "#ffd166", 6, 0.4);
              } else {
                t6 > 5 && Math.random() < 0.4 * e11 && (tF = 1.15);
                let a5 = 3 * Math.sin(tH);
                O2.translate(18, -24 + a5), O2.rotate(0.12 * Math.sin(0.5 * tH)), O2.drawImage(l5, -l5.width / 2, -l5.height / 2);
              }
              else if ("canyon" === a4) {
                tH += e11 * (2 + 0.09 * t6) * Math.PI, tF > 0 ? tF = Math.max(0, tF - e11) : Math.random() < 0.22 * e11 && (tF = 1.8);
                let a5 = tF > 0 ? Math.min(1, (1.8 - tF) * 5, 5 * tF) : 0, r4 = 2 * Math.sin(tH) * (1 - a5);
                O2.translate(18, -26 - 10 * a5 + r4), O2.rotate(-(0.65 * a5)), O2.drawImage(l5, -l5.width / 2, -l5.height / 2), a5 > 0.9 && Math.random() < 0.9 * e11 && tb();
              } else {
                let a5 = 0.07 * Math.sin(1.6 * (tH += e11 * (2.6 + 0.1 * t6) * Math.PI));
                O2.translate(16, -34), O2.rotate(a5 - 0.05), O2.drawImage(l5, -(0.2 * l5.width), -(0.2 * l5.height)), Math.random() < 1.2 * e11 && te(r3.x + 24, r3.y - 40, 0.8 + 0.8 * Math.random(), "232,240,255");
              }
              O2.restore();
            })(t5, tK), !(function(e11, t6) {
              for (let a4 = ez.length - 1; a4 >= 0; a4--) {
                let l5 = ez[a4];
                if (l5.t += t6, l5.off += l5.spd * t6, l5.t > l5.life) {
                  ez.splice(a4, 1);
                  continue;
                }
                let r3 = ex2(tB + l5.off, 8);
                if (Math.abs(r3.phi) > 1.15) continue;
                let n4 = Math.min(1, 3 * l5.t, (l5.life - l5.t) * 1.5), i4 = Math.sin(10 * e11 + l5.ph), s4 = 2 * Math.abs(i4);
                O2.save(), O2.translate(r3.x, r3.y), O2.rotate(r3.phi), O2.globalAlpha = 0.85 * n4, O2.strokeStyle = "rgba(210,222,255,0.9)", O2.fillStyle = "rgba(210,222,255,0.9)", O2.lineWidth = 2, O2.beginPath(), O2.moveTo(-3 + 3 * i4, 0), O2.lineTo(0, -7 - s4), O2.lineTo(3 - 3 * i4, 0), O2.moveTo(0, -7 - s4), O2.lineTo(0, -14 - s4), O2.moveTo(2, -11 - s4), O2.lineTo(6 + 1.5 * i4, 0), O2.stroke(), O2.beginPath(), O2.arc(0, -16.5 - s4, 2.6, 0, 2 * Math.PI), O2.fill(), l5.flag && (O2.beginPath(), O2.moveTo(-2, -14 - s4), O2.lineTo(-2, -27 - s4), O2.stroke(), O2.fillStyle = "rgba(255,159,67,0.95)", O2.beginPath(), O2.moveTo(-2, -27 - s4), O2.lineTo(-11, -24.5 - s4), O2.lineTo(-2, -22 - s4), O2.closePath(), O2.fill()), O2.restore();
              }
              O2.globalAlpha = 1;
            })(e10, t5), !(function(e11, t6) {
              for (let a4 = tj.length - 1; a4 >= 0; a4--) {
                let l5 = tj[a4];
                l5.d += l5.vd * t6, l5.h += l5.vh * t6 + (l5.blow ? 0 : 2 * Math.sin(1.2 * e11 + l5.ph) * t6);
                let r3 = D2(l5.d, eg2 + L2()) * n3;
                if (l5.h < 3 || Math.abs(r3) > 1.2) {
                  tj.splice(a4, 1);
                  continue;
                }
                let i4 = g2 + l5.h, s4 = v2 + i4 * Math.sin(r3), o4 = y2 - i4 * Math.cos(r3);
                l5.blow ? (O2.fillStyle = "rgba(222,240,255,0.45)", O2.fillRect(s4 - 2, o4, 4, 1)) : (O2.fillStyle = `rgba(232,242,255,${0.35 + 0.25 * Math.sin(2.2 * e11 + l5.ph)})`, O2.fillRect(s4, o4, 2, 2));
              }
            })(e10, t5), eT) {
              let e11 = O2.createRadialGradient(tO, tU - 6, 6, tO, tU - 6, 84);
              e11.addColorStop(0, "rgba(255,231,186,.1)"), e11.addColorStop(1, "rgba(255,231,186,0)"), O2.fillStyle = e11, O2.beginPath(), O2.arc(tO, tU - 6, 84, 0, 7), O2.fill();
            }
            eB && (function(e11, t6, a4, l5) {
              if (!eB) return;
              let r3 = "hold" === eK ? 0.62 : 1;
              for (let n4 of eB) {
                let i4 = n4.rad * r3 * (1 + 7 * eJ), s4 = a4 + Math.cos(n4.ang + t6 * n4.w) * i4 * 1.12, o4 = l5 + Math.sin(n4.ang + t6 * n4.w) * i4 * 0.62 + 4 * Math.sin(2.2 * t6 + n4.ph);
                e11.globalAlpha = Math.max(0, 0.92 - 1.15 * eJ), e11.save(), e11.translate(s4, o4);
                let d4 = 0.4 * n4.s, c4 = 0.7 + 0.3 * Math.sin(4 * t6 + n4.ph);
                e11.fillStyle = `rgba(255,209,102,${c4})`, e11.beginPath(), e11.arc(0, 0, d4, 0, 7), e11.fill(), e11.fillStyle = `rgba(20,16,8,${c4})`, e11.beginPath(), e11.arc(0, 0, 0.62 * d4, 0, 7), e11.fill();
                let h3 = t6 * n4.w * 2 + n4.ph;
                e11.strokeStyle = `rgba(255,107,61,${c4})`, e11.lineWidth = 2, e11.beginPath(), e11.moveTo(-Math.cos(h3) * d4 * 0.45, -Math.sin(h3) * d4 * 0.45), e11.lineTo(Math.cos(h3) * d4 * 0.45, Math.sin(h3) * d4 * 0.45), e11.stroke(), e11.restore();
              }
              e11.globalAlpha = 1;
            })(O2, e10, tO, tU);
            for (let a4 = e42.length - 1; a4 >= 0; a4--) {
              let l5 = e42[a4];
              l5.h += l5.vh * t5, l5.life -= t5;
              let r3 = ex2(l5.d + 0.3 * Math.sin(3 * e10 + l5.wob), l5.h);
              if (l5.life <= 0 || l5.h > s3 || Math.abs(r3.phi) > 1.1) {
                e42.splice(a4, 1);
                continue;
              }
              let n4 = Math.min(0.7, 0.5 * l5.life);
              if (O2.fillStyle = `rgba(${l5.col},${n4})`, l5.r > 2.6) {
                let e11 = 1.6 * l5.r;
                O2.fillRect(r3.x - e11 / 2, r3.y - 1, e11, 2), O2.fillRect(r3.x - 1, r3.y - e11 / 2, 2, e11), O2.fillRect(r3.x - 1.5, r3.y - 1.5, 3, 3);
              } else O2.fillRect(r3.x - l5.r / 2, r3.y - l5.r / 2, l5.r, l5.r);
            }
            for (let e11 = e6.length - 1; e11 >= 0; e11--) {
              let a4 = e6[e11];
              a4.t += t5;
              let l5 = a4.t / a4.life;
              if (l5 >= 1) {
                e6.splice(e11, 1);
                continue;
              }
              a4.d += a4.vd * t5, a4.h += a4.vh * t5, a4.vh *= 1 - 1.2 * t5;
              let r3 = ex2(a4.d, a4.h), n4 = a4.r * (0.5 + l5);
              O2.globalAlpha = 0.4 * (1 - l5);
              let i4 = O2.createRadialGradient(r3.x, r3.y, 0, r3.x, r3.y, n4);
              i4.addColorStop(0, a4.col[0]), i4.addColorStop(1, a4.col[1]), O2.fillStyle = i4, O2.beginPath(), O2.arc(r3.x, r3.y, n4, 0, 7), O2.fill();
            }
            O2.globalAlpha = 1;
            for (let a4 = e8.length - 1; a4 >= 0; a4--) {
              let l5 = e8[a4];
              if (l5.t += t5, l5.t > l5.life) {
                e8.splice(a4, 1);
                continue;
              }
              l5.d += l5.vd * t5 + 0.5 * Math.sin(2.4 * e10 + l5.ph) * t5, l5.h += l5.vh * t5;
              let r3 = ex2(l5.d, l5.h);
              if (Math.abs(r3.phi) > 1.1 || l5.h < -30) {
                e8.splice(a4, 1);
                continue;
              }
              O2.globalAlpha = Math.min(1, (l5.life - l5.t) * 1.4), O2.save(), O2.translate(r3.x, r3.y), O2.rotate(r3.phi + 1.1 * Math.sin(3 * e10 + l5.ph)), O2.fillStyle = l5.color, O2.fillRect(-(1.1 * l5.r), -(0.4 * l5.r), 2.2 * l5.r, 0.8 * l5.r), O2.restore();
            }
            O2.globalAlpha = 1;
            for (let e11 = e32.length - 1; e11 >= 0; e11--) {
              let a4 = e32[e11];
              if (a4.t += t5, a4.t > a4.life) {
                e32.splice(e11, 1);
                continue;
              }
              a4.d += a4.vd * t5, a4.h += a4.vh * t5, a4.vd *= 1 - 2.4 * t5, a4.vh *= 1 - 2.4 * t5, a4.vh -= 30 * t5;
              let l5 = ex2(a4.d, a4.h);
              O2.globalAlpha = 1 - a4.t / a4.life, O2.fillStyle = a4.color, O2.fillRect(l5.x - a4.r / 2, l5.y - a4.r / 2, a4.r, a4.r);
            }
            O2.globalAlpha = 1;
          })(p2, l4), !(function(t5, a4) {
            if (eY && !eY.isConnected && e0(), "plunge" === ew2) tB = e$;
            else if ("finale" === ew2) tB = eg2 + L2();
            else {
              let e10 = "intro" === ew2 ? -26 : eL;
              tB += (e10 - tB) * (1 - Math.exp(("descend" === ew2 ? -1.5 : -3.4) * a4));
            }
            let l5 = Math.abs(eg2 - ev2) / Math.max(a4, 1e-4);
            tK += (l5 - tK) * (1 - Math.exp(-8 * a4)), "finale" !== ew2 && (t1 = Math.max(t1, tB));
            let r3 = "plunge" === ew2 ? eR : 0, i4 = tv(tB), s4 = "antarctica" === ty(tB) && "ocean" !== i4, o4 = "ocean" === i4;
            tJ += (b2.reducedMotion ? 0 : a4) * (3.4 + 0.075 * Math.min(tK * g2 * n3, 280));
            let d4 = Math.abs(Math.sin(tJ)), c4 = o4 ? 4 * Math.sin(2.6 * t5) : d4 * Math.min(2.5 + tK * g2 * n3 * 0.03, 7) * (s4 ? 0.3 : 1);
            s4 && tK * g2 * n3 > 60 && Math.random() < 8 * a4 && te(tO - 16, tU + 22, 0.8 + Math.random(), "220,236,255"), o4 && tK * g2 * n3 > 40 && Math.random() < 6 * a4 && te(tO - 14, tU + 24, 1 + Math.random(), "150,200,255");
            let h3 = ex2(tB, 26 + c4 + (o4 ? -6 : 0)), u3 = h3.x, f3 = h3.y + 0.4 * r3;
            if (eY) {
              let t6 = eY.getBoundingClientRect();
              u3 = t6.left - e4.getBoundingClientRect().left + t6.width / 2, f3 = t6.top - e4.getBoundingClientRect().top + t6.height / 2, J2.classList.add("perched");
            }
            !Number.isNaN(tZ) && (Math.abs(u3 - tZ) > 60 || Math.abs(f3 - tQ) > 60) && (tY -= u3 - tZ, tX -= f3 - tQ), tZ = u3, tQ = f3;
            let p3 = 1 - Math.exp(-6.5 * a4);
            tY -= tY * p3, tX -= tX * p3, tO = u3 + tY, tU = f3 + tX;
            let m3 = eY ? 0 : h3.phi * (180 / Math.PI) + 6 * !!s4 + Math.min(11, tK * g2 * n3 * 0.05) + 1.2 * Math.sin(0.9 * t5);
            tV += (m3 - tV) * p3;
            let v3 = J2.offsetWidth / 2;
            J2.style.transform = `translate3d(${tO - v3}px,${tU - v3}px,0) rotate(${tV}deg)`, !b2.reducedMotion && eX && t5 - tz > 0.55 && e32.length < 200 && (tz = t5, tl(tO + I2(-10, 10), tU + I2(-4, 12)));
          })(p2, l4), eD)) {
            if (Math.abs(D2(t4.d, eg2 + L2())) * n3 > 0.9) {
              t4.el.style.display = "none";
              continue;
            }
            t4.el.style.display = "";
            let e10 = ex2(t4.d, Math.min(t4.h, 0.5 * s3));
            t4.el.style.transform = `translate3d(${e10.x}px, ${e10.y}px, 0) rotate(${e10.phi}rad) translate(-50%, 0)`;
          }
          if (eN) for (let e10 of eN) {
            if (Math.abs(D2(e10.d, eg2 + L2())) * n3 > 1) {
              e10.el.style.display = "none";
              continue;
            }
            e10.el.style.display = "";
            let t4 = ex2(e10.d, 0.3 * s3 + (parseFloat(e10.el.style.getPropertyValue("--stagger")) || 0));
            e10.el.style.transform = `translate3d(${t4.x}px, ${t4.y}px, 0) rotate(${t4.phi}rad) translate(-50%, 0)`;
          }
        }, () => eb2.length > 0 || "plunge" === ew2 || "descend" === ew2), { intro() {
          b2.invalidate(), U2.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e10) => e10.remove()), eN = null, ej = null, U2.classList.remove("ds-reveal"), V2.classList.remove("on"), eb2.length = 0, eB = null, eK = null, eJ = 0, e0(), eQ(), eL = 0, ek2 = 0, eS = 0, eC = 0, Q2.textContent = "0", ew2 = "intro", ey2(-26 - L2() + 3), tB = -26, t1 = -26, tP = 0, ez.length = 0, tx.length = 0, tR.length = 0, tT.length = 0, tj.length = 0, tL = null, tF = 0, eP();
        }, finale() {
          b2.invalidate(), X2.setGold(eX), U2.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e11) => e11.remove()), eN = null, ej = null, U2.classList.remove("ds-reveal"), V2.classList.remove("on"), eB = null, eK = null, eJ = 0, e0(), ew2 = "finale", eb2.length = 0;
          let e10 = ep2, t3 = 700 - q2(e10) + 2;
          eM2(Math.min(11e3, Math.max(3e3, 14 * t3)), P2, (a4) => {
            ep2 = e10 + t3 * a4;
          }), en2.event("surface"), eP();
        }, descendToRound(e10, t3, a4 = 2200) {
          b2.invalidate(), eG(), U2.classList.remove("ds-reveal"), e0(), U2.querySelectorAll(".ds-landed").forEach((e11) => {
            e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
          }), eA = eL, eH(e10, t3, 0.45), ew2 = "descend", eO(), eP();
          let l4 = ep2, r3 = eA;
          eM2(a4, _2, (e11) => {
            ep2 = A2(l4, r3, e11);
          }, () => {
            ew2 = "round", eP();
          });
        }, restore(e10, t3, a4) {
          b2.invalidate(), U2.querySelectorAll(".ds-landed,.ds-card,.ds-tierline").forEach((e11) => e11.remove()), eN = null, ej = null, ek2 = a4.length, e0(), a4.some((e11) => "krillion" === e11.tier) ? eZ(true) : eQ();
          let l4 = a4.reduce((e11, t4) => e11 + t4.points, 0);
          eL = l4, eS = l4, eC = l4, Q2.textContent = String(l4), eA = eL, e10 < 7 && t3 && eH(e10, t3), ey2(eA), tB = eA, t1 = Math.max(t1, eA), ew2 = "round", eP();
        }, plunge(e10, t3) {
          b2.invalidate(), null !== e10.tier && (function(e11) {
            for (let t4 of (eG(true), eN = [], p.TIER_IDS)) {
              let a4 = p.TIERS[t4], l4 = e11 + a4.score, r3 = document.createElement("div");
              r3.className = "ds-tierline gl-tierline", r3.style.setProperty("--tc", `var(--tier-${t4})`), r3.style.setProperty("--stagger", String(eN.length % 2 ? 34 : 0)), r3.innerHTML = `<div class="tag"><img src="${(0, k.seasonalKrillSprite)(`/tiers/${t4}.png`)}" alt="">${a4.name.toUpperCase()} &middot; ${a4.score}</div><i class="pole"></i>`, r3.style.opacity = "0", U2.appendChild(r3);
              let n4 = 90 * eN.length;
              requestAnimationFrame(() => {
                r3.style.transition = "opacity .55s ease-out " + n4 + "ms", r3.style.opacity = "1";
              }), eN.push({ d: l4, el: r3, tier: t4, passed: false });
            }
          })(eA), (function(e11, t4) {
            ew2 = "plunge", U2.classList.add("ds-reveal");
            let l4 = eA, r3 = e11.tier ?? "miss";
            if (ej) {
              let e12 = ej;
              ta(i3 / 2, 0.3 * s3, "#ffd166", 12, 0.6), e12.classList.add("gone"), setTimeout(() => e12.remove(), 650), ej = null;
            }
            if (!e11.tier) {
              eW(), eO(), en2.event("miss"), eU("rgba(61,79,110,.5)", 1, 200), e5("sad", 2600);
              for (let e12 = 0; e12 < 7; e12++) tt(tO + I2(-30, 30), tU + I2(16, 34));
              e_(() => {
                eF(e11, l4), eL = l4, ek2++, eS = l4, eq(e11.newScore, false), ew2 = "landed", eP(), e_(() => U2.classList.remove("ds-reveal"), 900), t4();
              }, 900);
              return;
            }
            let n4 = p.TIERS[e11.tier], o4 = e1[e11.tier], d4 = l4 + n4.score, c4 = e11.answerText.toUpperCase(), h3 = document.createElement("div");
            h3.className = "ds-chip gl-plate-wrap", h3.style.setProperty("--cc", `var(--tier-${e11.tier})`), h3.innerHTML = `<span class="gl-plate">\u201C${c4}\u201D</span>`, U2.appendChild(h3);
            let u3 = tB, f3 = eS;
            switch (e$ = u3, eT = true, en2.event("sink"), r3) {
              case "plankton":
                e5("sad", o4.dur + 800);
                break;
              case "tooclever":
                eU("rgba(255,159,67,.7)", 3, 130), eW(), e5("faint", 2400);
                var m3 = o4.dur;
                let g3 = i3 < 700 ? 8 : 12;
                for (let e12 = 0; e12 < g3; e12++) ez.push({ off: -6 - e12 * I2(1.7, 2.6), spd: I2(7, 11), ph: I2(0, 9), t: 0, life: m3 / 1e3 + 2.4, flag: e12 % 3 == 0 });
                break;
              case "rare":
                eU("rgba(255,82,82,.4)", 1, 220), tr(tO, tU + 22, 10);
                break;
              case "deepcut":
                eV(tO, tU), V2.classList.add("on");
                break;
              case "krillion":
                eU("rgba(255,209,102,.45)", 1, 180), h3.classList.add("gold"), eK = "follow", eJ = 0, eB = [];
                let v3 = i3 < 700 ? 14 : 20;
                for (let e12 = 0; e12 < v3; e12++) eB.push({ ang: Math.random() * Math.PI * 2, rad: 30 + 48 * Math.random(), w: (0.7 + 1.5 * Math.random()) * (0.5 > Math.random() ? -1 : 1), ph: 9 * Math.random(), s: 15 + 13 * Math.random() });
                tP = Math.max(tP, 3);
            }
            eM2(o4.dur, o4.ease, (t5) => {
              e$ = A2(u3, d4, t5);
              let a4 = 0;
              "plankton" === r3 ? (eR = 10 * Math.sin(7 * t5) * (1 - 0.25 * t5), a4 = 2 * Math.sin(9 * t5)) : "tooclever" === r3 ? (eR = 4 * Math.sin(42 * t5) + I2(-1.5, 1.5), a4 = I2(-2, 2)) : "krillion" === r3 ? (eR = Math.sin(24 * t5) * (1 - t5) * 8, a4 = 1.5 * Math.sin(18 * t5)) : (eR = Math.sin(16 * t5) * (1 - t5) * 5, a4 = 1.2 * Math.sin(12 * t5)), h3.style.transform = `translate3d(-50%, ${eR}px, 0) rotate(${a4}deg)`, h3.style.left = tO + "px", h3.style.top = tU - 120 + "px", ep2 = e$, "krillion" !== r3 && (eS = A2(f3, d4, t5));
              let l5 = tO, n5 = tU + 0.4 * eR;
              if ("plankton" === r3 ? 0.25 > Math.random() && tt(l5 - 30, n5 + 20) : "rare" === r3 ? 0.12 > Math.random() && tr(l5 - 24, n5 + 20, 3) : "krillion" === r3 ? 0.5 > Math.random() && te(l5 - 28, n5 + I2(-16, 4), 1.5 + 2 * Math.random()) : "deepcut" === r3 ? (eV(l5, n5), 0.3 > Math.random() && te(l5 - 26, n5, 1 + 2 * Math.random())) : 0.6 > Math.random() && te(l5 - 28 + I2(-6, 6), n5 + I2(-4, 8), 1.5 + 2.5 * Math.random()), eN) {
                for (let t6 of eN) if (!t6.passed && e$ > t6.d - 0.5 && (t6.passed = true, t6.el.classList.add("passed"), en2.event("tierline"), t6.tier !== e11.tier)) {
                  let e12 = ex2(t6.d, 40);
                  ta(e12.x, e12.y, N[t6.tier], 7, 0.5);
                }
              }
            }, () => {
              eT = false, h3.remove(), (function(e12, t5, l5) {
                ew2 = "landed";
                let r4 = e12.tier;
                en2.event("krillion" === r4 ? "krillion" : "plankton" === r4 || "tooclever" === r4 ? "land_small" : "land_big");
                let n5 = eF(e12, t5);
                eL = t5, ek2++, ep2 = t5;
                let o5 = tO, d5 = tU, c5 = N[r4];
                switch (r4) {
                  case "plankton":
                    ta(o5, d5, "#8fa3c4", 8, 0.4), eS = t5, eq(e12.newScore, false);
                    break;
                  case "tooclever":
                    eU("rgba(255,159,67,.6)", 2, 130), eW(), ta(o5, d5, c5, 18, 0.7), eS = t5, eq(e12.newScore, false);
                    break;
                  case "schooler":
                    ta(o5, d5, c5, 22, 0.8), eS = t5, eq(e12.newScore, false);
                    break;
                  case "rare":
                    tr(o5, d5, 18), ta(o5, d5, c5, 26, 0.9), eW(), eU("rgba(255,82,82,.45)", 1, 240), eS = t5, eq(e12.newScore, false);
                    break;
                  case "deepcut":
                    eV(o5, d5, 200), ta(o5, d5, c5, 18, 0.7), eS = t5, eq(e12.newScore, false), e_(() => V2.classList.remove("on"), 550);
                    break;
                  case "krillion":
                    eK = "hold", n5.classList.add("perched"), eU("rgba(255,255,255,.5)", 4, 110), tP = 7, (function() {
                      let e13 = i3 < 700 ? 60 : 110;
                      for (let t6 = 0; t6 < e13 && e8.length < 220; t6++) {
                        let e14 = e7(I2(-(0.1 * i3), 1.1 * i3), I2(-(0.1 * s3), 0.4 * s3));
                        e8.push({ d: e14.d, h: e14.h, vd: e9(I2(-16, 16)), vh: -I2(30, 90), r: I2(3, 5.5), life: I2(2.4, 4.4), t: 0, ph: I2(0, 9), color: a3.confetti[Math.random() * a3.confetti.length | 0] });
                      }
                    })();
                    for (let e13 = 0; e13 < 12; e13++) e_(() => tb(), 160 * e13);
                    for (let e13 = 0; e13 < 14; e13++) e_(() => tl(I2(0.1 * i3, 0.9 * i3), I2(0.15 * s3, 0.6 * s3)), 90 * e13);
                    e5("celebrate", 1250), e_(() => {
                      eZ(), eM2(1500, P2, (e13) => {
                        eJ = e13;
                      }, () => {
                        eB = null, eK = null, eJ = 0;
                      }), eq(e12.newScore, true), e_(() => {
                        let e13, a4, l6;
                        return e13 = eS, a4 = 0, l6 = setInterval(() => {
                          eS = Math.round(e13 + (t5 - e13) * (1 - Math.pow(1 - ++a4 / 8, 2))), Z2.classList.remove("crank"), Z2.offsetWidth, Z2.classList.add("crank"), a4 >= 8 && (clearInterval(l6), eS = t5);
                        }, 110), void eI.push(l6);
                      }, 350), e_(() => {
                        "landed" === ew2 && (eY = n5.querySelector(".icon"));
                      }, 900);
                    }, 1e3);
                }
                eP(), eG(), U2.classList.remove("ds-reveal"), l5();
              })(e11, d4, t4);
            });
          })(e10, t3);
        }, showLanded(e10, t3) {
          b2.invalidate();
          let a4 = e10.tier ? eA + e10.points : eA;
          ej?.remove(), ej = null;
          let l4 = eF(e10, a4);
          "krillion" === e10.tier ? (eZ(true), l4.classList.add("perched"), eY = l4.querySelector(".icon")) : e0(), eL = a4, ek2++, eS = eL, eC = e10.newScore, Q2.textContent = String(e10.newScore), ey2(a4), t1 = Math.max(t1, tB = eL), ew2 = "landed", eP(), t3 && requestAnimationFrame(() => t3());
        }, setUrgency(t3) {
          if (e4.style.setProperty("--ds-urgency", t3.toFixed(3)), z2.classList.toggle("danger", t3 > 0.8), t3 > 0.8 && t3 < 1) {
            let e10 = Math.ceil((1 - t3) * 15);
            e10 !== ef2 && (ef2 = e10, en2.event("tick"));
          } else ef2 = -1;
        }, typeFx(e10, t3) {
          b2.invalidate(), te(e10 + I2(-3, 3), t3 + I2(4, 12), 1 + 2 * Math.random()), 0.3 > Math.random() && te(e10 + I2(-8, 8), t3 + I2(2, 10), 1 + 1.6 * Math.random());
        }, submitFx(t3) {
          b2.invalidate(), eO(), en2.event("submit");
          let a4 = e4.getBoundingClientRect().left, l4 = e4.getBoundingClientRect().top;
          for (let e10 = 0; e10 < 12; e10++) te(t3.left - a4 + I2(0, t3.width), t3.top - l4 + I2(0, t3.height), 2 + 3 * Math.random());
          z2.classList.remove("danger"), e4.style.setProperty("--ds-urgency", "0");
        }, rejectFx() {
          b2.invalidate(), eO(), en2.event("reject"), tt(i3 / 2 + I2(-40, 40), s3 - 120), tt(i3 / 2 + I2(-40, 40), s3 - 130);
        }, destroy() {
          eE = true, X2.destroy(), b2.destroy(), M2(), removeEventListener("resize", el2), er2.disconnect(), t0(), ei2.removeEventListener("click", eu2), eh2(), en2.release(), eI.forEach((e10) => {
            clearTimeout(e10), clearInterval(e10);
          }), eI = [], eb2.length = 0, e4.innerHTML = "";
        } };
      })(s2.current, c2.current);
      return o2.current = e3, d2.current?.(), () => {
        e3.destroy(), o2.current = null;
      };
    }, []), (0, r.useImperativeHandle)(i2, () => ({ intro: (...e3) => o2.current?.intro(...e3), finale: (...e3) => o2.current?.finale(...e3), descendToRound: (...e3) => o2.current?.descendToRound(...e3), restore: (...e3) => o2.current?.restore(...e3), plunge: (...e3) => o2.current?.plunge(...e3), showLanded: (...e3) => o2.current?.showLanded(...e3), setUrgency: (...e3) => o2.current?.setUrgency(...e3), typeFx: (...e3) => o2.current?.typeFx(...e3), submitFx: (...e3) => o2.current?.submitFx(...e3), rejectFx: (...e3) => o2.current?.rejectFx(...e3), destroy: () => {
    } }), []), (0, t.jsx)(w.default, { phase: e2, disabled: "tour" === e2, children: (0, t.jsxs)("div", { className: "ds-root", "data-phase": e2, "data-world": "globe", children: [(0, t.jsx)("div", { ref: s2, style: { position: "absolute", inset: 0 } }), n2] }) });
  });
  var _ = e.i(81801);
  let P = { left: 0.0133, right: 0.9867, top: 0.0214, bottom: 0.9806 }, q = 0.4983, D = [0.0837, 0.1255, 0.1643, 0.2031, 0.2439, 0.2827, 0.3235, 0.3622, 0.402, 0.4418, 0.4816, 0.5214, 0.5592, 0.601, 0.6408, 0.6796, 0.7194, 0.7582, 0.8, 0.8378, 0.8786, 0.9163], G = 0.0837, H = 0.0398, F = 22, W = { plankton: "#8fa3c4", tooclever: "#ff9f43", schooler: "#4de3ff", rare: "#ff5252", deepcut: "#9d7bff", krillion: "#ffd166" }, O = (0, r.forwardRef)(function({ phase: e2, opts: a2, onReady: l2, children: n2 }, i2) {
    let s2 = (0, r.useRef)(null), o2 = (0, r.useRef)(null), d2 = (0, r.useRef)(l2);
    d2.current = l2;
    let c2 = (0, r.useRef)(a2);
    return (0, r.useEffect)(() => {
      if (!s2.current) return;
      let e3 = (function(e4, t2) {
        let a3, l3, r2 = t2.theme, n3 = r2.copy, i3 = e4.clientWidth || innerWidth, s3 = e4.clientHeight || innerHeight, o3 = 0, d3 = 0, c3 = 0, h2 = 0, u2 = (0, C.createWorldRenderer)(e4), f2 = (0, S.watchSeasonalKrillImages)(e4), m2 = u2.revision, g2 = u2.pixelRatio(i3, s3), v2 = (e10, t3) => e10 + Math.random() * (t3 - e10), y2 = (e10, t3, a4) => Math.max(t3, Math.min(a4, e10)), x2 = (t3) => getComputedStyle(e4).getPropertyValue(`--tier-${t3}`).trim() || W[t3], b2 = () => getComputedStyle(e4).getPropertyValue("--tier-krillion-notebook").trim() || r2.goldInk, M2 = (e10) => {
          let t3 = 43758.5453 * Math.sin(127.1 * e10 + 311.7);
          return t3 - Math.floor(t3);
        }, w2 = Math.floor(1e6 * Math.random());
        e4.innerHTML = `
    <div class="ds-stage">
      <canvas class="ds-sea"></canvas>
      <div class="ds-world">
        <div class="ds-surface">
          <div class="ds-title"></div>
          <div class="ds-tagline"></div>
          <div class="ds-subline"></div>
        </div>
      </div>
      <canvas class="ds-fore"></canvas>
      <div class="ds-dim"></div>
      <div class="ds-vignette"></div>
      <div class="ds-edge"></div>
      <div class="ds-flash"></div>
      <div class="ds-hud">
        <div class="ds-pod ds-px"><div class="label">${n3.hudLabel}</div><div class="ds-depth-num">1</div></div>
        <div class="ds-hud-mid"><div class="ds-dots"></div><div class="ds-prompt-count">${n3.surfaceLabel}</div></div>
        <div class="ds-pod ds-px ds-score-pod"><div class="label">SCORE</div><div class="ds-score-num">0</div></div>
      </div>
      <div class="ds-mascot" title="the scribe">
        <span class="ds-mascot-sprite">
          <img src="${r2.writer}" alt="krill with a fountain pen">
        </span>
        <span class="ds-blub">hm-hm!</span>
      </div>
      <div class="ds-crt"></div>
      <button class="ds-mute" type="button" aria-label="toggle sound"></button>
    </div>`;
        let T2 = e4.querySelector(".ds-stage"), j2 = e4.querySelector(".ds-sea"), L2 = e4.querySelector(".ds-fore"), A2 = j2.getContext("2d"), N2 = L2.getContext("2d"), E2 = e4.querySelector(".ds-world"), I2 = e4.querySelector(".ds-dim"), O2 = e4.querySelector(".ds-edge"), U2 = e4.querySelector(".ds-flash"), V2 = e4.querySelector(".ds-crt"), z2 = e4.querySelector(".ds-mascot"), B2 = z2.querySelector("img"), K2 = (0, _.createGoldSpriteController)(B2, r2.writer, r2.writerGold), J2 = e4.querySelector(".ds-depth-num"), Y2 = e4.querySelector(".ds-score-num"), X2 = e4.querySelector(".ds-dots"), Z2 = e4.querySelector(".ds-prompt-count");
        {
          let a4 = e4.querySelector(".ds-title");
          "KRILLION".split("").forEach((e10, t3) => {
            let l4 = document.createElement("span");
            l4.textContent = e10, l4.style.animationDelay = 0.18 * t3 + "s", a4.appendChild(l4);
          }), e4.querySelector(".ds-tagline").textContent = t2.tagline ?? "THE LEXICON", e4.querySelector(".ds-subline").textContent = t2.subline ?? "rarer answers write deeper";
          for (let e10 = 0; e10 < 7; e10++) X2.appendChild(document.createElement("i"));
        }
        let Q2 = (0, R.getDescentAudio)();
        Q2.acquire(e4);
        let ee2 = e4.querySelector(".ds-mute"), et2 = '<path d="M2 6h3l4-4v12l-4-4H2z"/>', ea2 = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${et2}<rect x="11" y="6" width="2" height="4"/><rect x="15" y="3" width="2" height="10"/></svg>`, el2 = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${et2}<rect x="11" y="5" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/><rect x="15" y="9" width="2" height="2"/><rect x="15" y="5" width="2" height="2"/><rect x="11" y="9" width="2" height="2"/></svg>`, er2 = () => {
          let e10 = Q2.isMuted();
          ee2.innerHTML = e10 ? el2 : ea2, ee2.setAttribute("aria-label", e10 ? "turn sound on" : "turn sound off"), ee2.setAttribute("aria-pressed", e10 ? "true" : "false"), ee2.classList.toggle("off", e10);
        };
        er2();
        let en2 = Q2.subscribeMute(er2), ei2 = () => Q2.toggleMuted();
        ee2.addEventListener("click", ei2);
        let es2 = -1, eo2 = (e10, t3) => {
          let a4 = new Image();
          return a4.onload = () => t3?.(), a4.src = e10, a4;
        }, ed2 = (e10) => !!e10 && e10.complete && e10.naturalWidth > 0, ec2 = eo2(r2.notebook, () => {
          ev2();
        }), eh2 = { s: 1, ox: 0, oy: 0, portrait: false }, eu2 = () => ed2(ec2) ? ec2.naturalWidth : 1536, ef2 = () => ed2(ec2) ? ec2.naturalHeight : 1024, ep2 = (e10) => eh2.ox + e10 * eh2.s, em2 = (e10) => eh2.oy + e10 * eh2.s, eg2 = false;
        function ev2() {
          eg2 = true, u2.invalidate();
        }
        function ey2() {
          eg2 = false, i3 = e4.clientWidth || innerWidth, s3 = e4.clientHeight || innerHeight;
          let t3 = e4.getBoundingClientRect();
          o3 = Math.max(0, Math.round(t3.left)), c3 = Math.max(0, Math.round(t3.top)), d3 = Math.max(0, Math.round(innerWidth - t3.right)), h2 = Math.max(0, Math.round(innerHeight - t3.bottom)), g2 = u2.pixelRatio(i3 + o3 + d3, s3 + c3 + h2), L2.width !== Math.floor(i3 * g2) && (L2.width = i3 * g2), L2.height !== Math.floor(s3 * g2) && (L2.height = s3 * g2), L2.style.width = i3 + "px", L2.style.height = s3 + "px", N2.setTransform(g2, 0, 0, g2, 0, 0), j2.width !== Math.floor((i3 + o3 + d3) * g2) && (j2.width = (i3 + o3 + d3) * g2), j2.height !== Math.floor((s3 + c3 + h2) * g2) && (j2.height = (s3 + c3 + h2) * g2), j2.style.width = i3 + o3 + d3 + "px", j2.style.height = s3 + c3 + h2 + "px", j2.style.left = -o3 + "px", j2.style.top = -c3 + "px", A2.setTransform(g2, 0, 0, g2, o3 * g2, c3 * g2), (function() {
            let e10 = eu2(), t4 = ef2(), a4 = s3 > 1.12 * i3;
            if (a4) {
              let l4 = (P.right - q) * e10, r3 = (P.bottom - P.top) * t4, n4 = Math.min(0.9 * i3 / l4, 0.96 * s3 / r3);
              eh2 = { s: n4, ox: 0.06 * i3 - q * e10 * n4, oy: s3 / 2 - (P.top + (P.bottom - P.top) / 2) * t4 * n4, portrait: a4 };
            } else {
              let l4 = Math.min(0.95 * i3 / e10, 0.94 * s3 / t4);
              eh2 = { s: l4, ox: (i3 - e10 * l4) / 2, oy: (s3 - t4 * l4) / 2, portrait: a4 };
            }
            e5();
          })(), eh2.portrait ? a3 ??= eo2(r2.deskPortrait) : l3 ??= eo2(r2.deskLandscape);
        }
        addEventListener("resize", ev2);
        let ex2 = new ResizeObserver(() => {
          (e4.clientWidth !== i3 || e4.clientHeight !== s3) && ev2();
        });
        ex2.observe(e4);
        let eb2 = (function() {
          if (D.length >= 6) return D;
          let e10 = [];
          for (let t3 = 0; t3 < F; t3++) e10.push(G + t3 * H);
          return e10;
        })(), eM2 = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum".split(" "), ew2 = "function" == typeof getComputedStyle && getComputedStyle(e4).fontFamily || "monospace", ek2 = false, eS = null;
        "u" > typeof document && document.fonts?.ready ? document.fonts.ready.then(() => {
          ek2 = true, ej.clear();
          let e10 = eS;
          eS = null, e10?.();
        }) : ek2 = true;
        let eC = eb2.length, e$ = (e10) => Math.floor(100 * e10 / eC), eR = (e10) => y2(Math.ceil((e10 + 1) * eC / 100) - 1, 0, eC - 1);
        function eT(e10) {
          let t3 = eu2(), a4 = (P.right - q) * t3;
          return { x0: q * t3 + 0.08 * a4, x1: q * t3 + 0.9 * a4, y: eb2[e10] * ef2() };
        }
        let ej = /* @__PURE__ */ new Map();
        function eL(e10, t3) {
          let a4 = eR(t3);
          return (function(e11, t4) {
            let a5 = e11 + ":" + t4, l4 = ej.get(a5);
            if (l4) return l4;
            let r3 = eT(t4), n4 = e$(t4 + 1) - e$(t4), i4 = e$(t4), s4 = (eb2[1] - eb2[0]) * ef2() || 38, o4 = 0.74 * s4, d4 = Array.from({ length: n4 }, (t5, a6) => eM2[(37 * e11 + i4 + a6) % eM2.length]);
            e_();
            let c4 = eE, h3 = (e12) => (c4.font = `${e12}px ${ew2}`, d4.map((e13) => c4.measureText(e13).width)), u3 = h3(o4), f3 = () => u3.reduce((e12, t5) => e12 + t5, 0), p2 = r3.x1 - r3.x0;
            f3() > 0.86 * p2 && (o4 *= 0.86 * p2 / f3(), u3 = h3(o4));
            let m3 = n4 > 1 ? (p2 - f3()) / (n4 - 1) : 0, g3 = [], v3 = r3.x0;
            for (let t5 = 0; t5 < n4; t5++) {
              c4.font = `${o4}px ${ew2}`;
              let a6 = [0];
              for (let e12 = 1; e12 <= d4[t5].length; e12++) a6.push(c4.measureText(d4[t5].slice(0, e12)).width);
              let l5 = (M2(w2 + 131 * e11 + (i4 + t5) * 7.3) - 0.5) * 1.6;
              g3.push({ text: d4[t5], x: v3, y: r3.y - 0.1 * s4 + l5, prefix: a6, fontPx: o4 }), v3 += u3[t5] + m3;
            }
            return ej.set(a5, g3), g3;
          })(e10, a4)[t3 - e$(a4)];
        }
        let eA = document.createElement("canvas"), eN = document.createElement("canvas"), eE = null, eI = null;
        function e_() {
          if (eE && eA.width === eu2() && eA.height === ef2()) return;
          let e10 = null, t3 = null;
          eE && ((e10 = document.createElement("canvas")).width = eA.width, e10.height = eA.height, e10.getContext("2d").drawImage(eA, 0, 0), (t3 = document.createElement("canvas")).width = eN.width, t3.height = eN.height, t3.getContext("2d").drawImage(eN, 0, 0)), eA.width = eN.width = eu2(), eA.height = eN.height = ef2(), eE = eA.getContext("2d"), eI = eN.getContext("2d"), e10 && eE.drawImage(e10, 0, 0, eA.width, eA.height), t3 && eI.drawImage(t3, 0, 0, eN.width, eN.height), ej.clear();
        }
        function eP(e10, t3, a4, l4, r3) {
          e_();
          let n4 = eL(e10, t3), i4 = n4.text.length, s4 = y2(Math.round(a4 * i4), 0, i4), o4 = y2(Math.round(l4 * i4), 0, i4);
          if (o4 <= s4) return;
          let d4 = eE;
          d4.font = `${n4.fontPx}px ${ew2}`, d4.fillStyle = r3, d4.globalAlpha = 0.92, d4.fillText(n4.text.slice(s4, o4), n4.x + n4.prefix[s4], n4.y), d4.globalAlpha = 1;
        }
        function eq(e10) {
          let t3 = y2(Math.floor(e10), 0, 99), a4 = y2(e10 - t3, 0, 1), l4 = eL(eW, t3), r3 = y2(Math.round(a4 * l4.text.length), 0, l4.text.length);
          return { x: l4.x + l4.prefix[r3], y: l4.y };
        }
        function eD(e10, t3) {
          e_();
          let a4 = eE, l4 = eq(Math.max(1e-3, t3 - 0.02)), n4 = (eb2[1] - eb2[0]) * ef2() || 38, i4 = Math.max(2.2, eu2() / 520);
          a4.lineCap = "round";
          let s4 = (e11, t4, r3 = 0.16 * n4) => {
            a4.strokeStyle = t4, a4.lineWidth = i4, a4.globalAlpha = 0.8, a4.beginPath(), a4.moveTo(l4.x - e11, l4.y + r3), a4.quadraticCurveTo(l4.x - e11 / 2, l4.y + r3 + 2.5, l4.x + 6, l4.y + r3), a4.stroke(), a4.globalAlpha = 1;
          }, o4 = (e11) => {
            let t4 = l4.x + 0.42 * n4, r3 = l4.y - 0.5 * n4;
            a4.strokeStyle = e11, a4.lineWidth = 0.9 * i4, a4.globalAlpha = 0.9;
            for (let e12 = 0; e12 < 3; e12++) {
              let l5 = e12 / 3 * Math.PI;
              a4.beginPath(), a4.moveTo(t4 - Math.cos(l5) * n4 * 0.2, r3 - Math.sin(l5) * n4 * 0.2), a4.lineTo(t4 + Math.cos(l5) * n4 * 0.2, r3 + Math.sin(l5) * n4 * 0.2), a4.stroke();
            }
            a4.globalAlpha = 1;
          };
          switch (e10) {
            case "plankton":
              a4.fillStyle = r2.ink, a4.beginPath(), a4.arc(l4.x + 4, l4.y, 0.9 * i4, 0, 7), a4.fill();
              break;
            case "tooclever":
              a4.strokeStyle = r2.ink, a4.lineWidth = i4, a4.globalAlpha = 0.75;
              for (let e11 = 0; e11 < 2; e11++) a4.beginPath(), a4.moveTo(l4.x + 4 + 6 * e11, l4.y + 2), a4.lineTo(l4.x + 10 + 6 * e11, l4.y - 0.34 * n4), a4.stroke();
              a4.globalAlpha = 1;
              break;
            case "schooler":
              s4(1.1 * n4, r2.ink);
              break;
            case "rare":
              s4(1.7 * n4, x2("rare"));
              break;
            case "deepcut":
              s4(1.7 * n4, x2("deepcut")), o4(x2("deepcut"));
              break;
            case "krillion":
              s4(2.4 * n4, b2(), 0.14 * n4), s4(2.1 * n4, b2(), 0.3 * n4), o4(b2());
          }
        }
        function eG(e10) {
          e_();
          let t3 = eE, a4 = eq(Math.max(1e-3, e10)), l4 = (eb2[1] - eb2[0]) * ef2() || 38;
          t3.fillStyle = r2.ink, t3.globalAlpha = 0.85;
          for (let r3 = 0; r3 < 7; r3++) {
            let n4 = M2(w2 + 31 * e10 + r3) * Math.PI * 2, i4 = M2(w2 + 17 * e10 + 3 * r3) * l4 * 0.22;
            t3.beginPath(), t3.arc(a4.x + 8 + Math.cos(n4) * i4, a4.y - 0.2 * l4 + Math.sin(n4) * i4 * 0.7, 1.6 + 3.4 * M2(9.1 * r3), 0, 7), t3.fill();
          }
          t3.strokeStyle = r2.ink, t3.lineWidth = Math.max(2.2, eu2() / 520), t3.globalAlpha = 0.7;
          for (let e11 = 0; e11 < 2; e11++) {
            let r3 = 0 === e11 ? 1 : -1;
            t3.beginPath(), t3.moveTo(a4.x - 2, a4.y - 0.2 * l4 - r3 * l4 * 0.22), t3.lineTo(a4.x + 18, a4.y - 0.2 * l4 + r3 * l4 * 0.22), t3.stroke();
          }
          t3.globalAlpha = 1;
        }
        let eH = "intro", eF = 0, eW = 0, eO = 0, eU = 0, eV = 0, ez = 0, eB = null, eK = null, eJ = false, eY = [], eX = (e10, t3) => eY.push(setTimeout(e10, t3)), eZ = null, eQ = null;
        function e0() {
          Array.from(X2.children).forEach((e10, t3) => {
            e10.className = t3 < eF ? "done" : t3 === eF && "intro" !== eH && eF < 7 ? "cur" : "";
          }), Z2.textContent = "intro" === eH ? n3.surfaceLabel : eF >= 7 ? n3.completeLabel : n3.promptWord + " " + Math.min(eF + 1, 7) + " OF 7", J2.textContent = String(eW + 1);
        }
        function e1(e10, t3) {
          let a4 = eU;
          eU = e10;
          let l4 = t3 ? 1100 : 700, r3 = performance.now(), n4 = (i4) => {
            if (eJ) return;
            let s4 = Math.min((i4 - r3) / l4, 1), o4 = 1 - Math.pow(1 - s4, 4);
            Y2.textContent = String(Math.round(a4 + (e10 - a4) * (t3 && o4 < 0.9 ? 1.06 * o4 : o4))), s4 < 1 ? requestAnimationFrame(n4) : (Y2.textContent = String(e10), t3 && (Y2.classList.add("slam"), setTimeout(() => Y2.classList.remove("slam"), 520)));
          };
          requestAnimationFrame(n4);
        }
        let e22 = null;
        function e5() {
          if (!e22) return;
          let e10 = eu2(), t3 = 0;
          for (let a4 of e22) {
            let l4 = Math.floor((a4.cum - 1e-3) / 100), r3 = a4.cum - 100 * l4;
            if (l4 === eW) {
              let t4 = eT(eR(y2(r3 - 1e-3, 0, 99.999)));
              a4.el.classList.remove("over"), a4.el.style.left = ep2(P.right * e10) - 2 + "px", a4.el.style.top = em2(t4.y) + "px";
            } else a4.el.classList.add("over"), a4.el.style.left = ep2(P.right * e10) - 2 + "px", a4.el.style.top = em2(P.bottom * ef2()) + 8 + 20 * t3 + "px", t3++;
          }
        }
        function e42(e10 = false) {
          if (e22) {
            for (let t3 of e22) if (e10) t3.el.remove();
            else {
              let e11 = t3.el;
              e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
            }
            e22 = null;
          }
        }
        function e32(e10, t3, a4 = 0) {
          eK?.remove();
          let l4 = document.createElement("div");
          return l4.className = "ds-card ds-px", a4 && (l4.style.animationDelay = a4 + "s"), l4.innerHTML = `<div class="rnd">${n3.promptWord} ${e10 + 1} OF 7</div><div class="prompt"></div><div class="hint">${n3.hint}</div>`, l4.querySelector(".prompt").textContent = t3, E2.appendChild(l4), eB = l4, eK = l4, l4;
        }
        function e6(e10) {
          let t3 = document.createElement("div"), a4 = "krillion" === e10.tier ? "var(--tier-krillion-notebook)" : e10.tier ? `var(--tier-${e10.tier})` : "var(--tier-miss-lit)";
          return t3.className = "ds-landed" + (e10.tier ? "" : " miss"), t3.style.setProperty("--tc", a4), t3.innerHTML = (e10.tier ? `<img class="icon" src="${(0, k.seasonalKrillSprite)(`/tiers/${e10.tier}.png`)}" alt="">` : "") + `<div class="tname">${e10.tier ? p.TIERS[e10.tier].name.toUpperCase() : n3.missTitle}</div><div class="tans"></div><div class="tpts"><b>+${e10.points} PTS</b>${e10.points > 0 ? ` &middot; ${n3.driveVerb} ${n3.fmtDist(e10.points)}` : ""}</div><div class="tsub"></div>`, t3.querySelector(".tans").textContent = e10.answerText ? `\u201C${e10.answerText}\u201D` : "\u2014", t3.querySelector(".tsub").textContent = e10.sub, E2.appendChild(t3), t3;
        }
        function e8() {
          T2.classList.remove("ds-shake"), T2.offsetWidth, T2.classList.add("ds-shake");
        }
        function e9() {
          V2.classList.remove("zap"), V2.offsetWidth, V2.classList.add("zap");
        }
        function e7(e10, t3, a4) {
          let l4 = 0, r3 = () => {
            U2.style.transition = "none", U2.style.background = e10, U2.style.opacity = ".42", requestAnimationFrame(() => requestAnimationFrame(() => {
              U2.style.transition = "opacity " + a4 + "ms ease-out", U2.style.opacity = "0";
            })), ++l4 < t3 && eX(r3, 2.1 * a4);
          };
          r3();
        }
        let te = [], tt = [], ta = [];
        function tl(e10, t3, a4 = `rgb(${r2.particle})`) {
          te.length > 220 || te.push({ x: e10 + v2(-3, 3), y: t3 + v2(-3, 3), vx: v2(-26, 26), vy: v2(-60, -10), r: 1.2 + 2 * Math.random(), life: v2(0.4, 0.9), t: 0, color: a4, grav: 220 });
        }
        function tr(e10, t3, a4, l4, r3) {
          for (let n4 = 0; n4 < l4 && te.length < 260; n4++) {
            let l5 = Math.random() * Math.PI * 2, n5 = (30 + 130 * Math.random()) * r3;
            te.push({ x: e10, y: t3, vx: Math.cos(l5) * n5, vy: Math.sin(l5) * n5, r: 1.5 + 2.5 * Math.random(), life: 0.5 + 0.7 * Math.random(), t: 0, color: a4, grav: 140 });
          }
        }
        function tn(e10, t3, a4) {
          for (let l4 = 0; l4 < a4 && te.length < 260; l4++) te.push({ x: e10 + v2(-8, 8), y: t3 + v2(-4, 4), vx: v2(-50, 50), vy: v2(-90, -20), r: 1.6 + 2.2 * Math.random(), life: v2(0.5, 1), t: 0, color: 0.5 > Math.random() ? "#d8a0a0" : "#c4b49a", grav: 320 });
        }
        function ti(e10, t3) {
          te.length > 250 || te.push({ x: e10, y: t3, vx: v2(-24, 24), vy: v2(-40, 6), r: 1.6 + 2.6 * Math.random(), life: 0.5 + 0.7 * Math.random(), t: 0, color: ["#ffd166", "#ffe9a8", "#ff6b3d", "#ffffff"][4 * Math.random() | 0], grav: 60 });
        }
        function ts() {
          let e10 = eu2(), t3 = ef2();
          return { right: { x: q * e10, y: P.top * t3, w: (P.right - q) * e10, h: (P.bottom - P.top) * t3 }, left: { x: P.left * e10, y: P.top * t3, w: (q - P.left) * e10, h: (P.bottom - P.top) * t3 } };
        }
        function to(e10 = 720, t3) {
          e_();
          let { right: a4, left: l4 } = ts(), r3 = document.createElement("canvas");
          r3.width = Math.max(2, Math.round(a4.w)), r3.height = Math.max(2, Math.round(a4.h));
          let n4 = r3.getContext("2d");
          ed2(ec2) && n4.drawImage(ec2, a4.x, a4.y, a4.w, a4.h, 0, 0, r3.width, r3.height), n4.drawImage(eA, a4.x, a4.y, a4.w, a4.h, 0, 0, r3.width, r3.height);
          let i4 = document.createElement("canvas");
          i4.width = r3.width, i4.height = r3.height;
          let s4 = i4.getContext("2d");
          s4.save(), s4.translate(i4.width, 0), s4.scale(-1, 1), ed2(ec2) && s4.drawImage(ec2, l4.x, l4.y, l4.w, l4.h, 0, 0, i4.width, i4.height), s4.globalAlpha = 0.16, s4.drawImage(eA, a4.x, a4.y, a4.w, a4.h, 0, 0, i4.width, i4.height), s4.restore();
          let o4 = document.createElement("canvas");
          o4.width = eN.width, o4.height = eN.height;
          let d4 = o4.getContext("2d");
          d4.save(), d4.translate(q * eu2(), 0), d4.scale(-1, 1), d4.globalAlpha = 0.15, d4.drawImage(eA, a4.x, a4.y, a4.w, a4.h, 0, a4.y, a4.w, a4.h), d4.restore(), eE.clearRect(0, 0, eA.width, eA.height), ej.clear(), eQ = { t0: performance.now(), dur: e10, front: r3, back: i4, pendingGhost: o4, onDone: t3 }, Q2.event("tierline");
        }
        let td = { plankton: { dur: 2600 }, tooclever: { dur: 2700 }, schooler: { dur: 3e3 }, rare: { dur: 3400 }, deepcut: { dur: 4200 }, krillion: { dur: 4800 } }, tc = null;
        function th(e10, t3) {
          B2.classList.remove("celebrate", "faint", "sad", "roll"), B2.offsetWidth, e10 && B2.classList.add(e10), clearTimeout(tc), e10 && t3 && (tc = setTimeout(() => B2.classList.remove(e10), t3));
        }
        let tu = null, tf = 0, tp = false, tm = {}, tg = (e10, t3, a4) => (tm[e10] = (tm[e10] ?? v2(0, t3)) - a4, !(tm[e10] > 0) && (tm[e10] = t3 * v2(0.7, 1.4), true)), tv = 0, ty = 0, tx = 0;
        function tb() {
          let e10 = eq(y2(eZ ? eZ.at - 100 * eW : eO, 0, 99.999));
          return { x: ep2(e10.x), y: em2(e10.y) };
        }
        let tM = (0, $.bindMascotTap)(z2, (t3) => {
          Q2.event("blub"), th("roll", 950);
          let a4 = e4.querySelector(".ds-blub");
          a4.classList.remove("show"), a4.offsetWidth, a4.classList.add("show");
          let l4 = t3.clientX - tw(), r3 = t3.clientY - tk();
          for (let e10 = 0; e10 < 6; e10++) tl(l4 + v2(-14, 20), r3 - 12);
          tr(l4, r3, "#ff6b3d", 8, 0.5);
        }), tw = () => e4.getBoundingClientRect().left, tk = () => e4.getBoundingClientRect().top;
        function tS(e10, t3) {
          if (e_(), !e10) return void eG(eO);
          let a4 = "krillion" === e10 ? b2() : r2.ink, l4 = t3;
          for (; l4 > 0; ) {
            let t4 = Math.min(100 - eO, l4);
            for (let e11 = Math.floor(eO); e11 < eO + t4; e11++) eP(eW, e11, 0, 1, a4);
            eO += t4, l4 -= t4, eO >= 100 - 1e-6 && (l4 <= 0 && eD(e10, 100), (function() {
              let { right: e11 } = ts();
              eI.clearRect(0, 0, eN.width, eN.height), eI.save(), eI.translate(q * eu2(), 0), eI.scale(-1, 1), eI.globalAlpha = 0.15, eI.drawImage(eA, e11.x, e11.y, e11.w, e11.h, 0, e11.y, e11.w, e11.h), eI.restore(), eE.clearRect(0, 0, eA.width, eA.height), ej.clear(), eW++, eO = 0;
            })());
          }
          eO > 1e-3 && eD(e10, eO);
        }
        function tC(e10) {
          for (let t3 of (e_(), eE.clearRect(0, 0, eA.width, eA.height), eI.clearRect(0, 0, eN.width, eN.height), ej.clear(), eW = 0, eO = 0, e10)) tS(t3.tier, t3.points);
        }
        function t$() {
          E2.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e10) => e10.remove()), e22 = null, eB = null, eK = null, tu = null, tf = 0, eZ = null, eQ = null, E2.classList.remove("ds-reveal"), I2.classList.remove("on"), e_();
        }
        function tR(e10) {
          tp = e10, K2.setGold(e10), z2.classList.toggle("gold", e10);
        }
        return ey2(), e0(), u2.start(function(t3, n4, f3) {
          eJ || (m2 !== u2.revision && (m2 = u2.revision, u2.reducedMotion && (tt.length = 0, ta.length = 0, te.length = 0), ev2()), eg2 && ey2(), (function(e10) {
            if (!eZ || eQ) return;
            let t4 = eZ, a4 = Math.min(t4.goal, t4.at + t4.speed * e10), l4 = t4.at;
            for (; l4 < a4 - 1e-6; ) {
              let e11 = 100 * eW, r3 = l4 - e11, n5 = Math.floor(r3 + 1e-6), i4 = Math.min(a4 - e11, n5 + 1);
              if (eP(eW, n5, r3 - n5, i4 - n5, t4.color), l4 = e11 + i4, eO = i4, i4 >= 100 - 1e-6) {
                if (t4.at = l4, eO = 0, l4 >= t4.goal - 1e-6) {
                  let e12 = t4.onDone, a5 = t4.tier;
                  eZ = null, eD(a5, 100), to(720, e12);
                  return;
                }
                to(720);
                return;
              }
            }
            if (t4.at = a4, eO = a4 - 100 * eW, Math.random() < 22 * e10) {
              let e11 = tb(), a5 = "krillion" === t4.tier ? b2() : "deepcut" === t4.tier ? x2("deepcut") : `rgb(${r2.particle})`;
              tl(e11.x, e11.y, a5);
            }
            if (e22) {
              for (let e11 of e22) if (!e11.passed && t4.at > e11.cum - 0.4 && (e11.passed = true, e11.el.classList.add("passed"), Q2.event("tierline"), e11.tier !== t4.tier)) {
                let t5 = e11.el.getBoundingClientRect();
                tr(t5.left - tw(), t5.top - tk(), x2(e11.tier), 6, 0.4);
              }
            }
            if (t4.at >= t4.goal - 1e-6) {
              let e11 = t4.onDone;
              eZ = null, e11();
            }
          })(n4), (function(e10) {
            A2.fillStyle = "#0a0805", A2.fillRect(-o3, -c3, i3 + o3 + d3, s3 + c3 + h2);
            let t4 = eh2.portrait ? ed2(a3) ? a3 : l3 : ed2(l3) ? l3 : a3;
            if (t4 && ed2(t4)) {
              let e11 = t4.naturalWidth, a4 = t4.naturalHeight, l4 = Math.max((i3 + o3 + d3) / e11, (s3 + c3 + h2) / a4);
              A2.drawImage(t4, -o3 + (i3 + o3 + d3 - e11 * l4) / 2, -c3 + (s3 + c3 + h2 - a4 * l4) / 2, e11 * l4, a4 * l4);
            }
            ed2(ec2) && (A2.drawImage(ec2, eh2.ox, eh2.oy, eu2() * eh2.s, ef2() * eh2.s), e_(), eh2.portrait || A2.drawImage(eN, eh2.ox, eh2.oy, eu2() * eh2.s, ef2() * eh2.s), A2.drawImage(eA, eh2.ox, eh2.oy, eu2() * eh2.s, ef2() * eh2.s));
            let r3 = eh2.portrait ? 0.06 * i3 : 0.94 * i3, n5 = 0.05 * s3, u3 = 0.05 + 0.012 * Math.sin(0.7 * e10) + 6e-3 * Math.sin(2.3 * e10), f4 = A2.createRadialGradient(r3, n5, 10, r3, n5, 0.95 * Math.max(i3, s3));
            f4.addColorStop(0, `rgba(255,196,110,${2.2 * u3})`), f4.addColorStop(0.45, `rgba(255,180,95,${u3})`), f4.addColorStop(1, "rgba(20,14,30,0.14)"), A2.fillStyle = f4, A2.fillRect(-o3, -c3, i3 + o3 + d3, s3 + c3 + h2);
          })(f3), (function(e10, t4, a4) {
            N2.clearRect(0, 0, i3, s3), (function(e11) {
              if (!eQ) return;
              let t5 = Math.min(1, (e11 - eQ.t0) / eQ.dur), a5 = (t5 < 0.5 ? 4 * t5 * t5 * t5 : 1 - Math.pow(-2 * t5 + 2, 3) / 2) * Math.PI, l4 = Math.cos(a5), { right: r3 } = ts(), n5 = ep2(r3.x), i4 = em2(r3.y), s4 = r3.w * eh2.s, o4 = r3.h * eh2.s, d4 = Math.sin(a5);
              if (d4 > 0.02) {
                let e12 = 0.5 * s4 * d4, t6 = N2.createLinearGradient(n5 - e12, 0, n5 + e12, 0);
                t6.addColorStop(0, "rgba(20,12,6,0)"), t6.addColorStop(0.5, `rgba(20,12,6,${0.28 * d4})`), t6.addColorStop(1, "rgba(20,12,6,0)"), N2.fillStyle = t6, N2.fillRect(n5 - e12, i4, 2 * e12, o4);
              }
              if (N2.save(), N2.translate(n5, i4), l4 >= 0 ? (N2.scale(Math.max(4e-3, l4), 1), N2.drawImage(eQ.front, 0, 0, s4, o4), N2.fillStyle = `rgba(30,20,10,${0.3 * d4})`) : (N2.scale(Math.min(-4e-3, l4), 1), N2.drawImage(eQ.back, 0, 0, s4, o4), N2.fillStyle = `rgba(30,20,10,${0.22 * d4})`), N2.fillRect(0, 0, s4, o4), N2.restore(), t5 >= 1) {
                let e12 = eQ.onDone;
                eI.clearRect(0, 0, eN.width, eN.height), eI.drawImage(eQ.pendingGhost, 0, 0), eQ = null, eW++, J2.classList.remove("crank"), J2.offsetWidth, J2.classList.add("crank"), e0(), e5(), tr(n5 - 0.1 * s4, i4 + 0.85 * o4, "#cdb890", 5, 0.35), e12?.();
              }
            })(a4);
            if (tt.filter((e11) => "dust" === e11.kind).length < Math.round(14 * u2.particleScale) && tg("dust", 0.6, t4)) {
              let e11 = eh2.portrait ? 0.06 * i3 : 0.94 * i3;
              tt.push({ x: e11 + v2(-(0.2 * i3), 0.2 * i3), y: v2(0, 0.5 * s3), vx: v2(-4, 4), vy: v2(2, 7), t: 0, life: v2(5, 9), ph: v2(0, 9), kind: "dust" });
            }
            eh2.portrait && tt.filter((e11) => "steam" === e11.kind).length < Math.round(5 * u2.particleScale) && tg("steam", 0.7, t4) && tt.push({ x: 0.9 * i3 + v2(-8, 8), y: 0.96 * s3, vx: v2(-3, 1), vy: -v2(14, 24), t: 0, life: v2(2.2, 3.4), ph: v2(0, 9), kind: "steam" }), (function(e11, t5) {
              for (let a5 = tt.length - 1; a5 >= 0; a5--) {
                let l4 = tt[a5];
                if (l4.t += t5, l4.t > l4.life) {
                  tt.splice(a5, 1);
                  continue;
                }
                l4.x += l4.vx * t5 + 3 * Math.sin(0.8 * e11 + l4.ph) * t5, l4.y += l4.vy * t5;
                let r3 = l4.t / l4.life;
                if ("dust" === l4.kind) {
                  let t6 = 0.28 * Math.min(l4.t / 1.4, 1, (l4.life - l4.t) / 1.4) * (0.6 + 0.4 * Math.sin(1.3 * e11 + l4.ph));
                  N2.fillStyle = `rgba(255,224,160,${t6})`, N2.fillRect(l4.x, l4.y, 2, 2);
                } else {
                  let e12 = 0.22 * (1 - r3);
                  N2.strokeStyle = `rgba(232,238,248,${e12})`, N2.lineWidth = 2, N2.beginPath(), N2.moveTo(l4.x + 4 * Math.sin(2.4 * l4.t + l4.ph), l4.y), N2.quadraticCurveTo(l4.x + 6 * Math.sin(2.4 * l4.t + l4.ph + 1), l4.y - 8, l4.x + 4 * Math.sin(2.4 * l4.t + l4.ph + 2), l4.y - 15), N2.stroke();
                }
              }
            })(e10, t4);
            for (let e11 = te.length - 1; e11 >= 0; e11--) {
              let a5 = te[e11];
              if (a5.t += t4, a5.t > a5.life) {
                te.splice(e11, 1);
                continue;
              }
              a5.x += a5.vx * t4, a5.y += a5.vy * t4, a5.vy += a5.grav * t4, N2.globalAlpha = 1 - a5.t / a5.life, N2.fillStyle = a5.color, N2.fillRect(a5.x - a5.r / 2, a5.y - a5.r / 2, a5.r, a5.r);
            }
            N2.globalAlpha = 1;
            for (let a5 = ta.length - 1; a5 >= 0; a5--) {
              let l4 = ta[a5];
              if (l4.t += t4, l4.t > l4.life || l4.y > s3 + 20) {
                ta.splice(a5, 1);
                continue;
              }
              l4.x += l4.vx * t4 + 14 * Math.sin(2.4 * e10 + l4.ph) * t4, l4.y += l4.vy * t4, N2.globalAlpha = Math.min(1, (l4.life - l4.t) * 1.4), N2.save(), N2.translate(l4.x, l4.y), N2.rotate(1.1 * Math.sin(3 * e10 + l4.ph)), N2.fillStyle = l4.color, N2.fillRect(-(1.1 * l4.r), -(0.4 * l4.r), 2.2 * l4.r, 0.8 * l4.r), N2.restore();
            }
            if (N2.globalAlpha = 1, !u2.reducedMotion && tp && Math.random() < 2 * t4) {
              let e11 = tb();
              ti(e11.x + v2(-12, 12), e11.y + v2(-10, 8));
            }
          })(f3, n4, t3), (function(t4, a4) {
            let l4 = tb(), r3 = l4.x, n5 = l4.y;
            ("intro" === eH || "finale" === eH) && (r3 = ep2((q + (P.right - q) * 0.8) * eu2()), n5 = em2(0.56 * ef2())), eQ && (n5 -= 46, r3 += 24);
            let s4 = eZ ? 1.6 * Math.sin(13 * t4) : 3.2 * Math.sin(1.8 * t4), o4 = z2.offsetWidth || 72, d4 = 1 - Math.exp(-(eZ ? 14 : 5.5) * a4);
            if (tv += (r3 - tv) * d4, ty += (n5 - ty) * d4, eK) {
              let t5 = e4.getBoundingClientRect(), a5 = eK.getBoundingClientRect(), l5 = tv - 0.22 * o4, r4 = ty - 0.86 * o4 + s4, n6 = l5 + z2.offsetWidth, i4 = r4 + z2.offsetHeight, d5 = a5.left - t5.left, c5 = a5.right - t5.left, h3 = a5.top - t5.top, u3 = a5.bottom - t5.top;
              n6 > d5 - 32 && l5 < c5 + 32 && i4 > h3 - 32 && r4 < u3 + 32 && (ty += u3 + 32 - r4);
            }
            let c4 = eZ ? 3.4 * Math.sin(15 * t4) : 2 * Math.sin(0.9 * t4);
            tx += (c4 - tx) * (1 - Math.exp(-8 * a4)), z2.style.transform = `translate3d(${tv - 0.22 * o4}px, ${ty - 0.86 * o4 + s4 + 0.3 * tf}px, 0) rotate(${tx}deg)`, tu && (tf = 3 * Math.sin(9 * t4), tu.style.left = y2(tv, 120, i3 - 120) + "px", tu.style.top = Math.max(54, ty - 104) + "px", tu.style.transform = `translate3d(-50%, ${tf}px, 0)`);
          })(f3, n4));
        }, () => !!eZ || !!eQ), { intro() {
          u2.invalidate(), t$(), tR(false), eE.clearRect(0, 0, eA.width, eA.height), eI.clearRect(0, 0, eN.width, eN.height), ej.clear(), eF = 0, eW = 0, eO = 0, eV = 0, ez = 0, eU = 0, Y2.textContent = "0", eH = "intro", te.length = 0, ta.length = 0, e0();
        }, finale() {
          u2.invalidate(), tR(tp), t$(), eH = "finale", to(430, () => eX(() => to(430), 140)), Q2.event("surface"), e0();
        }, descendToRound(e10, t3, a4 = 2200) {
          u2.invalidate(), e42(), E2.classList.remove("ds-reveal"), E2.querySelectorAll(".ds-landed").forEach((e11) => {
            e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
          }), eV = ez, e32(e10, t3, 0.45), eH = "descend", e9(), e0(), eX(() => {
            eH = "round", e0();
          }, a4);
        }, restore(e10, t3, a4) {
          u2.invalidate(), t$(), tR(a4.some((e11) => "krillion" === e11.tier)), eF = a4.length;
          let l4 = a4.reduce((e11, t4) => e11 + t4.points, 0);
          if (ek2) tC(a4);
          else {
            let e11 = a4.slice();
            eW = Math.floor(l4 / 100), eO = l4 % 100, eS = () => tC(e11);
          }
          ez = l4, eV = l4, eU = l4, Y2.textContent = String(l4), e10 < 7 && t3 && e32(e10, t3), eH = "round", e0();
        }, plunge(e10, t3) {
          u2.invalidate(), null !== e10.tier && (function(e11) {
            for (let t4 of (e42(true), e22 = [], p.TIER_IDS)) {
              let a4 = p.TIERS[t4], l4 = document.createElement("div");
              l4.className = "ds-tierline nb-tiermark", l4.style.setProperty("--tc", `var(--tier-${t4})`), l4.innerHTML = `<i class="tick"></i><div class="tag"><img src="${(0, k.seasonalKrillSprite)(`/tiers/${t4}.png`)}" alt="">${a4.name.toUpperCase()} &middot; ${a4.score}</div>`, l4.style.opacity = "0", E2.appendChild(l4);
              let r3 = 90 * e22.length;
              requestAnimationFrame(() => {
                l4.style.transition = "opacity .55s ease-out " + r3 + "ms", l4.style.opacity = "1";
              }), e22.push({ cum: e11 + a4.score, el: l4, tier: t4, passed: false });
            }
            e5();
          })(eV), (function(e11, t4) {
            eH = "plunge", E2.classList.add("ds-reveal");
            let a4 = e11.tier ?? "miss";
            if (eB) {
              let e12 = eB;
              tr(i3 / 2, 0.28 * s3, "#ffd166", 12, 0.6), e12.classList.add("gone"), setTimeout(() => {
                e12.remove(), eK === e12 && (eK = null);
              }, 650), eB = null;
            }
            if (!e11.tier) {
              e8(), e9(), Q2.event("miss"), e7("rgba(80,60,40,.5)", 1, 200), th("sad", 2600), eG(eO);
              let a5 = tb();
              tn(a5.x, a5.y + 8, 10), eX(() => {
                e6(e11), eF++, e1(e11.newScore, false), eH = "landed", e0(), eX(() => E2.classList.remove("ds-reveal"), 900), t4();
              }, 900);
              return;
            }
            let l4 = p.TIERS[e11.tier], n4 = td[e11.tier], o4 = e11.answerText.toUpperCase();
            switch (tu?.remove(), (tu = document.createElement("div")).className = "ds-chip nb-plate-wrap", tu.style.setProperty("--cc", `var(--tier-${e11.tier})`), tu.innerHTML = `<span class="nb-plate">\u201C${o4}\u201D</span>`, E2.appendChild(tu), Q2.event("sink"), a4) {
              case "plankton":
              case "deepcut":
                break;
              case "tooclever":
                e7("rgba(255,159,67,.6)", 2, 130);
                break;
              case "rare":
                e7("rgba(255,82,82,.35)", 1, 220);
                break;
              case "krillion":
                e7("rgba(255,209,102,.45)", 1, 180), tu.classList.add("gold");
            }
            eZ = { goal: eV + l4.score, at: eV, speed: l4.score / (n4.dur / 1e3), color: "krillion" === e11.tier ? b2() : r2.ink, tier: e11.tier, onDone: () => {
              eD(e11.tier, eO > 1e-3 ? eO : 100), (function(e12, t5) {
                eH = "landed";
                let a5 = e12.tier;
                Q2.event("krillion" === a5 ? "krillion" : "plankton" === a5 || "tooclever" === a5 ? "land_small" : "land_big"), tu?.remove(), tu = null, tf = 0;
                let l5 = e6(e12);
                ez = eV + p.TIERS[a5].score, eF++;
                let n5 = tb(), o5 = "krillion" === a5 ? b2() : x2(a5);
                switch (a5) {
                  case "plankton":
                    tr(n5.x, n5.y, o5, 8, 0.4), e1(e12.newScore, false);
                    break;
                  case "tooclever":
                    e7("rgba(255,159,67,.6)", 2, 130), e8(), tr(n5.x, n5.y, o5, 16, 0.7), e1(e12.newScore, false);
                    break;
                  case "schooler":
                    tr(n5.x, n5.y, o5, 20, 0.8), e1(e12.newScore, false);
                    break;
                  case "rare":
                    tr(n5.x, n5.y, o5, 24, 0.9), e8(), e7("rgba(255,82,82,.4)", 1, 240), e1(e12.newScore, false);
                    break;
                  case "deepcut":
                    tr(n5.x, n5.y, o5, 18, 0.7), e1(e12.newScore, false);
                    break;
                  case "krillion":
                    l5.classList.add("perched"), e7("rgba(255,255,255,.5)", 4, 110);
                    let d4 = i3 < 700 ? 50 : 90;
                    for (let e13 = 0; e13 < d4 && ta.length < 180; e13++) ta.push({ x: v2(-20, i3 + 20), y: v2(-(0.25 * s3), 0.1 * s3), vx: v2(-18, 18), vy: v2(60, 150), r: v2(3, 5.5), life: v2(2.6, 4.6), t: 0, ph: v2(0, 9), color: r2.confetti[Math.random() * r2.confetti.length | 0] });
                    for (let e13 = 0; e13 < 14; e13++) eX(() => ti(v2(0.15 * i3, 0.85 * i3), v2(0.15 * s3, 0.6 * s3)), 90 * e13);
                    th("celebrate", 1250), tR(true), e1(e12.newScore, true);
                }
                e0(), e42(), E2.classList.remove("ds-reveal"), t5();
              })(e11, t4);
            } };
          })(e10, t3);
        }, showLanded(e10, t3) {
          u2.invalidate(), eB?.remove(), eB = null, eK = null;
          let a4 = e6(e10);
          if ("krillion" === e10.tier && (tR(true), a4.classList.add("perched")), ez = eV + e10.points, eF++, eU = e10.newScore, Y2.textContent = String(e10.newScore), ek2) tS(e10.tier, e10.points);
          else {
            let t4 = eS;
            eS = () => {
              t4?.(), tS(e10.tier, e10.points);
            };
          }
          eH = "landed", e0(), t3 && requestAnimationFrame(() => t3());
        }, setUrgency(t3) {
          if (e4.style.setProperty("--ds-urgency", t3.toFixed(3)), O2.classList.toggle("danger", t3 > 0.8), t3 > 0.8 && t3 < 1) {
            let e10 = Math.ceil((1 - t3) * 15);
            e10 !== es2 && (es2 = e10, Q2.event("tick"));
          } else es2 = -1;
        }, typeFx(e10, t3) {
          u2.invalidate(), tl(e10, t3 + v2(4, 12)), 0.3 > Math.random() && tl(e10 + v2(-8, 8), t3 + v2(2, 10));
        }, submitFx(t3) {
          u2.invalidate(), e9(), Q2.event("submit");
          let a4 = tw(), l4 = tk();
          for (let e10 = 0; e10 < 12; e10++) tl(t3.left - a4 + v2(0, t3.width), t3.top - l4 + v2(0, t3.height));
          O2.classList.remove("danger"), e4.style.setProperty("--ds-urgency", "0");
        }, rejectFx() {
          u2.invalidate(), e9(), Q2.event("reject"), tn(i3 / 2 + v2(-40, 40), s3 - 130, 8);
        }, destroy() {
          eJ = true, K2.destroy(), u2.destroy(), f2(), removeEventListener("resize", ev2), ex2.disconnect(), tM(), ee2.removeEventListener("click", ei2), en2(), Q2.release(), clearTimeout(tc), eY.forEach((e10) => clearTimeout(e10)), eY = [], e4.innerHTML = "";
        } };
      })(s2.current, c2.current);
      return o2.current = e3, d2.current?.(), () => {
        e3.destroy(), o2.current = null;
      };
    }, []), (0, r.useImperativeHandle)(i2, () => ({ intro: (...e3) => o2.current?.intro(...e3), finale: (...e3) => o2.current?.finale(...e3), descendToRound: (...e3) => o2.current?.descendToRound(...e3), restore: (...e3) => o2.current?.restore(...e3), plunge: (...e3) => o2.current?.plunge(...e3), showLanded: (...e3) => o2.current?.showLanded(...e3), setUrgency: (...e3) => o2.current?.setUrgency(...e3), typeFx: (...e3) => o2.current?.typeFx(...e3), submitFx: (...e3) => o2.current?.submitFx(...e3), rejectFx: (...e3) => o2.current?.rejectFx(...e3), destroy: () => {
    } }), []), (0, t.jsx)(w.default, { phase: e2, disabled: "tour" === e2, children: (0, t.jsxs)("div", { className: "ds-root", "data-phase": e2, "data-world": "notebook", children: [(0, t.jsx)("div", { ref: s2, style: { position: "absolute", inset: 0 } }), n2] }) });
  });
  var U = e.i(48992), V = e.i(12260), z = e.i(17747), B = e.i(98284), K = e.i(52250), J = e.i(9371), Y = e.i(98504), X = e.i(17335), Z = e.i(92347), Q = e.i(72318);
  let ee = /* @__PURE__ */ new Map();
  function et(e2) {
    return `krillion:first-completion:v2:${encodeURIComponent(e2)}`;
  }
  function ea(e2) {
    let t2 = ee.get(e2);
    try {
      let t3 = localStorage.getItem(et(e2));
      if (t3) {
        let a2 = JSON.parse(t3);
        if (a2 && "object" == typeof a2 && "number" == typeof a2.score && Number.isInteger(a2.score) && a2.score >= 0 && a2.score <= 700 && (0, z.isCompletionRunId)(a2.runId) && Array.isArray(a2.receipts) && 7 === a2.receipts.length && a2.receipts.every((e3) => "string" == typeof e3) && "number" == typeof a2.claimedAt && Number.isInteger(a2.claimedAt) && a2.claimedAt > 0 && "boolean" == typeof a2.recorded) {
          let t4 = { ...a2, receipts: [...a2.receipts] };
          return ee.set(e2, t4), t4;
        }
      }
    } catch {
    }
    return t2 ? { ...t2, receipts: [...t2.receipts] } : null;
  }
  function el(e2, t2) {
    let a2 = { ...t2, receipts: [...t2.receipts] };
    ee.set(e2, a2);
    try {
      localStorage.setItem(et(e2), JSON.stringify(a2));
    } catch {
    }
  }
  var er = e.i(444);
  function en({ endpoint: e2, score: a2, populationLabel: l2, version: n2, unlockToken: i2, receipts: s2 = [], runId: o2, recordFirstCompletion: c2 = void 0 !== n2 }) {
    let [h2, u2] = (0, r.useState)(null), f2 = `${e2}\0${a2}\0${n2 ?? ""}\0${o2 ?? ""}\0${i2 ? "unlocked" : "locked"}`, p2 = s2.join("\0");
    return ((0, r.useEffect)(() => {
      let t2 = new AbortController(), l3 = true, r2 = (0, d.getPlayerId)(), s3 = p2 ? p2.split("\0") : [], h3 = `${e2}\0${n2 ?? ""}`, m2 = async (a3, l4, s4, o3) => {
        let d2 = await fetch(e2, { method: "POST", headers: { "Content-Type": "application/json", ...i2 ? { "x-krillion-unlock": i2 } : {} }, ...o3 ? { keepalive: true } : { signal: t2.signal }, body: JSON.stringify({ playerId: r2, score: a3, receipts: l4, ...s4 ? { runId: s4 } : {}, ...void 0 !== n2 ? { version: n2 } : {} }) });
        return { ok: d2.ok, data: d2.ok ? await d2.json() : null };
      }, g2 = (e3) => {
        var t3;
        e3 && "number" == typeof e3.betterThan && Number.isFinite(e3.betterThan) && Array.isArray(t3 = e3.dist) && t3.length > 0 && t3.every((e4) => "number" == typeof e4 && Number.isFinite(e4) && e4 >= 0) && l3 && u2({ requestKey: f2, betterThan: e3.betterThan, dist: e3.dist });
      };
      return (async () => {
        if (c2) {
          let l5 = (function(e4, t4, a3, l6) {
            let r3 = Date.now(), n3 = ea(e4);
            if (n3 && (n3.recorded || n3.claimedAt <= r3 + z.COMPLETION_RECEIPT_FUTURE_SKEW_MS && r3 - n3.claimedAt <= z.COMPLETION_RECEIPT_TTL_MS)) return n3;
            if (!Number.isInteger(t4) || t4 < 0 || t4 > 700 || !(0, z.isCompletionRunId)(a3) || 7 !== l6.length || !l6.every((e5) => "string" == typeof e5 && e5.length > 0)) return null;
            let i3 = { score: t4, runId: a3, receipts: [...l6], claimedAt: r3, recorded: false };
            return el(e4, i3), { ...i3, receipts: [...i3.receipts] };
          })(h3, a2, o2 ?? "", s3);
          if (!l5) return;
          if (!l5.recorded) {
            var e3, t3;
            let r3, n3 = await m2(l5.score, l5.receipts, l5.runId, true);
            if (!n3.ok) return;
            if (e3 = l5.score, t3 = l5.runId, (r3 = ea(h3)) && r3.score === e3 && r3.runId === t3 && !r3.recorded && el(h3, { ...r3, recorded: true }), l5.score === a2) return void g2(n3.data);
          }
        }
        let l4 = await m2(a2, s3, o2, false);
        l4.ok && g2(l4.data);
      })().catch(() => {
      }), () => {
        l3 = false, t2.abort();
      };
    }, [e2, a2, n2, o2, i2, f2, p2, c2]), h2?.requestKey === f2 && h2.dist) ? (0, t.jsx)(er.default, { dist: h2.dist, score: a2, betterThan: h2.betterThan, populationLabel: l2 }) : null;
  }
  let ei = (e2) => e2.trim().toLowerCase();
  function es({ pack: e2 = (0, v.clientPack)("classic"), game: a2, results: n2, onNextDive: i2, onReplay: s2, sparse: o2 = false, isArchive: h2 = false, version: u2, runId: f2 }) {
    let [m2, g2] = (0, r.useState)(false), [b2, M2] = (0, r.useState)(false), [k2, S2] = (0, r.useState)(null), [C2, $2] = (0, r.useState)(null);
    (0, r.useEffect)(() => {
      let t2 = true;
      return c(h2 ? "classic" : e2.id, `${h2 ? "/api/archive" : e2.apiBase}/${a2}/reveal`).then((e3) => e3.ok ? e3.json() : null).then((e3) => {
        t2 && e3?.rounds && S2(new Map(e3.rounds.map((e4) => [ei(e4.text ?? e4.round), e4.answers])));
      }).catch(() => {
      }), () => {
        t2 = false;
      };
    }, [a2, h2, e2.id, e2.apiBase]);
    let R2 = n2.reduce((e3, t2) => e3 + t2.score, 0), T2 = n2.map((e3) => e3.tier ?? "miss"), j2 = (0, d.loadPackUnlockToken)(h2 ? "classic" : e2.id);
    (0, r.useEffect)(() => {
      let e3 = requestAnimationFrame(() => {
        M2("u" > typeof navigator && !!navigator.share);
      });
      return () => cancelAnimationFrame(e3);
    }, []);
    let { shareLink: L2 } = (0, V.usePreferences)(), A2 = () => {
      let t2 = h2 ? (0, X.buildArchiveShareText)(a2, R2, T2) : (0, X.buildUnlimitedShareText)(a2, R2, T2, e2.badge);
      return L2 ? (0, X.withShareLink)(t2, h2 ? `/archive/${a2}` : `${e2.href}?game=${a2}`) : t2;
    }, N2 = async () => {
      (0, x.track)("share_copied", { game: a2, score: R2, pack: e2.id });
      try {
        await navigator.clipboard.writeText(A2()), g2(true), setTimeout(() => g2(false), 2e3);
      } catch {
      }
    }, E2 = async () => {
      (0, x.track)("share_native", { game: a2, score: R2, pack: e2.id });
      try {
        await navigator.share({ text: A2() });
      } catch {
      }
    };
    return (0, t.jsxs)("div", { className: "flex flex-col gap-9 mt-1 pb-12 w-full", children: [(0, t.jsxs)("div", { children: [(0, t.jsxs)("div", { className: "flex items-baseline justify-between", children: [(0, t.jsx)("span", { className: "ds-done-krill", children: "KRILLION" }), (0, t.jsx)("span", { className: "font-mono-ui text-[13px] tracking-[0.14em] text-drift uppercase", children: h2 ? (0, t.jsxs)(t.Fragment, { children: ["\u27F2 Day #", a2, " resurfaced"] }) : e2.ui.doneHeadline(a2) })] }), (0, t.jsxs)("div", { className: "flex items-baseline gap-2 mt-4", children: [(0, t.jsx)("span", { className: "font-display text-[5rem] leading-none text-foam tabular-nums", children: R2 }), (0, t.jsxs)("span", { className: "font-mono-ui text-sm text-drift", children: ["/", p.MAX_DAY_SCORE] }), (0, t.jsx)("span", { className: "font-mono-ui text-sm text-lumen-cyan tabular-nums ml-2", children: e2.ui.dist ? e2.ui.dist(R2) : `-${(10 * R2).toLocaleString("en-US")}${e2.ui.unit}` })] }), (h2 || u2) && (0, t.jsx)(en, { endpoint: `${h2 ? "/api/archive" : e2.apiBase}/${a2}/complete`, score: R2, populationLabel: h2 ? `day #${a2}'s original players` : `players' first runs on ${e2.diveLabel} #${a2}`, version: h2 ? void 0 : u2, unlockToken: j2, receipts: n2.flatMap((e3) => e3.receipt ? [e3.receipt] : []), runId: h2 ? void 0 : f2, recordFirstCompletion: !h2 })] }), (0, t.jsx)(Q.default, { results: n2, title: e2.ui.gaugeTitle, unit: e2.ui.gaugeUnit, sub: e2.ui.gaugeSub, tick: e2.ui.gaugeTick }), (0, t.jsxs)("section", { children: [(0, t.jsx)("p", { className: "fathom mb-1", children: (0, t.jsx)("span", { children: e2.ui.bearingLabel }) }), (0, t.jsx)("ul", { children: p.SCORE_BANDS.map((a3) => {
      let l2 = (0, p.bandFor)(R2) === a3;
      return (0, t.jsxs)("li", { className: "flex items-center gap-3 px-1.5 py-2 border-b last:border-b-0", style: { borderColor: "var(--hairline)" }, children: [(0, t.jsx)(Z.default, { tier: a3.tier, size: 17 }), (0, t.jsx)("span", { className: "font-mono-ui text-[13px] tabular-nums w-[4.5rem] shrink-0", style: { color: p.TIERS[a3.tier].color }, children: a3.range }), (0, t.jsx)("span", { className: `text-[15px] flex-1 min-w-0 ${l2 ? "text-foam" : "text-drift/70"}`, children: e2.ui.bandVerdicts?.[a3.min] ?? a3.verdict })] }, a3.min);
    }) })] }), (0, t.jsxs)("div", { className: "flex gap-3", children: [(0, t.jsx)("button", { onClick: N2, className: "btn-descend flex-1", children: m2 ? "Copied \u2713" : "Copy result" }), b2 && (0, t.jsx)("button", { onClick: E2, className: "btn-quiet", "aria-label": "Share via apps", children: "Share\u2026" })] }), (0, t.jsx)(K.default, {}), (0, t.jsx)(J.default, { placement: h2 ? "archive_results" : "classic" === e2.id ? "unlimited_results" : "pack_results" }), (0, t.jsx)(Y.default, {}), (0, t.jsxs)("section", { children: [(0, t.jsxs)("p", { className: "fathom mb-1", children: [(0, t.jsx)("span", { children: e2.ui.catchLabel }), (0, t.jsx)("span", { className: "fathom-depth", children: "tap a round for every answer" })] }), o2 && (0, t.jsx)("p", { className: "font-mono-ui text-[12px] text-drift/60 tracking-[0.05em] mb-1", children: "played before the log kept answers \xB7 the tiers and score stand" }), (0, t.jsx)("ul", { children: n2.map((a3, l2) => (0, t.jsxs)("li", { className: "py-2.5 border-b last:border-b-0", style: { borderColor: "var(--hairline)" }, children: [(0, t.jsxs)("button", { type: "button", className: "flex items-center gap-3 w-full text-left", onClick: () => $2(C2 === a3.promptId ? null : a3.promptId), "aria-expanded": C2 === a3.promptId, children: [(0, t.jsx)("span", { className: "font-mono-ui text-[12px] text-drift/60 w-3 shrink-0", children: l2 + 1 }), (0, t.jsx)(Z.default, { tier: a3.tier ?? "miss", size: 19 }), (0, t.jsx)("div", { className: "min-w-0 flex-1", children: o2 ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("p", { className: "font-mono-ui text-[12px] truncate uppercase tracking-[0.05em]", style: { color: a3.tier ? p.TIERS[a3.tier].color : "var(--tier-miss)" }, children: a3.tier ? p.TIERS[a3.tier].name : "miss" }), (0, t.jsx)("p", { className: "text-[17px] text-foam truncate", children: a3.promptText })] }) : (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("p", { className: "font-mono-ui text-[12px] text-drift/70 truncate uppercase tracking-[0.05em]", children: a3.promptText }), (0, t.jsx)("p", { className: "text-[17px] text-foam truncate", children: a3.answer ?? (a3.rawAnswer ? `"${a3.rawAnswer}"` : "\u2014") })] }) }), (0, t.jsx)("span", { className: "font-mono-ui text-sm tabular-nums", style: { color: a3.tier ? p.TIERS[a3.tier].color : "var(--tier-miss)" }, children: a3.score }), (0, t.jsx)("span", { className: "font-mono-ui text-[11px] text-drift/50 w-3", children: C2 === a3.promptId ? "\u2212" : "+" })] }), C2 === a3.promptId && (0, t.jsxs)("ul", { className: "mt-2 mb-1 pl-[27px] flex flex-col gap-1 max-h-72 overflow-y-auto pr-1", children: [(k2?.get(ei(a3.promptText)) ?? []).map((e3) => {
      let l3 = null !== a3.answer && e3.answer.toLowerCase() === a3.answer.toLowerCase();
      return (0, t.jsxs)("li", { className: "flex items-start gap-2 px-1.5 py-1", style: l3 ? { background: "rgba(16,29,51,0.5)" } : void 0, children: [(0, t.jsx)("span", { className: "mt-0.5", children: (0, t.jsx)(Z.default, { tier: e3.tier, size: 14 }) }), (0, t.jsxs)("span", { className: "flex-1 min-w-0", children: [(0, t.jsx)("span", { className: "text-[14px] text-foam", children: e3.answer }), l3 && (0, t.jsx)("span", { className: "ml-2 font-mono-ui text-[10px] tracking-[0.14em] uppercase text-lumen-cyan", children: "you" }), e3.quip && (0, t.jsx)("span", { className: "block text-[13px] leading-snug text-drift/70", children: e3.quip })] }), (0, t.jsxs)("span", { className: "font-mono-ui text-[11px] tabular-nums ml-auto shrink-0", style: { color: p.TIERS[e3.tier].color }, children: ["+", e3.score] })] }, e3.answer);
    }), null === k2 && (0, t.jsx)("li", { className: "font-mono-ui text-[12px] text-drift/50", children: e2.ui.revealLoading }), null !== k2 && !k2.has(ei(a3.promptText)) && (0, t.jsx)("li", { className: "font-mono-ui text-[12px] text-drift/50", children: "this dive has been re-charted since you played \u2014 answer sheet lost at sea" })] })] }, a3.promptId)) })] }), (0, t.jsxs)("div", { className: "flex flex-col gap-3", children: [h2 ? (0, t.jsx)("button", { onClick: i2, className: "btn-descend w-full", children: "NEXT DAY \u27F2" }) : 1 === a2 && e2.payUrl && !(0, d.loadPackUnlockToken)(e2.id) ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("a", { href: e2.payUrl, className: "btn-descend w-full text-center", children: e2.lockCta }), (0, t.jsxs)("p", { className: "font-mono-ui text-[12px] text-drift/60 text-center", children: ["one time.", " ", "classic" === e2.id ? "access to unlimited mode." : `access to every ${e2.diveLabel} in the pack.`, " ", "no more ads, anywhere."] }), (0, t.jsx)("a", { href: `/restore?pack=${e2.id}`, className: "font-mono-ui text-[12px] text-drift/60 text-center underline", children: "Already unlocked on another device? Restore it here." })] }) : (0, t.jsx)("button", { onClick: i2, className: "btn-descend w-full", children: e2.ui.next }), (0, t.jsx)("button", { type: "button", onClick: s2, className: "btn-quiet w-full", children: "PLAY THIS ONE AGAIN \u21BB" })] }), (0, t.jsx)(w.ResultsAd, {}), (0, t.jsx)(l.AdPrivacyLocation, {}), !h2 && "classic" !== e2.id && (0, t.jsxs)("nav", { "aria-label": "Leave this themed pack", className: "flex flex-col gap-3", children: [(0, t.jsx)(y.default, { href: "/packs", prefetch: false, className: "btn-quiet inline-block self-start", children: "THEMED PACKS \u2192" }), (0, t.jsx)(y.default, { href: "/", prefetch: false, className: "btn-quiet inline-block self-start", children: "TODAY'S DAILY \u2192" })] })] });
  }
  var eo = e.i(3823), ed = e.i(75413);
  function ec({ pack: e2, lastGame: a2, currentGame: l2, done: n2, onPick: i2, launcherClassName: s2 }) {
    let o2 = (0, r.useRef)(null), [c2, h2] = (0, r.useState)({}), u2 = (0, r.useId)(), f2 = Array.from({ length: a2 }, (e3, t2) => t2 + 1), p2 = e2.diveLabel, m2 = Object.keys(n2).length, g2 = () => o2.current?.close();
    return (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { type: "button", className: `${ed.default.launcher}${s2 ? ` ${s2}` : ""}`, onClick: () => {
      let t2 = o2.current;
      if (!t2 || t2.open) return;
      let a3 = {};
      for (let t3 of f2) {
        let l3 = (0, d.loadPackGame)(e2.id, t3);
        l3 && "intro" !== l3.phase && "done" !== l3.phase && (a3[t3] = l3.roundIndex + 1);
      }
      h2(a3), t2.showModal(), (0, eo.notifyModalChange)();
    }, "aria-haspopup": "dialog", children: e2.ui.pickerLabel ?? "open the dive log \u221E" }), (0, t.jsx)("dialog", { ref: o2, className: ed.default.dialog, "aria-labelledby": u2, onClose: eo.notifyModalChange, onClick: (e3) => {
      e3.target === e3.currentTarget && g2();
    }, children: (0, t.jsxs)("div", { className: ed.default.panel, children: [(0, t.jsxs)("header", { className: ed.default.header, children: [(0, t.jsxs)("div", { children: [(0, t.jsx)("p", { children: "DIVE LOG" }), (0, t.jsx)("h2", { id: u2, children: e2.name })] }), (0, t.jsx)("button", { type: "button", onClick: g2, "aria-label": "Close game history", children: "\xD7" })] }), (0, t.jsxs)("p", { className: `fathom ${ed.default.rule}`, children: [(0, t.jsxs)("span", { children: [m2, "/", a2, " charted"] }), (0, t.jsx)("span", { className: "fathom-depth", children: "replays keep your best" })] }), (0, t.jsx)("div", { className: ed.default.gridScroll, children: (0, t.jsx)("div", { className: ed.default.grid, children: f2.map((e3) => {
      let a3 = n2[e3], r2 = l2 === e3;
      return (0, t.jsxs)("button", { type: "button", className: `${ed.default.tile}${a3 ? ` ${ed.default.done}` : ""}${r2 ? ` ${ed.default.current}` : ""}`, "aria-current": r2 ? "true" : void 0, "aria-label": `${p2} ${e3}${c2[e3] ? `, in progress, round ${c2[e3]}, resume dive` : a3 ? `, finished, best score ${a3.score}` : r2 ? ", current dive" : ", unplayed"}`, onClick: () => {
        g2(), i2(e3);
      }, children: [(0, t.jsx)("span", { className: ed.default.tileNum, children: e3 }), (0, t.jsx)("span", { className: ed.default.tileNote, children: c2[e3] ? "RESUME" : a3 ? a3.score : r2 ? "NOW" : "\xB7\xB7\xB7" })] }, e3);
    }) }) })] }) })] });
  }
  function eh(e2, t2) {
    let [a2, l2] = e2.split("-").map(Number), r2 = new Date(Date.UTC(a2, l2 - 1 + t2, 1));
    return `${r2.getUTCFullYear()}-${String(r2.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  var eu = e.i(50186);
  let ef = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], ep = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }), em = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  function eg(e2) {
    return /* @__PURE__ */ new Date(`${e2}T00:00:00Z`);
  }
  function ev({ lastDay: e2, currentDay: a2, done: l2, onPick: n2, launcherClassName: i2 }) {
    let s2 = (0, r.useRef)(null), [o2, d2] = (0, r.useState)(B.EPOCH_DATE.slice(0, 7)), c2 = e2 > 0 ? (0, B.addDays)(B.EPOCH_DATE, e2 - 1).slice(0, 7) : B.EPOCH_DATE.slice(0, 7), h2 = () => s2.current?.close(), u2 = (function(e3, t2) {
      var a3;
      let l3 = Array((a3 = `${e3}-01`, /* @__PURE__ */ new Date(`${a3}T00:00:00Z`)).getUTCDay()).fill(null);
      for (let a4 = 1; a4 <= (function(e4) {
        let [t3, a5] = e4.split("-").map(Number);
        return new Date(Date.UTC(t3, a5, 0)).getUTCDate();
      })(e3); a4 += 1) {
        let r2 = `${e3}-${String(a4).padStart(2, "0")}`, n3 = (0, B.dayNumberFor)(r2);
        l3.push({ date: r2, dayOfMonth: a4, dayNumber: n3, playable: n3 >= 1 && n3 <= t2 });
      }
      for (; l3.length % 7 != 0; ) l3.push(null);
      return l3;
    })(o2, e2);
    return (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { type: "button", className: `${eu.default.launcher}${i2 ? ` ${i2}` : ""}`, onClick: () => {
      let t2 = s2.current;
      if (!t2 || t2.open) return;
      let l3 = Math.min(Math.max(a2 ?? e2, 1), Math.max(e2, 1));
      d2((0, B.addDays)(B.EPOCH_DATE, l3 - 1).slice(0, 7)), t2.showModal(), (0, eo.notifyModalChange)();
    }, "aria-haspopup": "dialog", children: "choose a different day \u27F2" }), (0, t.jsx)("dialog", { ref: s2, className: eu.default.dialog, "aria-label": "The archive calendar", onClose: eo.notifyModalChange, onClick: (e3) => {
      e3.target === e3.currentTarget && h2();
    }, children: (0, t.jsxs)("div", { className: eu.default.panel, children: [(0, t.jsx)("button", { type: "button", className: eu.default.close, onClick: h2, "aria-label": "Close the archive calendar", children: "\xD7" }), (0, t.jsxs)("div", { className: eu.default.monthNav, children: [(0, t.jsx)("button", { type: "button", onClick: () => d2((e3) => eh(e3, -1)), disabled: o2 <= B.EPOCH_DATE.slice(0, 7), "aria-label": "Previous month", children: "\u2190" }), (0, t.jsx)("h3", { "aria-live": "polite", children: ep.format(eg(`${o2}-01`)) }), (0, t.jsx)("button", { type: "button", onClick: () => d2((e3) => eh(e3, 1)), disabled: o2 >= c2, "aria-label": "Next month", children: "\u2192" })] }), (0, t.jsxs)("div", { className: eu.default.gridScroll, children: [(0, t.jsx)("div", { className: eu.default.weekdays, "aria-hidden": true, children: ef.map((e3) => (0, t.jsx)("span", { children: e3 }, e3)) }), (0, t.jsx)("div", { className: eu.default.grid, children: u2.map((e3, r2) => {
      if (!e3) return (0, t.jsx)("span", { className: eu.default.blank }, `blank-${r2}`);
      if (!e3.playable) return (0, t.jsx)("span", { className: eu.default.unavailable, "aria-hidden": true, children: (0, t.jsx)("span", { children: e3.dayOfMonth }) }, e3.date);
      let i3 = l2[e3.dayNumber], s3 = a2 === e3.dayNumber, o3 = `${em.format(eg(e3.date))}, day ${e3.dayNumber}${i3 ? `, completed, best score ${i3.score}` : ", not completed"}`;
      return (0, t.jsxs)("button", { type: "button", className: `${eu.default.day}${i3 ? ` ${eu.default.done}` : ""}${s3 ? ` ${eu.default.current}` : ""}`, "aria-current": s3 ? "true" : void 0, "aria-label": o3, onClick: () => {
        h2(), n2(e3.dayNumber);
      }, children: [(0, t.jsx)("span", { className: eu.default.date, children: e3.dayOfMonth }), (0, t.jsxs)("span", { className: eu.default.dive, children: ["#", e3.dayNumber] }), (0, t.jsx)("span", { className: eu.default.score, children: i3 ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("span", { className: eu.default.bestPrefix, children: "BEST " }), i3.score] }) : s3 ? "NOW" : "\xB7\xB7\xB7" })] }, e3.date);
    }) })] })] }) })] });
  }
  var ey = e.i(23644), ex = e.i(28631), eb = e.i(93705);
  function eM(e2, t2, a2, l2) {
    return { promptId: e2.id, promptText: e2.text, rawAnswer: t2, answer: null, tier: null, score: 0, ...l2 ? { quip: l2 } : {}, ...a2 ? { receipt: a2 } : {} };
  }
  function ew(e2, t2, a2) {
    let l2 = (e2 ? (0, d.loadArchiveHistory)() : (0, d.loadPackDone)(t2))[a2.game];
    return l2?.results?.length === p.ROUNDS_PER_DAY ? { results: l2.results, sparse: false, version: l2.version } : l2 ? { results: (0, d.sparseDoneResults)(l2, a2.prompts), sparse: true, version: l2.version } : null;
  }
  function ek({ pack: e2 = (0, v.clientPack)("classic"), archive: o2 = false, archiveDay: w2 }) {
    let k2 = (0, n.useSearchParams)().get("game"), [S2, C2] = (0, r.useState)(null), [$2, T2] = (0, r.useState)(null), [j2, L2] = (0, r.useState)(false), [N2, E2] = (0, r.useState)(false), [_2, P2] = (0, r.useState)(0), [q2, D2] = (0, r.useState)(null), [G2, H2] = (0, r.useState)(() => Date.now()), [F2, W2] = (0, r.useState)(""), [K2, J2] = (0, r.useState)(null), [Y2, X2] = (0, r.useState)(null), [Z2, Q2] = (0, r.useState)(0), [ee2, et2] = (0, r.useState)(false), [ea2, el2] = (0, r.useState)(w2 ?? null), er2 = o2 ? "day" : "dive", [en2, ei2] = (0, r.useState)(31), [eo2, ed2] = (0, r.useState)(null), [eh2, eu2] = (0, r.useState)(0), ef2 = (0, r.useRef)(null), ep2 = (0, r.useRef)(false), em2 = (0, r.useRef)(0), eg2 = (0, r.useRef)(null), eS = (0, r.useRef)(null), eC = (0, r.useRef)({ restored: false, round: -1, plunged: 0 }), [e$, eR] = (0, r.useState)(0), eT = (0, r.useCallback)(() => {
      eC.current = { restored: false, round: -1, plunged: 0 }, eR((e3) => e3 + 1);
    }, []), ej = (0, r.useCallback)((t2) => {
      ef2.current = t2, D2(t2), "day" === er2 ? (0, d.saveArchiveGame)(t2) : (0, d.savePackGame)(e2.id, t2);
    }, [er2, e2.id]), eL = (0, r.useRef)(null);
    (0, r.useEffect)(() => {
      if (void 0 !== w2) return;
      let t2 = false;
      return (0, s.waitForAccountHistory)().then(() => {
        if (!t2) {
          let t3;
          el2(o2 ? (0, d.nextUnstartedGame)((0, d.loadArchiveHistory)(), d.loadArchiveGame) : (Number.isInteger(t3 = Number(k2)) && t3 >= 1 ? t3 : null) ?? (0, d.nextUnstartedGame)((0, d.loadPackDone)(e2.id), (t4) => (0, d.loadPackGame)(e2.id, t4)));
        }
      }), () => {
        t2 = true;
      };
    }, [o2, w2, e2.id, k2]), (0, r.useEffect)(() => {
      if (null === ea2) return;
      let t2 = false, a2 = (0, s.waitForAccountHistory)();
      queueMicrotask(() => {
        t2 || (C2(null), D2(null), T2(null), E2(false), W2(""), J2(null), X2(null), ef2.current = null);
      });
      let l2 = "day" === er2;
      return c(l2 ? "classic" : e2.id, `${l2 ? "/api/archive" : e2.apiBase}/${ea2}`).then(async (e3) => {
        if (t2) throw Error("cancelled");
        if (402 === e3.status) throw L2(true), Error("locked");
        if (404 === e3.status && ea2 !== w2) {
          let t3 = await e3.json().catch(() => null);
          throw l2 ? ed2(t3?.lastGame ?? (0, B.dayNumberFor)((0, B.etDateString)()) - 1) : t3?.lastGame && ei2(t3.lastGame), E2(true), Error("exhausted");
        }
        if (!e3.ok) {
          let t3 = await e3.json().catch(() => null);
          throw Error(t3?.error ?? "Couldn't load this dive");
        }
        return e3.json();
      }).then(async (r2) => {
        let n2;
        if (await a2, t2) return;
        L2(false), l2 ? r2.lastGame && ed2(r2.lastGame) : r2.lastGame && ei2(r2.lastGame), eC.current = { restored: false, round: -1, plunged: 0 }, eu2(0), C2(r2);
        let i2 = { game: r2.game, version: r2.version, runId: (0, z.createCompletionRunId)(), roundIndex: 0, phase: "intro", previewEndsAt: null, answerEndsAt: null, results: [] }, s2 = eL.current === r2.game;
        eL.current = null;
        let o3 = l2 ? (0, d.loadArchiveGame)(r2.game) : (0, d.loadPackGame)(e2.id, r2.game), c2 = o3 && (0, z.isCompletionRunId)(o3.runId) && (o3.version ?? "") === (r2.version ?? ""), h2 = s2 ? null : ew(l2, e2.id, r2);
        if ((0, d.isFinishedGame)(o3)) n2 = o3, h2 && h2.results.reduce((e3, t3) => e3 + t3.score, 0) > o3.results.reduce((e3, t3) => e3 + t3.score, 0) && (n2 = { ...i2, phase: "done", roundIndex: p.ROUNDS_PER_DAY - 1, results: h2.results, sparse: h2.sparse, version: h2.version });
        else if (c2 && "intro" !== o3.phase) {
          var u2;
          let e3;
          u2 = Date.now(), "preview" === (e3 = { ...(0, f.resumeDive)(o3, u2), results: [...o3.results] }).phase && null !== e3.previewEndsAt && u2 >= e3.previewEndsAt && (e3.phase = "answering", e3.answerEndsAt = e3.previewEndsAt + g.ANSWER_MS), "answering" === e3.phase && null !== e3.answerEndsAt && u2 >= e3.answerEndsAt && (e3.results.push(eM(r2.prompts[e3.roundIndex], null)), e3.phase = "feedback", e3.answerEndsAt = null), n2 = e3;
        } else {
          let t3 = s2 ? null : ew(l2, e2.id, r2);
          n2 = t3 ? { ...i2, roundIndex: p.ROUNDS_PER_DAY - 1, phase: "done", results: t3.results, sparse: t3.sparse, version: t3.version } : i2;
        }
        ef2.current = n2, D2(n2), H2(Date.now()), W2("answering" === n2.phase ? n2.draft ?? "" : ""), J2("answering" === n2.phase ? n2.correction ?? null : null), X2("answering" === n2.phase ? n2.rejected ?? null : null), "done" !== n2.phase && (l2 ? (0, d.saveArchiveGame)(n2) : (0, d.savePackGame)(e2.id, n2)), (function(e3, t3) {
          let a3, l3, { pathname: r3, search: n3, hash: i3 } = window.location, s3 = (a3 = new URLSearchParams(n3), e3 ? a3.delete("game") : a3.set("game", String(t3)), l3 = a3.toString(), `${e3 ? `/archive/${t3}` : r3}${l3 ? `?${l3}` : ""}${i3}`);
          if (`${r3}${n3}${i3}` !== s3) try {
            window.history.replaceState(null, "", s3);
          } catch {
          }
        })(l2, r2.game);
      }).catch((e3) => !t2 && T2(e3.message)), () => {
        t2 = true;
      };
    }, [ea2, w2, er2, _2, e2.id, e2.apiBase]), (0, r.useEffect)(() => (0, h.subscribePurchases)(() => {
      j2 && P2((e3) => e3 + 1);
    }), [j2]), (0, u.useDiveMenu)({ game: q2, gameRef: ef2, setGame: ej, input: F2, correction: K2, rejected: Y2, submitting: ee2, submittingRef: ep2, setNow: H2, label: `${"day" === er2 ? "Archive" : e2.name} #${q2?.game ?? ""} \xB7 round ${(q2?.roundIndex ?? 0) + 1} of 7` }), (0, r.useEffect)(() => {
      let e3 = () => {
        let e4 = ef2.current?.phase;
        ("intro" === e4 || "done" === e4) && P2((e5) => e5 + 1);
      };
      return window.addEventListener(i.PROGRESS_DOWNLOADED, e3), () => window.removeEventListener(i.PROGRESS_DOWNLOADED, e3);
    }, []);
    let eA = q2?.phase;
    (0, r.useEffect)(() => {
      if (q2?.pausedAt !== void 0 || "preview" !== eA && "answering" !== eA) return;
      let e3 = setInterval(() => H2(Date.now()), 100);
      return () => clearInterval(e3);
    }, [eA, q2?.pausedAt]), (0, r.useEffect)(() => {
      "answering" === eA && eg2.current?.focus();
    }, [eA, q2?.roundIndex]), (0, r.useEffect)(() => {
      if (!ee2) return;
      let e3 = setTimeout(() => {
        ep2.current && (ep2.current = false, et2(false), X2("signal lost. resend"));
      }, 6500);
      return () => clearTimeout(e3);
    }, [ee2]);
    let eN = S2 && q2 ? S2.prompts[q2.roundIndex] : null, eE = (0, r.useCallback)((e3) => {
      let t2 = ef2.current;
      t2 && t2.results.length === t2.roundIndex && (W2(""), J2(null), X2(null), ej({ ...t2, phase: "feedback", draft: "", correction: null, rejected: null, previewEndsAt: null, answerEndsAt: null, results: [...t2.results, e3] }));
    }, [ej]), eI = (0, r.useCallback)(async (t2, a2) => {
      let l2 = ef2.current;
      if (!l2 || void 0 !== l2.pausedAt || "answering" !== l2.phase || !S2 || !eN || ep2.current) return;
      ep2.current = true, em2.current = Date.now(), et2(true), J2(null), X2(null), eg2.current && eS.current?.submitFx(eg2.current.getBoundingClientRect());
      let r2 = new AbortController(), n2 = setTimeout(() => r2.abort(), 5e3);
      try {
        let n3 = await c("day" === er2 ? "classic" : e2.id, `${"day" === er2 ? "/api/archive" : e2.apiBase}/${S2.game}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: r2.signal, body: JSON.stringify({ round: eN.id, answer: t2, previewCorrection: !a2 && (0, V.shouldPreviewAnswerCorrections)(), version: S2.version ?? "", playerId: (0, d.getPlayerId)(), runId: l2.runId }) });
        if (409 === n3.status) {
          "day" === er2 ? (0, d.clearArchiveGame)(S2.game) : (0, d.clearPackGame)(e2.id, S2.game), T2("This dive was updated mid-play. Surfacing to restart it fresh."), el2(null), setTimeout(() => el2(S2.game), 1500);
          return;
        }
        if (!n3.ok) return void (a2 ? eE(eM(eN, t2)) : X2("signal lost. resend"));
        let i2 = await n3.json(), s2 = ef2.current;
        if (!s2 || "answering" !== s2.phase || s2.game !== l2.game || s2.runId !== l2.runId || s2.roundIndex !== l2.roundIndex) return;
        if (i2.correction) {
          W2(i2.correction), J2({ from: t2, to: i2.correction }), eg2.current?.focus();
          return;
        }
        if (i2.accepted && i2.tier) eE({ promptId: eN.id, promptText: eN.text, rawAnswer: t2, answer: i2.answer ?? t2, tier: i2.tier, score: i2.score ?? p.TIERS[i2.tier].score, quip: i2.quip, receipt: i2.receipt });
        else {
          let l3 = ef2.current?.answerEndsAt != null && Date.now() >= ef2.current.answerEndsAt;
          a2 || l3 ? eE(eM(eN, t2, i2.receipt, i2.rejectionReason)) : (X2(i2.rejectionReason ? `${i2.rejectionReason} Try again.` : e2.ui.reject(t2)), (0, V.shouldClearRejectedEntry)() && W2(""), Q2((e3) => e3 + 1), eS.current?.rejectFx());
        }
      } catch {
        a2 ? eE(eM(eN, t2)) : X2("signal lost. resend");
      } finally {
        clearTimeout(n2), ep2.current = false, et2(false);
      }
    }, [S2, eN, eE, er2, e2]);
    (0, r.useEffect)(() => {
      if (q2 && S2 && void 0 === q2.pausedAt) {
        if ("preview" === q2.phase && null !== q2.previewEndsAt && G2 >= q2.previewEndsAt) {
          let e3 = requestAnimationFrame(() => {
            ef2.current?.pausedAt === void 0 && ej({ ...q2, phase: "answering", answerEndsAt: q2.previewEndsAt + g.ANSWER_MS });
          });
          return () => cancelAnimationFrame(e3);
        } else if ("answering" === q2.phase && null !== q2.answerEndsAt && G2 >= q2.answerEndsAt) {
          if (ep2.current) {
            if (G2 >= Math.max(q2.answerEndsAt, em2.current) + 4e3 && eN) {
              let e4 = requestAnimationFrame(() => {
                ep2.current = false, et2(false), eE(eM(eN, F2.trim() || null));
              });
              return () => cancelAnimationFrame(e4);
            }
            return;
          }
          let e3 = requestAnimationFrame(() => {
            if (ef2.current?.pausedAt !== void 0) return;
            let e4 = F2.trim();
            eN && eI(e4, true);
          });
          return () => cancelAnimationFrame(e3);
        }
      }
    }, [G2, q2, S2, F2, eN, eI, eE, ej]);
    let e_ = (0, r.useCallback)((e3) => {
      let t2 = ef2.current;
      t2 && ej({ ...t2, roundIndex: e3, phase: "preview", previewEndsAt: Date.now() + g.PREVIEW_MS, answerEndsAt: null });
    }, [ej]), eP = (0, r.useCallback)(() => {
      let t2 = ef2.current;
      t2 && S2 && (t2.roundIndex >= p.ROUNDS_PER_DAY - 1 ? ((0, x.track)("unlimited_complete", { game: t2.game, mode: er2, pack: e2.id, score: t2.results.reduce((e3, t3) => e3 + t3.score, 0) }), "day" === er2 ? (0, d.recordArchiveDone)(t2.game, t2.results, t2.version) : (0, d.recordPackDone)(e2.id, t2.game, t2.results, t2.version), ej({ ...t2, phase: "done" })) : e_(t2.roundIndex + 1));
    }, [S2, ej, e_, er2, e2.id]);
    (0, r.useEffect)(() => {
      if (!q2 || "feedback" !== q2.phase || 0 === q2.results.length || eh2 < q2.results.length) return;
      let e3 = (e4) => {
        if ("Enter" !== e4.key || e4.repeat || e4.isComposing || e4.altKey || e4.ctrlKey || e4.metaKey || e4.shiftKey) return;
        let t2 = e4.target;
        t2 && (t2.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t2.tagName)) || document.querySelector('dialog[open], [role="dialog"]') || (e4.preventDefault(), q2.roundIndex < p.ROUNDS_PER_DAY - 1 && (0, R.playSfx)("descend"), eP());
      };
      return window.addEventListener("keydown", e3), () => window.removeEventListener("keydown", e3);
    }, [q2, eh2, eP]);
    let eq = (0, r.useCallback)(() => {
      let t2 = ef2.current;
      t2 && ((0, x.track)("unlimited_replay", { game: t2.game, mode: er2, pack: e2.id }), "day" === er2 ? (0, d.clearArchiveGame)(t2.game) : (0, d.clearPackGame)(e2.id, t2.game), eL.current = t2.game, P2((e3) => e3 + 1));
    }, [er2, e2.id]), eD = (0, r.useCallback)(() => {
      if ("day" !== er2) return void el2((0, d.nextUnstartedGame)((0, d.loadPackDone)(e2.id), (t3) => (0, d.loadPackGame)(e2.id, t3)));
      let t2 = (0, d.loadArchiveHistory)(), a2 = (0, d.nextUnstartedGame)(t2, d.loadArchiveGame, (ef2.current?.game ?? 0) + 1);
      if (null !== eo2 && a2 > eo2) {
        let e3 = (0, d.nextUnstartedGame)(t2, d.loadArchiveGame);
        e3 <= eo2 && (a2 = e3);
      }
      el2(a2);
    }, [er2, e2.id, eo2]), eG = (0, r.useCallback)((e3) => {
      e3 !== ef2.current?.game && el2(e3);
    }, []);
    if ((0, r.useEffect)(() => {
      let t2 = eS.current;
      if (!q2 || !S2 || !t2) return;
      let a2 = eC.current, l2 = S2.prompts[q2.roundIndex];
      if ("done" === q2.phase) {
        -2 !== a2.round && (a2.round = -2, a2.restored || t2.restore(p.ROUNDS_PER_DAY - 1, "", q2.results.map((t3) => (0, U.outcomeToRestored)(t3, e2.ui.subCopy))), a2.restored = true, t2.finale());
        return;
      }
      if (!a2.restored) {
        if (a2.restored = true, "intro" === q2.phase) return void t2.intro();
        let r2 = "feedback" === q2.phase ? q2.results.slice(0, -1) : q2.results;
        if (t2.restore(q2.roundIndex, l2?.text ?? "", r2.map((t3) => (0, U.outcomeToRestored)(t3, e2.ui.subCopy))), a2.round = q2.roundIndex, a2.plunged = r2.length, "feedback" === q2.phase && q2.results.length > 0) {
          let l3 = q2.results.reduce((e3, t3) => e3 + t3.score, 0), r3 = q2.results.length;
          t2.showLanded((0, U.outcomeToPlunge)(q2.results[r3 - 1], l3, e2.ui.subCopy), () => eu2((e3) => Math.max(e3, r3))), a2.plunged = r3;
        }
        return;
      }
      if ("intro" === q2.phase && -3 !== a2.round && (a2.round = -3, t2.intro()), "preview" === q2.phase && a2.round !== q2.roundIndex && l2 && (a2.round = q2.roundIndex, t2.descendToRound(q2.roundIndex, l2.text, 2400)), "feedback" === q2.phase && a2.plunged < q2.results.length) {
        let l3 = q2.results.length;
        a2.plunged = l3;
        let r2 = q2.results.reduce((e3, t3) => e3 + t3.score, 0);
        t2.plunge((0, U.outcomeToPlunge)(q2.results[l3 - 1], r2, e2.ui.subCopy), () => eu2((e3) => Math.max(e3, l3)));
      }
    }, [q2, S2, e$, e2.ui.subCopy]), (0, r.useEffect)(() => {
      if (q2) if ("answering" === q2.phase && void 0 === q2.pausedAt && null !== q2.answerEndsAt) {
        let e3 = Math.max(0, q2.answerEndsAt - G2);
        eS.current?.setUrgency(1 - e3 / g.ANSWER_MS);
      } else eS.current?.setUrgency(0);
    }, [G2, q2]), j2) return (0, t.jsxs)("div", { className: "ds-boot", children: [(0, t.jsx)(a.default, { className: "krill", alt: "", width: 64, height: 64 }), (0, t.jsx)("p", { className: "ds-boot-title", children: e2.lockTitle }), e2.payUrl ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("a", { href: e2.payUrl, className: "ds-next-btn", children: e2.lockCta }), (0, t.jsx)("p", { className: "ds-boot-msg", children: "one time. any unlock removes ads across the whole site." })] }) : (0, t.jsx)(y.default, { href: "/", className: "ds-next-btn", children: "\u2190 BACK TO TODAY'S DIVE" }), (0, t.jsx)("a", { href: `/restore?pack=${"day" === er2 ? "classic" : e2.id}`, className: "ds-boot-msg", children: "Already unlocked on another device? Restore it here." })] });
    if (N2) return (0, t.jsxs)("div", { className: "ds-boot", children: [(0, t.jsx)(a.default, { className: "krill", alt: "", width: 64, height: 64 }), (0, t.jsx)("p", { className: "ds-boot-title", children: "day" === er2 ? "no new days" : "no new dives" }), (0, t.jsx)("p", { className: "ds-boot-msg", children: "day" === er2 ? "Every aired day has been started on this device. Open the calendar to resume a day or revisit a finished one. Tomorrow brings another." : "Every charted dive has been started on this device. Open the dive log to resume one or revisit a finished run. Fresh dives drop soon." }), "day" === er2 ? (0, t.jsx)(ev, { lastDay: eo2 ?? (0, B.dayNumberFor)((0, B.etDateString)()) - 1, currentDay: null, done: (0, d.loadArchiveHistory)(), onPick: eG, launcherClassName: "btn-quiet" }) : (0, t.jsx)(ec, { pack: e2, lastGame: en2, currentGame: ea2, done: (0, d.loadPackDone)(e2.id), onPick: eG, launcherClassName: "btn-quiet" }), (0, t.jsx)(y.default, { href: "/", className: "ds-next-btn", children: "\u2190 TODAY'S DIVE" }), (0, t.jsx)("button", { onClick: () => P2((e3) => e3 + 1), className: "ds-boot-msg", children: "day" === er2 ? "check for a fresh day" : "check for fresh dives" })] });
    if ($2) return (0, t.jsxs)("div", { className: "ds-boot", children: [(0, t.jsx)(a.default, { className: "krill", alt: "", width: 64, height: 64 }), (0, t.jsx)("p", { className: "ds-boot-title", children: "no signal" }), (0, t.jsx)("p", { className: "ds-boot-msg", children: $2 }), (0, t.jsx)("button", { onClick: () => window.location.reload(), className: "ds-next-btn", children: "RETRY" })] });
    if (!S2 || !q2) return (0, t.jsxs)("div", { className: "ds-boot", children: [(0, t.jsx)(a.default, { className: "krill", alt: "", width: 64, height: 64 }), (0, t.jsx)("p", { className: "ds-boot-label", children: e2.ui.boot })] });
    let eH = q2.results[q2.results.length - 1], eF = eh2 >= q2.results.length, eW = q2.roundIndex >= p.ROUNDS_PER_DAY - 1, eO = "answering" === q2.phase && null !== q2.answerEndsAt ? Math.max(0, q2.answerEndsAt - G2) : g.ANSWER_MS, eU = "answering" === q2.phase && eO <= 3050, eV = "preview" === q2.phase && null !== q2.previewEndsAt ? Math.max(0, Math.ceil((q2.previewEndsAt - G2) / 1e3)) : 0, ez = (0, t.jsxs)(t.Fragment, { children: [("intro" === q2.phase || "done" === q2.phase) && (0, t.jsx)(ey.default, { restoreHref: "day" === er2 || "classic" === e2.id ? "/restore" : `/restore?pack=${e2.id}` }), ("intro" === q2.phase || "done" === q2.phase) && "notebook" !== e2.theme.world && (0, t.jsx)(ex.default, {}), "done" === q2.phase && (0, t.jsx)("div", { className: "ds-done", children: (0, t.jsx)("div", { className: "ds-done-inner", children: (0, t.jsx)(es, { pack: e2, game: q2.game, results: q2.results, onNextDive: eD, onReplay: eq, sparse: true === q2.sparse, isArchive: "day" === er2, version: q2.version ?? S2.version, runId: q2.runId }) }) }), "intro" === q2.phase && (0, t.jsx)("div", { className: "ds-intro", children: (0, t.jsxs)("div", { className: "ds-intro-inner", children: ["dive" === er2 ? (0, t.jsx)(ec, { pack: e2, lastGame: en2, currentGame: q2.game, done: (0, d.loadPackDone)(e2.id), onPick: eG }) : (0, t.jsx)(ev, { lastDay: eo2 ?? (0, B.dayNumberFor)((0, B.etDateString)()) - 1, currentDay: q2.game, done: (0, d.loadArchiveHistory)(), onPick: eG }), (0, t.jsx)(l.AdPrivacyLocation, {}), (0, t.jsx)("button", { className: "ds-begin-btn", onClick: () => {
      (0, R.playSfx)("begin"), (0, x.track)("unlimited_start", { game: q2.game, mode: er2, pack: e2.id }), e_(0);
    }, children: e2.ui.begin }), (0, t.jsxs)("div", { className: "ds-intro-meta", children: [(0, t.jsx)("span", { children: "day" === er2 ? (0, t.jsxs)(t.Fragment, { children: ["resurfaced day #", q2.game] }) : (0, t.jsxs)(t.Fragment, { children: [e2.diveLabel, " #", q2.game] }) }), (0, t.jsx)("div", { className: "flex items-center gap-[10px]", children: "day" === er2 ? (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)(y.default, { href: "/unlimited/classic", prefetch: false, children: "UNLIMITED \u221E" }), (0, t.jsx)(y.default, { href: "/", prefetch: false, children: "TODAY'S DIVE" })] }) : e2.introLinks.map((e3) => (0, t.jsx)(y.default, { href: e3.href, prefetch: false, children: e3.label }, e3.href)) })] })] }) }), "preview" === q2.phase && (0, t.jsxs)("div", { className: "ds-preview-pill ds-px", children: [e2.ui.previewPrefix, " ", (0, t.jsx)("b", { children: eV })] }), "answering" === q2.phase && (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)(eb.default, { correction: K2 }), Y2 && (0, t.jsx)("div", { className: "ds-reject ds-reject-shake", "aria-live": "polite", children: Y2 }, Z2), (0, t.jsx)("form", { className: "ds-dock" + (eU ? " hot" : ""), onSubmit: (e3) => {
      if (e3.preventDefault(), ef2.current?.pausedAt !== void 0) return;
      let t2 = F2.trim();
      t2 && !ee2 && eI(t2, false);
    }, children: (0, t.jsxs)("div", { className: "ds-dock-inner", children: [(0, t.jsxs)("div", { className: "ds-sonar-wrap", children: [(0, t.jsx)("div", { className: "ds-sonar-scope", children: (0, t.jsx)("div", { className: "ds-sweep" + (eU ? " hot" : "") }) }), (0, t.jsx)("div", { className: "ds-time-digits" + (eU ? " hot" : ""), children: Math.ceil(eO / 1e3) })] }), (0, t.jsxs)("div", { className: "ds-input-col", children: [(0, t.jsx)("input", { ref: eg2, className: "ds-input", value: F2, "aria-describedby": K2 ? "answer-correction" : void 0, onChange: (e3) => {
      if (ep2.current) return;
      W2(e3.target.value), J2(null), X2(null);
      let t2 = eg2.current?.getBoundingClientRect();
      if (t2) {
        let a2 = t2.left + 14 + Math.min(11 * e3.target.value.length, t2.width - 28);
        eS.current?.typeFx(a2, t2.top);
      }
    }, placeholder: "type one answer\u2026", autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false, enterKeyHint: "send", maxLength: m.MAX_ANSWER_LENGTH, "aria-label": "Your answer" }), (0, t.jsx)("div", { className: "ds-fuse", children: (0, t.jsx)("div", { className: "ds-fuse-fill", style: { transform: `scaleX(${eO / g.ANSWER_MS})` } }) })] }), (0, t.jsx)("button", { type: "submit", disabled: !F2.trim() || ee2, className: "ds-dive-btn", onMouseDown: (e3) => e3.preventDefault(), children: ee2 ? "\u2026" : e2.ui.submit })] }) })] }), "feedback" === q2.phase && eH && eF && (0, t.jsx)("div", { className: "ds-next-wrap", children: (0, t.jsx)("button", { className: "ds-next-btn", onClick: () => {
      eW || (0, R.playSfx)("descend"), eP();
    }, children: eW ? e2.ui.surface : e2.ui.descend }) })] }), eB = "day" === er2 ? "THE ARCHIVE" : e2.tagline, eK = "day" === er2 ? "day after day \xB7 rarer answers sink deeper" : e2.subline;
    return "notebook" === e2.theme.world ? (0, t.jsx)(O, { ref: eS, phase: q2.phase, onReady: eT, opts: { tagline: eB, subline: eK, theme: e2.theme }, children: ez }) : "globe" === e2.theme.world ? (0, t.jsx)(I, { ref: eS, phase: q2.phase, onReady: eT, opts: { tagline: eB, subline: eK, theme: e2.theme }, children: ez }) : "gauntlet" === e2.theme.world ? (0, t.jsx)(A, { ref: eS, phase: q2.phase, onReady: eT, opts: { tagline: eB, subline: eK, theme: e2.theme }, children: ez }) : "hollywood" === e2.theme.world ? (0, t.jsx)(M.default, { ref: eS, phase: q2.phase, onReady: eT, opts: { tagline: eB, subline: eK, theme: e2.theme }, children: ez }) : (0, t.jsx)(b.default, { ref: eS, phase: q2.phase, onReady: eT, opts: { tagline: eB, subline: eK, theme: e2.theme }, children: ez });
  }
  e.s(["default", 0, function(e2) {
    return (0, t.jsx)(r.Suspense, { fallback: (0, t.jsx)("div", { className: "ds-boot", children: (0, t.jsx)("p", { className: "ds-boot-label", children: "descending\u2026" }) }), children: (0, t.jsx)(ek, { ...e2 }) });
  }], 36513);
}]);
