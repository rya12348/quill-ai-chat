(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 77372, (e) => {
  "use strict";
  var t = e.i(43476), l = e.i(35406), a = e.i(71645), r = e.i(40806), n = e.i(99363), i = e.i(28551), o = e.i(89910), s = e.i(86062), d = e.i(66732), c = e.i(81801), h = e.i(57410);
  let f = { plankton: "#8fa3c4", tooclever: "#ff9f43", schooler: "#4de3ff", rare: "#ff5252", deepcut: "#9d7bff", krillion: "#ffd166" }, u = (0, a.forwardRef)(function({ phase: e2, opts: u2, onReady: p, children: m }, g) {
    let v = (0, a.useRef)(null), y = (0, a.useRef)(null), M = (0, a.useRef)(p);
    M.current = p;
    let b = (0, a.useRef)(u2);
    return (0, a.useEffect)(() => {
      if (!v.current) return;
      let e3 = (function(e4, t2) {
        let l2 = t2.theme, a2 = l2.copy, u3 = e4.clientWidth || innerWidth, p2 = e4.clientHeight || innerHeight, m2 = 0, g2 = 0, v2 = 0, y2 = 0, M2 = () => -m2, b2 = () => u3 + m2 + g2, x = () => -v2, S = () => p2 + v2 + y2, w = () => 0.7 * p2, L = () => 0.78 * p2, C = () => u3 < 700 ? 8 : 30, $ = (0, i.createWorldRenderer)(e4), R = (0, n.watchSeasonalKrillImages)(e4), T = $.revision, k = $.pixelRatio(u3, p2), q = (e10, t3, l3) => e10 + (t3 - e10) * l3, E = (e10, t3) => e10 + Math.random() * (t3 - e10), P = (e10) => {
          let t3 = 43758.5453 * Math.sin(127.1 * e10 + 3.7);
          return t3 - Math.floor(t3);
        }, A = (e10) => e10 < 0.5 ? 4 * e10 * e10 * e10 : 1 - Math.pow(-2 * e10 + 2, 3) / 2, I = (e10) => 1 - Math.pow(1 - e10, 3);
        e4.innerHTML = `
    <div class="ds-stage">
      <canvas class="ds-sea"></canvas>
      <div class="ds-world">
        <div class="ds-surface">
          <div class="ds-title"></div>
          <div class="ds-tagline"></div>
          <div class="ds-subline"></div>
        </div>
        <img class="dr-gate" src="${l2.gate}" alt="">
        <img class="ds-floor dr-premiere" src="${l2.premiere}" alt="">
      </div>
      <canvas class="ds-fore"></canvas>
      <div class="ds-dim"></div>
      <div class="ds-vignette"></div>
      <div class="ds-edge"></div>
      <div class="ds-flash"></div>
      <div class="ds-hud">
        <div class="ds-pod ds-px"><div class="label">${a2.hudLabel}</div><div class="ds-depth-num">0</div></div>
        <div class="ds-hud-mid"><div class="ds-dots"></div><div class="ds-prompt-count">${a2.surfaceLabel}</div></div>
        <div class="ds-pod ds-px ds-score-pod"><div class="label">SCORE</div><div class="ds-score-num">0</div></div>
      </div>
      <img class="dr-buddy-car" src="${l2.buddyCar}" alt="" aria-hidden>
      <div class="ds-mascot" title="a friend">
        <span class="ds-mascot-sprite">
          <img src="/tiers/krillion.png" alt="krill">
        </span>
        <span class="ds-blub">vroom!</span>
      </div>
      <div class="ds-crt"></div>
      <button class="ds-mute" type="button" aria-label="toggle sound"></button>
    </div>`;
        let W = e4.querySelector(".ds-stage"), H = e4.querySelector(".ds-sea"), F = e4.querySelector(".ds-fore"), G = H.getContext("2d"), N = F.getContext("2d"), B = e4.querySelector(".ds-world"), j = e4.querySelector(".ds-dim"), O = e4.querySelector(".ds-edge"), U = e4.querySelector(".ds-flash"), z = e4.querySelector(".ds-crt"), K = e4.querySelector(".ds-mascot"), D = K.querySelector("img"), X = (0, h.createMascotSpriteController)(D), _ = e4.querySelector(".dr-buddy-car"), V = (0, c.createGoldSpriteController)(_, l2.buddyCar, l2.buddyCarGold), Y = e4.querySelector(".ds-depth-num"), J = e4.querySelector(".ds-score-num"), Q = e4.querySelector(".ds-dots"), Z = e4.querySelector(".ds-prompt-count");
        {
          let l3 = e4.querySelector(".ds-title");
          "KRILLION".split("").forEach((e10, t3) => {
            let a4 = document.createElement("span");
            a4.textContent = e10, a4.style.animationDelay = 0.18 * t3 + "s", l3.appendChild(a4);
          });
          let a3 = e4.querySelector(".ds-surface");
          a3.style.left = "-690px", a3.style.width = "1200px", e4.querySelector(".ds-tagline").textContent = t2.tagline ?? "AT THE MOVIES", e4.querySelector(".ds-subline").textContent = t2.subline ?? "7 scenes \xB7 25 seconds each \xB7 rarer answers drive farther", e4.querySelector(".dr-gate").style.left = "-510px", e4.querySelector(".dr-premiere").style.left = "14020px";
          for (let e10 = 0; e10 < 7; e10++) Q.appendChild(document.createElement("i"));
        }
        let ee = false;
        function et() {
          ee = true, $.invalidate();
        }
        function el() {
          ee = false, u3 = e4.clientWidth || innerWidth, p2 = e4.clientHeight || innerHeight;
          let t3 = e4.getBoundingClientRect();
          m2 = Math.max(0, Math.round(t3.left)), v2 = Math.max(0, Math.round(t3.top)), g2 = Math.max(0, Math.round(innerWidth - t3.right)), y2 = Math.max(0, Math.round(innerHeight - t3.bottom)), k = $.pixelRatio(b2(), S()), F.width !== Math.floor(u3 * k) && (F.width = u3 * k), F.height !== Math.floor(p2 * k) && (F.height = p2 * k), F.style.width = u3 + "px", F.style.height = p2 + "px", N.setTransform(k, 0, 0, k, 0, 0), H.width !== Math.floor(b2() * k) && (H.width = b2() * k), H.height !== Math.floor(S() * k) && (H.height = S() * k), H.style.width = b2() + "px", H.style.height = S() + "px", H.style.left = M2() + "px", H.style.top = x() + "px", G.setTransform(k, 0, 0, k, m2 * k, v2 * k), (function() {
            th.length = tf.length = 0;
            let e10 = u3 * p2 / 304500, t4 = b2() * S() / 304500, l3 = Math.round(36 * $.particleScale * Math.min(t4, 2.4)), a3 = Math.round(12 * $.particleScale * Math.min(e10, 2.4));
            for (let e11 = 0; e11 < l3; e11++) th.push({ x: M2() + Math.random() * b2(), y: x() + Math.random() * S(), par: 0.35 + 0.5 * Math.random(), r: 0.6 + 1.4 * Math.random(), a: 0.07 + 0.14 * Math.random(), ph: 9 * Math.random() });
            for (let e11 = 0; e11 < a3; e11++) tf.push({ x: Math.random() * u3, y: Math.random() * p2, par: 1.15 + 0.45 * Math.random(), r: 1 + 1.8 * Math.random(), a: 0.1 + 0.18 * Math.random(), ph: 9 * Math.random() });
          })();
        }
        addEventListener("resize", et);
        let ea = new ResizeObserver(() => {
          (e4.clientWidth !== u3 || e4.clientHeight !== p2) && et();
        });
        ea.observe(e4);
        let er = (0, d.getDescentAudio)();
        er.acquire(e4);
        let en = e4.querySelector(".ds-mute"), ei = '<path d="M2 6h3l4-4v12l-4-4H2z"/>', eo = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${ei}<rect x="11" y="6" width="2" height="4"/><rect x="15" y="3" width="2" height="10"/></svg>`, es = `<svg viewBox="0 0 20 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${ei}<rect x="11" y="5" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/><rect x="15" y="9" width="2" height="2"/><rect x="15" y="5" width="2" height="2"/><rect x="11" y="9" width="2" height="2"/></svg>`, ed = () => {
          let e10 = er.isMuted();
          en.innerHTML = e10 ? es : eo, en.setAttribute("aria-label", e10 ? "turn sound on" : "turn sound off"), en.setAttribute("aria-pressed", e10 ? "true" : "false"), en.classList.toggle("off", e10);
        };
        ed();
        let ec = er.subscribeMute(ed), eh = () => er.toggleMuted();
        en.addEventListener("click", eh);
        let ef = -1, eu = -45, ep = -45, em = -45, eg = -45, ev = (e10) => {
          eu = ep = em = eg = e10;
        }, ey = (e10) => (e10 - em) * 2 + u3 / 2, eM = [], eb = (e10, t3, l3, a3) => eM.push({ t0: performance.now(), dur: e10, ease: t3, upd: l3, done: a3 }), ex = "intro", eS = 0, ew = 0, eL = 0, eC = 0, e$ = 0, eR = false, eT = null, ek = null, eq = 0, eE = 0, eP = null, eA = false, eI = [], eW = (e10, t3) => eI.push(setTimeout(e10, t3));
        function eH() {
          Array.from(Q.children).forEach((e10, t3) => {
            e10.className = t3 < eS ? "done" : t3 === eS && "intro" !== ex && eS < 7 ? "cur" : "";
          }), Z.textContent = "intro" === ex ? a2.surfaceLabel : "tour" === ex ? a2.tourLabel : eS >= 7 ? a2.completeLabel : a2.promptWord + " " + Math.min(eS + 1, 7) + " OF 7";
        }
        function eF(e10, t3) {
          let l3 = eL;
          eL = e10;
          let a3 = t3 ? 1100 : 700, r2 = performance.now(), n2 = (i2) => {
            if (eA) return;
            let o2 = Math.min((i2 - r2) / a3, 1), s2 = 1 - Math.pow(1 - o2, 4);
            J.textContent = String(Math.round(l3 + (e10 - l3) * (t3 && s2 < 0.9 ? 1.06 * s2 : s2))), o2 < 1 ? requestAnimationFrame(n2) : (J.textContent = String(e10), t3 && (J.classList.add("slam"), setTimeout(() => J.classList.remove("slam"), 520)));
          };
          requestAnimationFrame(n2);
        }
        for (let [e10, t3, a3, r2] of l2.ambient) {
          let l3 = document.createElement("div");
          l3.className = "ds-amb " + a3 + (r2 ? " major" : ""), l3.innerHTML = r2 ? t3 : '<span class="dash">\u2500\u2500</span> ' + t3 + ' <span class="dash">\u2500\u2500</span>', l3.style.left = 2 * e10 + "px", B.appendChild(l3);
        }
        function eG(e10 = false) {
          if (eP) {
            for (let t3 of eP) if (e10) t3.el.remove();
            else {
              let e11 = t3.el;
              e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
            }
            eP = null;
          }
        }
        function eN(e10, t3, l3, r2 = 0) {
          ek?.remove();
          let n2 = document.createElement("div");
          return n2.className = "ds-card ds-px", n2.style.left = 2 * l3 + "px", r2 && (n2.style.animationDelay = r2 + "s"), n2.innerHTML = `<div class="rnd">${a2.promptWord} ${e10 + 1} OF 7</div><div class="prompt"></div><div class="hint">${a2.hint}</div>`, n2.querySelector(".prompt").textContent = t3, B.appendChild(n2), ek = n2, n2;
        }
        function eB(e10, t3) {
          if (e10.tier && eP) for (let t4 of eP) t4.tier === e10.tier && (t4.el.style.transition = "opacity .5s", t4.el.style.opacity = "0");
          let l3 = document.createElement("div"), n2 = e10.tier ? `var(--tier-${e10.tier})` : "var(--tier-miss-lit)";
          return l3.className = "ds-landed" + (e10.tier ? "" : " miss"), l3.style.left = 2 * t3 + "px", l3.style.setProperty("--tc", n2), l3.innerHTML = (e10.tier ? `<img class="icon" src="${(0, r.seasonalKrillSprite)(`/tiers/${e10.tier}.png`)}" alt="">` : "") + `<div class="tname">${e10.tier ? s.TIERS[e10.tier].name.toUpperCase() : a2.missTitle}</div><div class="tans"></div><div class="tpts"><b>+${e10.points} PTS</b>${e10.points > 0 ? ` &middot; ${a2.driveVerb} ${a2.fmtDist(e10.points)}` : ""}</div><div class="tsub"></div>`, l3.querySelector(".tans").textContent = e10.answerText ? `\u201C${e10.answerText}\u201D` : "\u2014", l3.querySelector(".tsub").textContent = e10.sub, B.appendChild(l3), l3;
        }
        function ej() {
          W.classList.remove("ds-shake"), W.offsetWidth, W.classList.add("ds-shake");
        }
        function eO() {
          z.classList.remove("zap"), z.offsetWidth, z.classList.add("zap");
        }
        function eU(e10, t3, l3) {
          let a3 = 0, r2 = () => {
            U.style.transition = "none", U.style.background = e10, U.style.opacity = ".42", requestAnimationFrame(() => requestAnimationFrame(() => {
              U.style.transition = "opacity " + l3 + "ms ease-out", U.style.opacity = "0";
            })), ++a3 < t3 && eW(r2, 2.1 * l3);
          };
          r2();
        }
        function ez(e10, t3, l3) {
          let a3 = l3 || 66;
          j.style.background = `radial-gradient(circle at calc(${e10}px + var(--kr-ad-left, 0px)) calc(${t3}px + var(--kr-ad-top, 0px)), transparent ${a3}px, rgba(4,2,10,.74) ${a3 + 90}px, rgba(4,2,10,.96) ${a3 + 260}px)`;
        }
        let eK = null, eD = null, eX = 0, e_ = null, eV = null, eY = false;
        function eJ(e10) {
          if (eY = true, X.setGold(true), V.setGold(true), K.classList.add("gold"), _.classList.add("gold"), !e10) {
            K.classList.remove("gilding"), K.offsetWidth, K.classList.add("gilding"), eW(() => K.classList.remove("gilding"), 1200), e9(tv, ty, "#ffd166", 16, 0.7);
            for (let e11 = 0; e11 < 12; e11++) te(tv + E(-18, 18), ty + E(-18, 18));
          }
        }
        function eQ() {
          eY = false, X.setGold(false), V.setGold(false), K.classList.remove("gold", "gilding"), _.classList.remove("gold");
        }
        function eZ() {
          eV = null, K.classList.remove("perched");
        }
        let e0 = { plankton: { dur: 3400, ease: (e10) => -(Math.cos(Math.PI * e10) - 1) / 2 }, tooclever: { dur: 3e3, ease: A }, schooler: { dur: 3e3, ease: A }, rare: { dur: 3400, ease: A }, deepcut: { dur: 4300, ease: A }, krillion: { dur: 4600, ease: A } }, e1 = null;
        function e22(e10, t3) {
          D.classList.remove("celebrate", "faint", "sad", "roll", "punch"), D.offsetWidth, e10 && D.classList.add(e10), clearTimeout(e1), e10 && t3 && (e1 = setTimeout(() => D.classList.remove(e10), t3));
        }
        let e5 = [], e42 = [], e32 = [], e6 = (e10) => em + (e10 - u3 / 2) / 2;
        function e8(e10, t3, a3, r2) {
          e5.length > 90 || e5.push({ x: e6(e10 + E(-3, 3)), y: t3, vy: 14 + 18 * Math.random(), wob: 9 * Math.random(), life: 4, col: r2 || l2.particle, r: a3 });
        }
        function e7(e10, t3) {
          e32.length > 30 || e32.push({ x: e6(e10), y: t3, vx: E(-14, -4) / 2, vy: E(-16, -6), r: E(4, 9), life: E(0.8, 1.5), t: 0 });
        }
        function e9(e10, t3, l3, a3, r2) {
          let n2 = e6(e10);
          for (let e11 = 0; e11 < a3 && e42.length < 260; e11++) {
            let e12 = Math.random() * Math.PI * 2, a4 = (30 + 130 * Math.random()) * r2;
            e42.push({ x: n2, y: t3, vx: Math.cos(e12) * a4 / 2, vy: Math.sin(e12) * a4, r: 1.5 + 2.5 * Math.random(), life: 0.6 + 0.8 * Math.random(), t: 0, color: l3 });
          }
        }
        function te(e10, t3) {
          e42.length > 250 || e42.push({ x: e6(e10), y: t3, vx: E(-24, 24) / 2, vy: E(-20, 8), r: 1.6 + 2.6 * Math.random(), life: 0.5 + 0.7 * Math.random(), t: 0, color: ["#ffd166", "#ffe9a8", "#ff5d8f", "#ffffff"][4 * Math.random() | 0] });
        }
        function tt(e10, t3, l3) {
          let a3 = e6(e10);
          for (let e11 = 0; e11 < l3 && e32.length < 30; e11++) e32.push({ x: a3, y: t3, vx: E(-40, -6) / 2, vy: E(-26, -4), r: E(10, 30), life: E(1, 2), t: 0 });
        }
        let tl = (e10) => {
          let t3 = new Image();
          return t3.src = e10, t3;
        }, ta = tl(l2.hills), tr = tl(l2.moon), tn = tl(l2.sign), ti = tl(l2.far), to = l2.mid.map((e10) => ({ from: e10.from, imgs: e10.imgs.map(tl) })), ts = tl(l2.lamp), td = (e10) => !!e10 && e10.complete && e10.naturalWidth > 0, tc = [];
        for (let e10 = 0; e10 < 60; e10++) tc.push({ fx: Math.random(), fy: 0.55 * Math.random(), r: 0.85 > Math.random() ? 2 : 3, a: 0.2 + 0.38 * Math.random(), ph: 9 * Math.random(), warm: 0.3 > Math.random() });
        let th = [], tf = [];
        function tu(e10, t3, l3, a3, r2, n2 = false) {
          let i2 = Array.isArray(e10) ? e10.filter((e11) => e11.complete && e11.naturalWidth) : [e10], o2 = i2[0];
          if (!o2?.complete || !o2.naturalWidth) return;
          let s2 = a3 * o2.naturalWidth / o2.naturalHeight, d2 = 2 * em * t3;
          G.save(), G.globalAlpha = r2;
          let c2 = Math.floor((d2 + M2()) / s2) - 1, h2 = Math.floor((d2 + M2() + b2()) / s2) + 1;
          for (let e11 = c2; e11 <= h2; e11++) {
            let t4 = e11 * s2 - d2, r3 = 1 === i2.length ? o2 : i2[P(7.3 * e11) * i2.length | 0];
            G.save(), n2 && e11 % 2 != 0 && (G.translate(t4 + s2 / 2, 0), G.scale(-1, 1), G.translate(-(t4 + s2 / 2), 0)), G.drawImage(r3, t4, l3 - a3, s2 + 1, a3), G.restore();
          }
          G.restore();
        }
        let tp = null, tm = "", tg = (e10, t3) => P(e10 + 7919 * t3), tv = -120, ty = 300, tM = 0, tb = 0, tx = 0, tS = -60, tw = 0, tL = 0, tC = NaN, t$ = NaN, tR = (0, o.bindMascotTap)(K, () => {
          er.event("blub");
          let t3 = X.current();
          e22("mantis-shrimp" === t3.id ? t3.poke : "roll", "mantis-shrimp" === t3.id ? t3.pokeMs : 950);
          let l3 = e4.querySelector(".ds-blub");
          l3.classList.remove("show"), l3.offsetWidth, l3.classList.add("show");
          for (let e10 = 0; e10 < 6; e10++) e8(tv + E(-16, 26), ty - 16, 1 + 3 * Math.random());
          e9(tv, ty, "#ff5d8f", 10, 0.5), e9(tv, ty - 14, "#ffd166", 8, 0.45);
        }), tT = 0, tk = (t3) => {
          let a3 = performance.now();
          !$.reducedMotion && em > 550 && a3 - tT > 50 && e42.length < 250 && (tT = a3, $.invalidate(), e42.push({ x: e6(t3.clientX - e4.getBoundingClientRect().left + E(-6, 6)), y: t3.clientY - e4.getBoundingClientRect().top + E(-4, 4), vx: E(-14, 14) / 2, vy: E(-10, 10), r: 1.6, life: 0.9, t: 0, color: l2.sparkle }));
        };
        return e4.addEventListener("pointermove", tk), el(), ev(-45), eH(), $.start(function(t3, a3, r2) {
          if (eA) return;
          T !== $.revision && (T = $.revision, et()), ee && el();
          for (let e10 = eM.length - 1; e10 >= 0; e10--) {
            let l3 = eM[e10], a4 = (t3 - l3.t0) / l3.dur;
            a4 >= 1 ? (l3.upd(l3.ease(1)), eM.splice(e10, 1), l3.done?.()) : l3.upd(l3.ease(Math.max(0, a4)));
          }
          ep += (eu - ep) * (1 - Math.exp(("plunge" === ex ? -11 : -6) * a3)), eg = em, em = ep + ($.reducedMotion ? 0 : 1.4 * Math.sin(0.45 * r2)), B.style.transform = `translate3d(${u3 / 2 - 2 * em}px,0,0)`;
          let n2 = String(Math.floor(Math.max(0, ew) / 100));
          Y.textContent !== n2 && (Y.textContent = n2), e4.querySelector(".ds-vignette").style.opacity = Math.min(0.72, 0.25 + Math.max(0, em) / 2400).toFixed(3), (function(e10, t4) {
            let a4 = G.createLinearGradient(0, 0, 0, 0.58 * p2);
            a4.addColorStop(0, l2.skyTint[0]), a4.addColorStop(0.55, l2.skyTint[1]), a4.addColorStop(1, l2.skyTint[2]), G.fillStyle = a4, G.fillRect(M2(), x(), b2(), 0.58 * p2 + 6 - x()), G.fillStyle = l2.skyTint[0], G.fillRect(M2(), 0.58 * p2, b2(), p2 + y2 - 0.58 * p2), (function(e11) {
              let t5 = 0.58 * p2;
              for (let l3 of tc) {
                let a5 = l3.a * (0.72 + 0.28 * Math.sin(1.6 * e11 + l3.ph));
                G.fillStyle = l3.warm ? `rgba(255,228,188,${a5})` : `rgba(180,220,255,${a5})`, G.fillRect(M2() + l3.fx * b2(), x() + l3.fy * (t5 - x()), l3.r, l3.r);
              }
              if (tr.complete && tr.naturalWidth) {
                let e12 = Math.min(0.22 * u3, 150);
                G.drawImage(tr, 0.76 * u3, 0.08 * t5, e12, e12);
              }
              if (td(ta)) {
                let e12 = 0.3 * p2, l3 = t5 - 0.1 * p2;
                if (tu(ta, 0.1, l3, e12, 1, true), G.fillStyle = "#02072c", G.fillRect(M2(), l3 - 1, b2(), t5 - l3 + 8), td(tn)) {
                  let t6 = Math.min(0.28 * u3, 320), a5 = t6 * tn.naturalHeight / tn.naturalWidth, r4 = u3 + 1.5 * t6, n4 = 2 * em * 0.1, i3 = 0.72 * u3 - 9, o3 = l3 - 0.28 * e12 - a5, s3 = Math.floor((n4 - i3 + M2() - t6) / r4);
                  for (let e13 = s3; e13 * r4 + i3 - n4 < M2() + b2() + t6; e13++) G.drawImage(tn, e13 * r4 + i3 - n4, o3, t6, a5);
                }
              }
            })(e10), (function(e11) {
              let t5 = [[0.18 * u3, 0.58 * p2 + 6], [0.78 * u3, 0.58 * p2 + 6]];
              G.save(), G.globalCompositeOperation = "lighter";
              for (let l3 = 0; l3 < t5.length; l3++) {
                let [a5, r4] = t5[l3], n4 = -Math.PI / 2 + 0.42 * Math.sin(0.22 * e11 + 2.1 * l3), i3 = 0.62 * p2, o3 = a5 + Math.cos(n4) * i3, s3 = r4 + Math.sin(n4) * i3, d2 = G.createLinearGradient(a5, r4, o3, s3);
                d2.addColorStop(0, "rgba(255,240,214,0.1)"), d2.addColorStop(1, "rgba(255,240,214,0)"), G.fillStyle = d2, G.beginPath(), G.moveTo(a5, r4), G.lineTo(o3 + 26, s3), G.lineTo(o3 - 26, s3), G.closePath(), G.fill();
              }
              G.restore();
            })(e10), tu(ti, 0.35, 0.58 * p2 + 3, 0.4 * p2, 0.55, true), (function(e11, t5) {
              let l3 = to.flatMap((e12) => e12.imgs).filter(td);
              if (!l3.length) return;
              let a5 = (e12) => t5 * e12.naturalWidth / e12.naturalHeight, r4 = l3.reduce((e12, t6) => e12 + a5(t6), 0) / l3.length, n4 = 2 * em * 0.75, i3 = n4 + M2(), o3 = n4 + M2() + b2();
              for (let l4 of (G.save(), G.globalAlpha = 1, [1, -1])) {
                let s3 = 0, d2 = -1, c2 = 0;
                for (let h2 = 0; h2 < 400 && (1 === l4 ? !(s3 > o3) : !(s3 < i3)); h2++) {
                  let h3 = (s3 - u3 / 2) / 1.5, f2 = 0;
                  for (let e12 = 0; e12 < to.length; e12++) h3 >= to[e12].from && (f2 = e12);
                  f2 !== d2 && (d2 = f2, c2 = 0);
                  let p3 = to[f2].imgs, m3 = p3[1 === l4 ? c2 % p3.length : p3.length - 1 - c2 % p3.length];
                  c2++;
                  let g3 = td(m3) ? a5(m3) : r4, v3 = 1 === l4 ? s3 : s3 - g3;
                  v3 + g3 > i3 && v3 < o3 && td(m3) && G.drawImage(m3, v3 - n4, e11 - t5, g3 + 1, t5), s3 += l4 * g3;
                }
              }
              G.restore();
            })(0.58 * p2 + 9, 0.44 * p2);
            let r3 = 0.58 * p2, n3 = w(), i2 = (function() {
              let e11 = u3 + "x" + p2 + "+" + y2 + "@" + k;
              if (tp && tm === e11) return tp;
              let t5 = Math.round(0.58 * p2), l3 = Math.round(w()), a5 = l3 - t5, r4 = p2 - l3, n4 = r4 + y2, i3 = document.createElement("canvas");
              i3.width = 1400 * k, i3.height = (a5 + n4) * k;
              let o3 = i3.getContext("2d");
              o3.setTransform(k, 0, 0, k, 0, 0);
              let s3 = (e12, t6, l4, a6, r5) => {
                o3.fillStyle = r5, o3.fillRect(e12, t6, l4, a6);
              }, d2 = [];
              for (let e12 = 0; e12 <= 14; e12++) d2.push(100 * e12 + Math.round((P(2.3 * e12 + 1) - 0.5) * 36));
              let c2 = ["#2a2043", "#2d2347", "#281f40", "#2b2145", "#2e2449"];
              for (let e12 = 0; e12 < d2.length - 1; e12++) {
                let t6 = d2[e12];
                s3(t6, 0, d2[e12 + 1] - t6, a5, c2[Math.floor(P(5.9 * e12 + 2) * c2.length)]);
              }
              for (let e12 = 0; e12 < a5; e12++) for (let t6 = 0; t6 < 1400; t6++) {
                let l4 = tg(t6, e12);
                l4 < 0.05 ? s3(t6, e12, 1, 1, "#362b52") : l4 < 0.08 ? s3(t6, e12, 1, 1, "#1f1836") : l4 < 0.088 && s3(t6, e12, 1, 1, "#463a68");
              }
              for (let e12 = 0; e12 < d2.length - 1; e12++) {
                let t6 = d2[e12], l4 = d2[e12 + 1], r5 = P(3.1 * e12);
                if (s3(t6, 0, 1, a5, "#170f2b"), s3(t6 + 1, 0, 1, a5, "#3b2f58"), r5 > 0.8) {
                  let r6 = Math.floor(P(7.7 * e12) * a5 * 0.6) + 4;
                  for (let e13 = t6 + 6; e13 < l4 - 6; e13 += 3) s3(e13, r6 + Math.round(1.5 * Math.sin(0.4 * e13)), 3, 1, "#1c1533");
                }
                if (r5 < 0.14) continue;
                let n5 = Math.round((t6 + l4) / 2 + (P(1.7 * e12 + 4) - 0.5) * 16), i4 = Math.round(0.64 * a5), c3 = Math.min(10, 0.15 * a5);
                (function(e13, t7, l5, a6, r6) {
                  e13.save(), e13.translate(t7, l5), e13.scale(1, 0.52), e13.beginPath();
                  for (let t8 = 0; t8 < 5; t8++) {
                    let l6 = -Math.PI / 2 + 2 * t8 * Math.PI / 5, r7 = l6 + Math.PI / 5;
                    0 === t8 ? e13.moveTo(Math.cos(l6) * a6, Math.sin(l6) * a6) : e13.lineTo(Math.cos(l6) * a6, Math.sin(l6) * a6), e13.lineTo(Math.cos(r7) * a6 * 0.44, Math.sin(r7) * a6 * 0.44);
                  }
                  e13.closePath(), e13.fillStyle = `rgba(255,150,160,${r6})`, e13.fill(), e13.strokeStyle = `rgba(255,205,140,${2.2 * r6})`, e13.lineWidth = 1, e13.stroke(), e13.restore();
                })(o3, n5, i4, c3, 0.2 + 0.06 * r5), s3(n5 - 8, i4 + Math.round(0.6 * c3), 16, 2, "#5e4c27"), s3(n5 - 7, i4 + Math.round(0.6 * c3), 14, 1, "#8a733d");
              }
              for (let e12 = 0; e12 < 70; e12++) s3(Math.floor(1400 * P(9.1 * e12)), Math.floor(P(5.3 * e12 + 1) * (a5 - 3)), 2 + Math.floor(7 * P(2.7 * e12)), 1 + Math.floor(2 * P(4.1 * e12)), "rgba(8,5,18,0.35)");
              let h2 = (e12, t6) => {
                s3(t6 - 1, 17, 4 === e12 ? 16 : 10, 1, "rgba(0,0,0,0.45)"), 0 === e12 ? (s3(t6 + 2, 3, 2, 1, "#d04a58"), s3(t6 + 1, 4, 4, 2, "#d04a58"), s3(t6 + 1, 6, 4, 11, "#b3323f"), s3(t6, 8, 6, 2, "#8c2431"), s3(t6 + 2, 6, 1, 9, "#d86470")) : 1 === e12 ? (s3(t6 - 1, 5, 9, 2, "#3f4c5e"), s3(t6, 7, 7, 10, "#2f3a4a"), s3(t6 + 1, 8, 1, 8, "#1e2632"), s3(t6 + 4, 8, 1, 8, "#1e2632"), s3(t6 + 6, 7, 1, 10, "#3a4759")) : 2 === e12 ? (s3(t6, 5, 8, 12, "#2a5b8f"), s3(t6 + 1, 6, 6, 4, "#c9d9f5"), s3(t6 + 2, 7, 4, 1, "#7f93b8"), s3(t6, 16, 8, 1, "#132a45"), s3(t6 + 7, 5, 1, 12, "#1c4470")) : 3 === e12 ? (s3(t6 + 2, 7, 2, 10, "#5a5a6a"), s3(t6 + 1, 3, 4, 5, "#8a8a9a"), s3(t6 + 2, 4, 2, 2, "#ffd166")) : (s3(t6, 11, 14, 6, "#4a3a2a"), s3(t6, 11, 14, 1, "#6a5438"), s3(t6 + 2, 6, 10, 6, "#173a2a"), s3(t6 + 3, 4, 8, 3, "#1f4a34"), s3(t6 + 5, 3, 4, 2, "#27573d"));
              };
              for (let e12 = 0; e12 < 5; e12++) h2(Math.floor(5 * P(8.3 * e12 + 5)), 60 + 280 * e12 + Math.floor(160 * P(6.7 * e12)));
              let f2 = o3.createLinearGradient(0, 0, 0, 0.22 * a5);
              f2.addColorStop(0, "rgba(5,3,11,0.42)"), f2.addColorStop(1, "rgba(5,3,11,0)"), o3.fillStyle = f2, o3.fillRect(0, 0, 1400, 0.22 * a5), s3(0, a5 - 6, 1400, 1, "#7a6a94"), s3(0, a5 - 5, 1400, 2, "#574868"), s3(0, a5 - 3, 1400, 3, "#1a1230");
              for (let e12 = 0; e12 < 1400; e12 += 100) s3(e12, a5 - 6, 1, 6, "#120c22");
              s3(0, a5, 1400, 2, "#050310"), s3(0, a5 + 2, 1400, 1, "rgba(206,220,255,0.09)");
              let m3 = o3.createLinearGradient(0, a5, 0, a5 + r4);
              m3.addColorStop(0, "#1a1426"), m3.addColorStop(0.55, "#100b1b"), m3.addColorStop(1, "#080611"), o3.fillStyle = m3, o3.fillRect(0, a5 + 3, 1400, n4 - 3);
              for (let e12 = a5 + 3; e12 < a5 + n4; e12++) for (let t6 = 0; t6 < 1400; t6++) {
                let l4 = tg(t6 + 31, e12);
                l4 < 0.045 ? s3(t6, e12, 1, 1, "rgba(60,48,80,0.35)") : l4 < 0.085 && s3(t6, e12, 1, 1, "rgba(3,2,8,0.5)");
              }
              for (let e12 = 0; e12 < 7; e12++) {
                let t6 = 40 + Math.floor(110 * P(7.7 * e12)), l4 = 5 + Math.floor(8 * P(3.3 * e12)), n5 = Math.floor(P(11.3 * e12 + 2) * (1400 - t6)), i4 = a5 + 8 + Math.floor(P(6.1 * e12 + 3) * (r4 - 24));
                s3(n5, i4, t6, l4, "rgba(20,14,32,0.8)"), s3(n5, i4, t6, 1, "rgba(50,40,70,0.45)");
              }
              for (let e12 of [180, 880]) {
                s3(e12, a5 + 1, 34, 5, "#04030a");
                for (let t6 = 0; t6 < 5; t6++) s3(e12 + 4 + 6 * t6, a5 + 2, 3, 3, "#181026");
              }
              {
                let e12 = Math.round(a5 + 0.5 * r4);
                o3.save(), o3.translate(700, e12), o3.scale(1, 0.34), o3.fillStyle = "#2b2242", o3.beginPath(), o3.arc(0, 0, 18, 0, 7), o3.fill(), o3.fillStyle = "#0f0b19", o3.beginPath(), o3.arc(0, 2, 16, 0, 7), o3.fill(), o3.restore(), s3(692, e12 - 1, 16, 1, "#221a34");
              }
              let g3 = Math.round(0.862 * p2) - l3;
              for (let e12 = 0; e12 < 20; e12++) {
                let t6 = 70 * e12 + 20, l4 = P(4.7 * e12 + 9), r5 = l4 < 0.2 ? 0.22 : 0.4;
                s3(t6, a5 + g3 - 2, 30, 2, `rgba(232,190,96,${r5})`), s3(t6, a5 + g3, 30, 1, `rgba(120,92,40,${r5})`), l4 > 0.6 && s3(t6 + 8 + Math.floor(12 * l4), a5 + g3 - 2, 3, 3, "rgba(16,11,27,0.9)");
              }
              return tp = i3, tm = e11, i3;
            })(), o2 = ((u3 / 2 - 2 * em) % 1400 + 1400) % 1400 - 1400;
            for (; o2 < M2() + b2(); o2 += 1400) G.drawImage(i2, o2, r3, 1400, p2 + y2 - r3);
            !(function(e11) {
              let t5 = Math.floor((em - (u3 / 2 + m2 + 140) / 2) / 230), l3 = Math.ceil((em + (u3 / 2 + g2 + 140) / 2) / 230);
              for (let a5 = t5; a5 <= l3; a5++) e11((230 * a5 - em) * 2 + u3 / 2, a5);
            })((e11) => {
              var t5;
              let l3, a5, i3, o3, s3, d2, c2;
              return t5 = Math.round(e11), l3 = 0.95 * (n3 - r3), a5 = n3 - 4 - l3, i3 = l3 * (td(ts) ? ts.naturalWidth / ts.naturalHeight : 0.3), o3 = td(ts) ? t5 + 0.22 * i3 : t5 - 9, s3 = a5 + (td(ts) ? 0.09 * l3 : 5), G.save(), G.translate(o3, n3 + 6), G.scale(1, 0.3), (d2 = G.createRadialGradient(0, 0, 5, 0, 0, 112)).addColorStop(0, "rgba(255,203,128,0.26)"), d2.addColorStop(0.5, "rgba(255,203,128,0.09)"), d2.addColorStop(1, "rgba(255,203,128,0)"), G.fillStyle = d2, G.beginPath(), G.arc(0, 0, 112, 0, 7), G.fill(), G.restore(), td(ts) ? G.drawImage(ts, Math.round(t5 - i3 / 2), Math.round(a5), Math.round(i3), Math.round(l3)) : (G.fillStyle = "#0d0a17", G.fillRect(t5, a5, 3, l3), G.fillRect(t5 - 12, a5, 15, 3), G.fillStyle = "#ffdca6", G.fillRect(t5 - 13, a5 + 3, 8, 4)), void ((c2 = G.createRadialGradient(o3, s3, 1, o3, s3, 44)).addColorStop(0, "rgba(255,214,150,0.42)"), c2.addColorStop(1, "rgba(255,214,150,0)"), G.fillStyle = c2, G.beginPath(), G.arc(o3, s3, 44, 0, 7), G.fill());
            });
            let s2 = (em - eg) * 2;
            for (let a5 of th) a5.x -= s2 * a5.par - 9 * Math.sin(0.6 * e10 + a5.ph) * t4, a5.y += 6 * Math.sin(0.4 * e10 + a5.ph) * t4, a5.x > M2() + b2() + 10 && (a5.x = M2() - 10), a5.x < M2() - 10 && (a5.x = M2() + b2() + 10), a5.y > p2 + y2 + 10 && (a5.y -= S() + 20), a5.y < x() - 10 && (a5.y += S() + 20), G.fillStyle = `rgba(${l2.dust[0]},${a5.a})`, G.fillRect(a5.x, a5.y, a5.r, a5.r);
          })(r2, a3), (function(e10, t4) {
            N.clearRect(0, 0, u3, p2);
            let a4 = (em - eg) * 2;
            for (let r3 of tf) r3.x -= a4 * r3.par - 13.2 * Math.sin(0.5 * e10 + r3.ph) * t4, r3.x > u3 + 12 && (r3.x = -12), r3.x < -12 && (r3.x = u3 + 12), N.fillStyle = `rgba(${l2.dust[1]},${r3.a})`, N.fillRect(r3.x, r3.y, r3.r, r3.r);
            {
              let e11 = ey(tS), t5 = L() + 42 + ("plunge" === ex ? e$ : 0);
              N.save(), N.translate(e11, t5), N.scale(1, 0.22), N.fillStyle = "rgba(0,0,0,0.55)", N.beginPath(), N.arc(0, 0, 42, 0, 7), N.fill(), N.restore();
            }
            if (eR || "tour" === ex) {
              let e11 = ey(eR ? eC : tS), t5 = L() + (eR ? e$ : 0), l3 = N.createRadialGradient(e11, t5 - 26, 6, e11, t5 - 26, 80);
              l3.addColorStop(0, "rgba(255,209,102,.12)"), l3.addColorStop(1, "rgba(255,209,102,0)"), N.fillStyle = l3, N.beginPath(), N.arc(e11, t5 - 26, 80, 0, 7), N.fill();
              let a5 = "deepcut" === eT ? 0.22 : 0.1, r3 = N.createLinearGradient(e11 + 30, 0, e11 + 30 + 240, 0);
              r3.addColorStop(0, `rgba(255,240,214,${a5})`), r3.addColorStop(1, "rgba(255,240,214,0)"), N.fillStyle = r3, N.beginPath(), N.moveTo(e11 + 26, t5 - 6), N.lineTo(e11 + 270, t5 - 34), N.lineTo(e11 + 270, t5 + 18), N.lineTo(e11 + 26, t5 + 4), N.closePath(), N.fill();
            }
            if (eK) {
              let t5, l3;
              "follow" === eD && eR ? (t5 = ey(eC), l3 = L() + e$) : e_ ? (t5 = e_.x, l3 = w() - 30) : (t5 = u3 / 2, l3 = p2 / 2), (function(e11, t6, l4, a5) {
                if (!eK) return;
                let r3 = "hold" === eD ? 0.62 : 1;
                for (let n3 of eK) {
                  let i2 = n3.rad * r3 * (1 + 7 * eX), o2 = l4 + Math.cos(n3.ang + t6 * n3.w) * i2 * 1.12, s2 = a5 + Math.sin(n3.ang + t6 * n3.w) * i2 * 0.62 + 4 * Math.sin(2.2 * t6 + n3.ph);
                  e11.globalAlpha = Math.max(0, 0.92 - 1.15 * eX), e11.save(), e11.translate(o2, s2);
                  let d2 = 0.8 * n3.s, c2 = 0.7 + 0.3 * Math.sin(5 * t6 + n3.ph);
                  e11.fillStyle = `rgba(255,209,102,${c2})`, e11.fillRect(-d2 / 2, -1.5, d2, 3), e11.fillRect(-1.5, -d2 / 2, 3, d2), e11.fillStyle = `rgba(255,233,168,${c2})`, e11.fillRect(-2, -2, 4, 4), e11.restore();
                }
                e11.globalAlpha = 1;
              })(N, e10, t5, l3);
            }
            for (let l3 = e5.length - 1; l3 >= 0; l3--) {
              let a5 = e5[l3];
              a5.y -= a5.vy * t4, a5.life -= t4;
              let r3 = ey(a5.x) + 3 * Math.sin(3 * e10 + a5.wob);
              if (a5.life <= 0 || a5.y < -30 || r3 < -40 || r3 > u3 + 40) {
                e5.splice(l3, 1);
                continue;
              }
              let n3 = Math.min(0.7, 0.5 * a5.life);
              if (N.fillStyle = `rgba(${a5.col},${n3})`, a5.r > 2.6) {
                let e11 = 1.6 * a5.r;
                N.fillRect(r3 - e11 / 2, a5.y - 1, e11, 2), N.fillRect(r3 - 1, a5.y - e11 / 2, 2, e11), N.fillRect(r3 - 1.5, a5.y - 1.5, 3, 3);
              } else N.fillRect(r3 - a5.r / 2, a5.y - a5.r / 2, a5.r, a5.r);
            }
            for (let e11 = e32.length - 1; e11 >= 0; e11--) {
              let l3 = e32[e11];
              l3.t += t4;
              let a5 = l3.t / l3.life;
              if (a5 >= 1) {
                e32.splice(e11, 1);
                continue;
              }
              l3.x += l3.vx * t4, l3.y += l3.vy * t4, l3.vy *= 1 - 1.2 * t4;
              let r3 = ey(l3.x), n3 = l3.r * (0.5 + a5);
              N.globalAlpha = 0.4 * (1 - a5);
              let i2 = N.createRadialGradient(r3, l3.y, 0, r3, l3.y, n3);
              i2.addColorStop(0, "rgba(30,26,40,.95)"), i2.addColorStop(1, "rgba(10,8,18,0)"), N.fillStyle = i2, N.beginPath(), N.arc(r3, l3.y, n3, 0, 7), N.fill();
            }
            N.globalAlpha = 1;
            for (let e11 = e42.length - 1; e11 >= 0; e11--) {
              let l3 = e42[e11];
              if (l3.t += t4, l3.t > l3.life) {
                e42.splice(e11, 1);
                continue;
              }
              l3.x += l3.vx * t4, l3.y += l3.vy * t4, l3.vx *= 1 - 2.4 * t4, l3.vy *= 1 - 2.4 * t4, l3.vy += 30 * t4, N.globalAlpha = 1 - l3.t / l3.life, N.fillStyle = l3.color, N.fillRect(ey(l3.x) - l3.r / 2, l3.y - l3.r / 2, l3.r, l3.r);
            }
            N.globalAlpha = 1;
          })(r2, a3), (function(t4, l3) {
            eV && !eV.isConnected && eZ();
            let a4 = "finale" === ex ? 0.12 : "tour" === ex ? 0.42 : null;
            if (null !== a4) tS = em + (u3 * a4 - u3 / 2) / 2;
            else if ("plunge" === ex) tS = eC;
            else {
              let e10 = "intro" === ex ? -60 : eq;
              tS += (e10 - tS) * (1 - Math.exp(("descend" === ex ? -1.5 : -3.4) * l3));
            }
            let r3 = "plunge" === ex ? e$ : 0, n3 = ey(tS), i2 = L() + 44 + r3 - (_.offsetHeight || 20), o2 = n3, s2 = L() - 12 + r3;
            if (eV) {
              let t5 = eV.getBoundingClientRect();
              o2 = t5.left - e4.getBoundingClientRect().left + t5.width / 2, s2 = t5.top - e4.getBoundingClientRect().top + t5.height / 2, K.classList.add("perched");
            }
            !Number.isNaN(tC) && (Math.abs(o2 - tC) > 60 || Math.abs(s2 - t$) > 60) && (tw -= o2 - tC, tL -= s2 - t$), tC = o2, t$ = s2;
            let d2 = 1 - Math.exp(-6.5 * l3);
            tw -= tw * d2, tL -= tL * d2, tv = o2 + tw, ty = s2 + tL, tM += ((eV ? 0 : 1.5 * Math.sin(0.9 * t4)) - tM) * d2;
            let c2 = Math.sin(1.7 * t4) * (eV ? 3 : 2), h2 = K.offsetWidth / 2;
            K.style.transform = `translate3d(${tv - h2}px,${ty - h2 + c2}px,0) rotate(${tM}deg)`, _.style.transform = `translate3d(${Math.round(n3 - (_.offsetWidth || 66) / 2)}px,${Math.round(i2)}px,0) rotate(${0.4 * tM}deg)`, t4 - tb > 2.2 + Math.random() && (tb = t4, e8(n3 - 32, i2 + 12, 1.5 + 2 * Math.random())), !$.reducedMotion && eY && t4 - tx > 0.55 && e42.length < 200 && (tx = t4, e42.push({ x: e6(tv + E(-10, 10)), y: ty + c2 + E(-4, 12), vx: E(-10, 10) / 2, vy: E(-14, 6), r: 1.2 + 1.6 * Math.random(), life: 0.6 + 0.5 * Math.random(), t: 0, color: 0.5 > Math.random() ? "#ffd166" : "#ffe9a8" }));
          })(r2, a3);
        }, () => eM.length > 0 || "plunge" === ex || "descend" === ex || Math.abs(eu - ep) > 0.1), { intro() {
          $.invalidate(), B.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e10) => e10.remove()), eP = null, ek = null, B.classList.remove("ds-reveal"), j.classList.remove("on"), eM.length = 0, eK = null, eD = null, eX = 0, e_ = null, eZ(), eQ(), eq = 0, eS = 0, ew = 0, eL = 0, J.textContent = "0", ex = "intro", eu = -45, tS = -60, eH();
        }, finale() {
          $.invalidate(), X.setGold(eY), V.setGold(eY), B.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e11) => e11.remove()), eP = null, ek = null, B.classList.remove("ds-reveal"), j.classList.remove("on"), eK = null, eD = null, eX = 0, e_ = null, eZ(), ex = "finale", eM.length = 0;
          let e10 = eu;
          eb(Math.min(9e3, Math.max(2500, 3 * e10)), I, (t3) => {
            eu = q(e10, -45, t3);
          }), er.event("surface"), eH();
        }, descendToRound(e10, t3, l3 = 2200) {
          $.invalidate(), eG(), B.classList.remove("ds-reveal"), eZ(), B.querySelectorAll(".ds-landed").forEach((e11) => {
            e11.style.transition = "opacity .6s", e11.style.opacity = "0", setTimeout(() => e11.remove(), 650);
          }), eN(e10, t3, eE = eq, 0.45), ex = "descend", eO(), eH();
          let a3 = eu, r2 = eE;
          eb(l3, A, (e11) => {
            eu = q(a3, r2, e11);
          }, () => {
            ex = "round", eH();
          });
        }, restore(e10, t3, l3) {
          $.invalidate(), B.querySelectorAll(".ds-landed,.ds-card,.ds-tierline").forEach((e11) => e11.remove()), eP = null, ek = null, eS = l3.length, eZ(), l3.some((e11) => "krillion" === e11.tier) ? eJ(true) : eQ();
          let a3 = l3.reduce((e11, t4) => e11 + t4.points, 0);
          ew = eq = 10 * a3, eL = a3, J.textContent = String(a3), eE = eq, e10 < 7 && t3 && eN(e10, t3, eE), ev(eE), tS = eE, ex = "round", eH();
        }, plunge(e10, t3) {
          $.invalidate(), null !== e10.tier && (function(e11) {
            for (let t4 of (eG(true), eP = [], s.TIER_IDS)) {
              let l3 = s.TIERS[t4], a3 = e11 + 10 * l3.score, n2 = document.createElement("div");
              n2.className = "ds-tierline", n2.style.left = 2 * a3 + "px", n2.style.setProperty("--tc", `var(--tier-${t4})`), n2.innerHTML = `<div class="tag"><img src="${(0, r.seasonalKrillSprite)(`/tiers/${t4}.png`)}" alt="">${l3.name.toUpperCase()} &middot; ${l3.score}</div><i class="pole"></i>`, n2.style.setProperty("--tag-y", eP.length % 2 ? "-52px" : "-24px"), n2.style.opacity = "0", B.appendChild(n2);
              let i2 = 90 * eP.length;
              requestAnimationFrame(() => {
                n2.style.transition = "opacity .55s ease-out " + i2 + "ms", n2.style.opacity = "1";
              }), eP.push({ d: a3, el: n2, tier: t4, passed: false });
            }
          })(eE), (function(e11, t4) {
            ex = "plunge", B.classList.add("ds-reveal");
            let l3 = eE, a3 = e11.tier ?? "miss";
            if (eT = a3, ek) {
              let e12 = ek;
              e9(ey(l3), 0.58 * p2 - 40, "#ffd166", 12, 0.6), e12.classList.add("gone"), setTimeout(() => e12.remove(), 650), ek = null;
            }
            if (!e11.tier) {
              let a4 = l3 + 40;
              ej(), eO(), er.event("miss"), eU("rgba(61,79,110,.5)", 1, 200), e22("sad", 2600);
              for (let e12 = 0; e12 < 7; e12++) e7(ey(l3) + E(-30, 30), L() + E(-10, 6));
              eW(() => {
                eB(e11, a4), eq = l3, eS++, eu = a4 + C(), ew = l3, eF(e11.newScore, false), ex = "landed", eH(), eW(() => B.classList.remove("ds-reveal"), 900), t4();
              }, 900);
              return;
            }
            let r2 = s.TIERS[e11.tier], n2 = e0[e11.tier], i2 = l3 + 10 * r2.score, o2 = e11.answerText.toUpperCase(), d2 = document.createElement("div");
            d2.className = "ds-chip dr-car", d2.style.setProperty("--cc", `var(--tier-${e11.tier})`), d2.style.top = Math.round(L() - 104) + "px", d2.innerHTML = `<span class="dr-plate">\u201C${o2}\u201D</span>`, B.appendChild(d2);
            let c2 = tS, h2 = ew;
            switch (eC = c2, eR = true, er.event("sink"), a3) {
              case "plankton":
                e22("sad", n2.dur + 800);
                break;
              case "tooclever":
                eU("rgba(255,159,67,.7)", 3, 130), ej(), e22("faint", 2400), (function(e12) {
                  let t5 = u3 < 700 ? 6 : 9;
                  for (let l4 = 0; l4 < t5; l4++) {
                    let t6 = document.createElement("span");
                    t6.className = "ds-swarm-fish dr-swarm-bus", W.appendChild(t6);
                    let a4 = l4 % 2 == 0, r3 = a4 ? -90 : u3 + 90, n3 = a4 ? u3 + 90 : -90, i3 = 0.74 * p2 + E(-26, 40), o3 = 110 * l4, s2 = E(1100, 1800);
                    t6.animate([{ transform: `translate(${r3}px,${i3}px) scaleX(${a4 ? 1 : -1})` }, { transform: `translate(${(r3 + n3) / 2}px,${i3 + E(-8, 8)}px) scaleX(${a4 ? 1 : -1})`, offset: 0.5 }, { transform: `translate(${n3}px,${i3}px) scaleX(${a4 ? 1 : -1})` }], { duration: s2, delay: o3, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "both" }), setTimeout(() => t6.remove(), Math.min(o3 + s2 + 100, e12 + 1400));
                  }
                })(n2.dur);
                break;
              case "rare":
                eU("rgba(255,82,82,.4)", 1, 220), tt(ey(c2), L() + 8, 10);
                break;
              case "deepcut":
                ez(ey(c2), L()), j.classList.add("on");
                break;
              case "krillion":
                eU("rgba(255,209,102,.45)", 1, 180), d2.classList.add("gold"), eD = "follow", eX = 0, eK = [];
                let m3 = u3 < 700 ? 14 : 20;
                for (let e12 = 0; e12 < m3; e12++) eK.push({ ang: Math.random() * Math.PI * 2, rad: 30 + 48 * Math.random(), w: (0.7 + 1.5 * Math.random()) * (0.5 > Math.random() ? -1 : 1), ph: 9 * Math.random(), s: 15 + 13 * Math.random() });
            }
            eb(n2.dur, n2.ease, (t5) => {
              eC = q(c2, i2, t5);
              let l4 = 0;
              "plankton" === a3 ? (e$ = 10 * Math.sin(7 * t5) * (1 - 0.25 * t5), l4 = 2 * Math.sin(9 * t5)) : "tooclever" === a3 ? (e$ = 4 * Math.sin(42 * t5) + E(-1.5, 1.5), l4 = E(-2, 2)) : "krillion" === a3 ? (e$ = Math.sin(24 * t5) * (1 - t5) * 8, l4 = 1.5 * Math.sin(18 * t5)) : (e$ = Math.sin(16 * t5) * (1 - t5) * 5, l4 = 1.2 * Math.sin(12 * t5)), d2.style.transform = `translate3d(calc(${2 * eC}px - 50%), ${e$}px, 0) rotate(${l4}deg)`, eu = eC + C(), "krillion" !== a3 && (ew = q(h2, i2, t5));
              let r3 = ey(eC), n3 = L() + e$;
              if ("plankton" === a3 ? 0.25 > Math.random() && e7(r3 - 34, n3 + 2) : "rare" === a3 ? 0.12 > Math.random() && tt(r3 - 26, n3 + 8, 3) : "krillion" === a3 ? 0.5 > Math.random() && e8(r3 - 30, n3 + E(-16, 4), 1.5 + 2 * Math.random()) : "deepcut" === a3 ? (ez(r3, n3), 0.3 > Math.random() && e8(r3 - 28, n3, 1 + 2 * Math.random())) : 0.6 > Math.random() && e8(r3 - 30 + E(-6, 6), n3 + E(-4, 8), 1.5 + 2.5 * Math.random()), eP) for (let t6 of eP) !t6.passed && eC > t6.d - 4 && (t6.passed = true, t6.el.classList.add("passed"), er.event("tierline"), t6.tier !== e11.tier && e9(ey(t6.d), w() - 24, f[t6.tier], 7, 0.5));
            }, () => {
              eR = false, d2.remove(), (function(e12, t5, l4) {
                ex = "landed";
                let a4 = e12.tier;
                er.event("krillion" === a4 ? "krillion" : "plankton" === a4 || "tooclever" === a4 ? "land_small" : "land_big");
                let r3 = eB(e12, t5);
                eq = t5, eS++, eu = t5 + C();
                let n3 = ey(t5), i3 = w() - 18, o3 = f[a4];
                switch (a4) {
                  case "plankton":
                    e9(n3, i3, "#8fa3c4", 8, 0.4), ew = t5, eF(e12.newScore, false);
                    break;
                  case "tooclever":
                    eU("rgba(255,159,67,.6)", 2, 130), ej(), e9(n3, i3, o3, 18, 0.7), ew = t5, eF(e12.newScore, false);
                    break;
                  case "schooler":
                    e9(n3, i3, o3, 22, 0.8), ew = t5, eF(e12.newScore, false);
                    break;
                  case "rare":
                    tt(n3, i3, 18), e9(n3, i3, o3, 26, 0.9), ej(), eU("rgba(255,82,82,.45)", 1, 240), ew = t5, eF(e12.newScore, false);
                    break;
                  case "deepcut":
                    ez(n3, i3, 200), e9(n3, i3, o3, 18, 0.7), ew = t5, eF(e12.newScore, false), eW(() => j.classList.remove("on"), 550);
                    break;
                  case "krillion":
                    eD = "hold", e_ = { x: n3, d: t5 }, r3.classList.add("perched"), eU("rgba(255,255,255,.5)", 4, 110);
                    for (let e13 = 0; e13 < 14; e13++) eW(() => te(E(0.1 * u3, 0.9 * u3), E(0.2 * p2, 0.8 * p2)), 90 * e13);
                    e22("celebrate", 1250), eW(() => {
                      eJ(), eb(1500, I, (e13) => {
                        eX = e13;
                      }, () => {
                        eK = null, eD = null, eX = 0;
                      }), eF(e12.newScore, true), eW(() => {
                        let e13, l5, a5;
                        return e13 = ew, l5 = 0, a5 = setInterval(() => {
                          ew = Math.round(e13 + (t5 - e13) * (1 - Math.pow(1 - ++l5 / 8, 2))), Y.classList.remove("crank"), Y.offsetWidth, Y.classList.add("crank"), l5 >= 8 && (clearInterval(a5), ew = t5);
                        }, 110), void eI.push(a5);
                      }, 350), eW(() => {
                        "landed" === ex && (eV = r3.querySelector(".icon"));
                      }, 900);
                    }, 1e3);
                }
                eH(), eG(), B.classList.remove("ds-reveal"), l4();
              })(e11, i2, t4);
            });
          })(e10, t3);
        }, showLanded(e10, t3) {
          $.invalidate();
          let l3 = e10.tier ? eE + 10 * e10.points : eE + 40;
          ek?.remove(), ek = null;
          let a3 = eB(e10, l3);
          "krillion" === e10.tier ? (eJ(true), a3.classList.add("perched"), eV = a3.querySelector(".icon")) : eZ(), eq = e10.tier ? l3 : eE, eS++, ew = eq, eL = e10.newScore, J.textContent = String(e10.newScore), ev(l3 + C()), tS = eq, ex = "landed", eH(), t3 && requestAnimationFrame(() => t3());
        }, setUrgency(t3) {
          if (e4.style.setProperty("--ds-urgency", t3.toFixed(3)), O.classList.toggle("danger", t3 > 0.8), t3 > 0.8 && t3 < 1) {
            let e10 = Math.ceil((1 - t3) * 15);
            e10 !== ef && (ef = e10, er.event("tick"));
          } else ef = -1;
        }, typeFx(e10, t3) {
          $.invalidate(), e8(e10 + E(-3, 3), t3 + E(4, 12), 1 + 2 * Math.random()), 0.3 > Math.random() && e8(e10 + E(-8, 8), t3 + E(2, 10), 1 + 1.6 * Math.random());
        }, submitFx(t3) {
          $.invalidate(), eO(), er.event("submit");
          let l3 = e4.getBoundingClientRect().left, a3 = e4.getBoundingClientRect().top;
          for (let e10 = 0; e10 < 12; e10++) e8(t3.left - l3 + E(0, t3.width), t3.top - a3 + E(0, t3.height), 2 + 3 * Math.random());
          O.classList.remove("danger"), e4.style.setProperty("--ds-urgency", "0");
        }, rejectFx() {
          $.invalidate(), eO(), er.event("reject"), e7(u3 / 2 + E(-40, 40), p2 - 120), e7(u3 / 2 + E(-40, 40), p2 - 130);
        }, tour(e10) {
          "tour" !== ex && (B.querySelectorAll(".ds-landed,.ds-card,.ds-tierline,.ds-chip").forEach((e11) => e11.remove()), eP = null, ek = null, B.classList.remove("ds-reveal"), j.classList.remove("on"), eM.length = 0, eK = null, eD = null, eX = 0, e_ = null, eZ(), eQ(), ex = "tour"), eu = e10, ew = Math.max(0, e10), eH();
        }, destroy() {
          eA = true, X.destroy(), V.destroy(), $.destroy(), R(), removeEventListener("resize", et), ea.disconnect(), e4.removeEventListener("pointermove", tk), tR(), en.removeEventListener("click", eh), ec(), er.release(), eI.forEach((e10) => {
            clearTimeout(e10), clearInterval(e10);
          }), eI = [], eM.length = 0, e4.innerHTML = "";
        } };
      })(v.current, b.current);
      return y.current = e3, M.current?.(), () => {
        e3.destroy(), y.current = null;
      };
    }, []), (0, a.useImperativeHandle)(g, () => ({ intro: (...e3) => y.current?.intro(...e3), finale: (...e3) => y.current?.finale(...e3), descendToRound: (...e3) => y.current?.descendToRound(...e3), restore: (...e3) => y.current?.restore(...e3), plunge: (...e3) => y.current?.plunge(...e3), showLanded: (...e3) => y.current?.showLanded(...e3), setUrgency: (...e3) => y.current?.setUrgency(...e3), typeFx: (...e3) => y.current?.typeFx(...e3), submitFx: (...e3) => y.current?.submitFx(...e3), rejectFx: (...e3) => y.current?.rejectFx(...e3), tour: (...e3) => y.current?.tour?.(...e3), destroy: () => {
    } }), []), (0, t.jsx)(l.default, { phase: e2, disabled: "tour" === e2, children: (0, t.jsxs)("div", { className: "ds-root", "data-phase": e2, "data-world": b.current.theme.world, children: [(0, t.jsx)("div", { ref: v, style: { position: "absolute", inset: 0 } }), m] }) });
  });
  e.s(["default", 0, u], 77372);
}]);
