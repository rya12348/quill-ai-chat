(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 32358, (e) => {
  "use strict";
  e.i(15326), e.s(["formatRating", 0, function(e2) {
    return String(Math.round(e2));
  }]);
}, 61736, (e) => {
  "use strict";
  var t = e.i(86968), a = e.i(15326);
  let l = { m: { file: "reef-m-clean.png", iw: 1024, ih: 1536, ax: 512, ay: 945, rx: 430, ry: 440, waterBottom: 390, zoom: 1.08 }, d: { file: "reef-d-clean.png", iw: 1536, ih: 1024, ax: 768, ay: 650, rx: 620, ry: 270, waterBottom: 270, zoom: 1.05 } }, r = (e2, t2, a2) => Math.max(t2, Math.min(a2, e2));
  function s(e2, t2, a2) {
    let s2 = e2 < 1100 ? "m" : "d", o2 = l[s2], n2 = Math.max(e2 / o2.iw, t2 / o2.ih) * o2.zoom, i2 = r(a2.cx - o2.ax * n2, e2 - o2.iw * n2, 0), d2 = r(a2.cy - o2.ay * n2, Math.min(0, t2 - 90 - o2.ih * n2), 0), c2 = i2 + o2.ax * n2, h2 = d2 + o2.ay * n2, p2 = o2.rx * n2, u2 = o2.ry * n2, f2 = Math.max(0, 1 - Math.hypot(a2.perch / 2 / p2, 8 / u2));
    return { cx: c2, cy: h2, rx: Math.min(a2.rx, p2 * f2), ry: Math.min(a2.ry, u2 * f2), pane: { k: s2, s: n2, ox: i2, oy: d2, w: o2.iw * n2, h: o2.ih * n2 } };
  }
  let o = (e2) => Math.atan2(Math.sin(e2), Math.cos(e2));
  var n = e.i(28551);
  let i = "/gen/party/", d = { plankton: "#8fa3c4", tooclever: "#ff9f43", schooler: "#4de3ff", rare: "#ff5252", deepcut: "#9d7bff", krillion: "#ffd166" }, c = { plankton: "PLANKTON", tooclever: "TOO CLEVER", schooler: "SCHOOLER", rare: "RARE", deepcut: "DEEP CUT", krillion: "ONE IN A KRILLION" }, h = { krill: { foot: 0.21, top: 0.18 }, schooler: { foot: 0.3, top: 0.29 }, rare: { foot: 0.1, top: 0.04 }, deepcut: { foot: 0.28, top: 0.25 }, "evil-krill": { foot: 0.21, top: 0.18 }, hackmanite: { foot: 0.156, top: 0.133 }, "fossil-krill": { foot: 0.191, top: 0.129 }, "mantis-shrimp": { foot: 0.152, top: 0.141 }, leviathan: { foot: 0.195, top: 0.145 } };
  function p(e2, a2 = false) {
    let l2 = (0, t.getMascotCharacter)(e2);
    return a2 ? l2.goldSprite : l2.sprite;
  }
  function u(e2) {
    return (0, t.getMascotCharacter)(e2).color;
  }
  function f(e2) {
    return e2.tier ? d[e2.tier] : "#3a5378";
  }
  let m = '<svg viewBox="0 0 7 6" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><rect x="1" y="0" width="2" height="1"/><rect x="4" y="0" width="2" height="1"/><rect x="0" y="1" width="7" height="2"/><rect x="1" y="3" width="5" height="1"/><rect x="2" y="4" width="3" height="1"/><rect x="3" y="5" width="1" height="1"/></svg>', y = [1, 6, 4, 8, 2, 5, 3, 7], x = [0, 0.24, 0.16, 0.2, 0.14, 0.16, 0.44, 0.2, 0.24], g = [0, 166 / 305, 0.625, 180 / 278, 213 / 244, 213 / 285, 245 / 293, 178 / 270, 167 / 287], v = [[0, 0.9], [0, 1.04], [1, 0.95], [1, 1.04], [2, 1], [3, 1.03]], M = ["0", "1", "2", "3", "sleep"], b = [253, 304, 387, 370], w = 392 / 399, N = [1.2, 2.5, 3.9, 5.4, 7.1], k = (e2, t2) => e2 + Math.random() * (t2 - e2), I = (e2, t2, a2) => Math.max(t2, Math.min(a2, e2)), P = (e2, t2, a2) => e2 + (t2 - e2) * a2;
  e.s(["HEART_SVG", 0, m, "TIER_RANK", 0, { plankton: 0, tooclever: 0, schooler: 1, rare: 2, deepcut: 3, krillion: 4 }, "characterColor", 0, u, "characterSprite", 0, p, "createPufferEngine", 0, function(e2, j = {}) {
    let S = e2.closest(".pf-root") ?? e2, L = e2.closest(".ds-stage") ?? e2;
    e2.innerHTML = '<div class="pf-layout-bounds" aria-hidden="true"></div><div class="pf-reef" aria-hidden="true"></div><canvas class="ds-sea"></canvas><div class="pf-ring"></div><canvas class="ds-fore"></canvas><div class="ds-dim"></div><div class="ds-vignette"></div><div class="ds-edge"></div><div class="ds-flash"></div>';
    let E = e2.querySelector(".pf-layout-bounds"), C = e2.querySelector(".pf-reef"), T = e2.querySelector(".ds-sea"), R = e2.querySelector(".ds-fore"), $ = T.getContext("2d"), A = R.getContext("2d"), O = e2.querySelector(".pf-ring"), F = e2.querySelector(".ds-dim"), _ = e2.querySelector(".ds-edge"), z = e2.querySelector(".ds-flash"), H = (0, n.createWorldRenderer)(S, { maxFrameRate: 60 }), q = H.revision, D = false, U = /* @__PURE__ */ new Set(), K = (e3, t2) => {
      let a2 = setTimeout(() => {
        U.delete(a2), D || t2();
      }, e3);
      return U.add(a2), a2;
    }, V = (e3) => {
      let t2 = new Image();
      return t2.decoding = "async", t2.src = e3, t2;
    }, Y = { m: V(i + l.m.file), d: V(i + l.d.file) }, B = { m: "#091426", d: "#091426" };
    for (let e3 of ["m", "d"]) Y[e3].className = "pf-reef-art pf-smooth", Y[e3].alt = "", C.appendChild(Y[e3]), Y[e3].onload = () => {
      if (!D) {
        try {
          let t2 = document.createElement("canvas");
          t2.width = 8, t2.height = 1;
          let a2 = t2.getContext("2d");
          a2.drawImage(Y[e3], 0, Y[e3].naturalHeight - 2, Y[e3].naturalWidth, 2, 0, 0, 8, 1);
          let l2 = a2.getImageData(3, 0, 1, 1).data;
          B[e3] = `rgb(${l2[0]},${l2[1]},${l2[2]})`;
        } catch {
        }
        eh();
      }
    };
    let W = { mode: "door", phase: "door", players: [], meId: null, openSeats: 0, holderId: null, holderSince: null, maxLives: 2, meterTarget: a.METER_FULL, levelOverride: null }, G = /* @__PURE__ */ new Map(), Z = [], J = N.slice(), Q = "", X = 0, ee = null, et = null, ea = 390, el = 844, er = true, es = 1, eo = "", en = 0, ei = 0, ed = 844, ec = { cx: 195, cy: 450, rx: 140, ry: 130, spr: 50, perch: 66, fs: 124, Z: 1, pane: { k: "m", s: 1, ox: 0, oy: 0, w: 0, h: 0 } };
    function eh() {
      let e3 = ec.pane, t2 = Y[e3.k], a2 = t2.complete && t2.naturalWidth > 0, l2 = `${e3.k}|${e3.ox}|${e3.oy}|${e3.w}|${e3.h}|${a2}|${B[e3.k]}`;
      if (l2 !== eo) {
        for (let t3 of (eo = l2, C.style.background = a2 ? B[e3.k] : "linear-gradient(#123a5e, #0b1f38 60%, #060c18)", ["m", "d"])) Y[t3].style.display = a2 && t3 === e3.k ? "block" : "none";
        t2.style.left = e3.ox + "px", t2.style.top = e3.oy + "px", t2.style.width = e3.w + "px", t2.style.height = e3.h + "px";
      }
    }
    function ep() {
      let e3, t2 = ea, a2 = el;
      ea = S.clientWidth || innerWidth, el = S.clientHeight || innerHeight;
      let l2 = E.clientHeight || el, o2 = S.querySelector(".ds-dock");
      for (let e4 of (ed = o2?.offsetHeight ? o2.offsetTop : l2, er = ea < 1100, es = H.pixelRatio(ea, el), [T, R])) {
        let t3 = Math.round(ea * es), a3 = Math.round(el * es);
        e4.width !== t3 && (e4.width = t3), e4.height !== a3 && (e4.height = a3), e4.style.width = ea + "px", e4.style.height = el + "px";
      }
      $.setTransform(es, 0, 0, es, 0, 0), A.setTransform(es, 0, 0, es, 0, 0);
      let n2 = W.mode, i2 = "lobby" === n2;
      S.toggleAttribute("data-short", er ? l2 < 790 : l2 < 700);
      let d2 = 1;
      if ("door" === n2) d2 = er ? I(el / 844, 0.75, 1) : I(el / 800, 0.8, 1.1), ec.cx = ea / 2, ec.cy = er ? Math.round(214 * d2 + 14) : Math.round(0.5 * el), ec.rx = er ? 120 : 220, ec.ry = er ? 70 : 120, ec.fs = Math.round((er ? 104 : 150) * d2), ec.spr = Math.round(70 * d2), ec.perch = Math.round(72 * d2), ec.pane = s(ea, el, ec).pane;
      else {
        var c2, h2, p2;
        let e4, t3, a3, o3, n3, u3, f2, m2, y2, x2, g2, v2, M2, b2, w2 = i2 ? null : j.cardBottom?.() ?? null, N2 = i2 ? S.querySelector(".pf-lobby-title") : null, k2 = N2 ? N2.getBoundingClientRect().bottom - S.getBoundingClientRect().top : w2 ?? 208, I2 = j.floorTop?.() ?? void 0, P2 = W.players.some((e5) => !!e5.rating), L2 = (c2 = ea, h2 = el, p2 = { lobby: i2, cardBottom: k2, seats: Z.length, bottomInset: el - l2, floor: I2 ?? void 0, ratings: P2 }, e4 = c2 < 1100, t3 = p2.seats > 8, a3 = Math.max(p2.cardBottom, e4 ? 148 : 190) + (e4 ? 62 : 78), o3 = h2 - (p2.bottomInset ?? 0) - (p2.lobby ? e4 ? c2 < 700 ? 220 : 230 : 170 : e4 ? 150 : 144), void 0 !== p2.floor && (o3 = Math.max(a3 + 120, Math.min(o3, p2.floor - 52 - (p2.ratings && t3 ? 14 : 0)))), n3 = r((o3 - a3) / (e4 ? 330 : 350), 0.72, 1), u3 = Math.max(0.78, Math.min(1, Math.sqrt(8 / Math.max(1, p2.seats)))), f2 = Math.round((e4 ? r(0.15 * c2, 70, 104) : 92) * n3 * u3), m2 = Math.round((e4 ? r(0.155 * c2, 72, 108) : 96) * n3 * u3), y2 = Math.round((e4 ? r(0.3 * c2, 124, 170) : 150) * n3), x2 = c2 < 700 ? 48 : 64, g2 = e4 ? 8 : 276, v2 = { cx: c2 / 2, cy: (a3 + o3) / 2, rx: Math.max(60, Math.min(t3 ? e4 ? 400 : 560 : 320, c2 / 2 - g2 - x2 - m2 / 2 - 6)), ry: Math.max(50, Math.min(t3 ? 380 : 230, (o3 - a3) / 2)), perch: m2 }, b2 = Math.min((M2 = s(c2, h2, v2)).cx - g2, c2 - g2 - M2.cx), { ...M2, rx: Math.min(M2.rx, Math.max(40, b2 - x2 - m2 / 2 - 6)), ry: Math.min(M2.ry, Math.max(40, Math.min(M2.cy - a3, o3 - M2.cy))), spr: f2, perch: m2, fs: y2, Z: n3 });
        Object.assign(ec, L2), d2 = L2.Z;
      }
      ec.Z = d2, S.toggleAttribute("data-tight", d2 < 0.86);
      let u2 = Z.length > 8;
      S.toggleAttribute("data-crowded", u2), S.style.setProperty("--pf-spr", ec.spr + "px"), S.style.setProperty("--pf-perch", ec.perch + "px"), ei = "round" === W.mode ? j.cardBottom?.() ?? 0 : 0, e3 = Z.length, Z.forEach((t3, a3) => em(t3, a3, e3)), eh(), en !== ec.fs && (en = ec.fs, eb.body.style.width = ec.fs + "px", eb.body.style.height = ec.fs * w + "px", eb.body.style.left = -ec.fs / 2 + "px", eb.body.style.top = -ec.fs * w / 2 + "px"), (t2 !== ea || a2 !== el || eS !== H.revision) && (function() {
        ej = [], eS = H.revision;
        let e4 = Math.round(ea * el / (er ? 4200 : 7e3) * H.particleScale);
        for (let t3 = 0; t3 < e4; t3++) ej.push({ x: Math.random() * ea, y: Math.random() * el, v: k(4, 12), a: k(0.12, 0.42), s: 0.2 > Math.random() ? 3 : 2, ph: 9 * Math.random() });
      })(), H.invalidate();
    }
    let eu = () => ep();
    addEventListener("resize", eu);
    let ef = new ResizeObserver(eu);
    function em(e3, t2, a2) {
      let l2 = (function(e4, t3, a3) {
        let l3 = t3 / a3 * Math.PI * 2;
        if (a3 > 8) {
          let r4 = [0];
          for (let t4 = 1; t4 <= 128; t4++) {
            let a4 = Math.PI / 2 + (t4 - 0.5) / 128 * Math.PI * 2;
            r4.push(r4[t4 - 1] + Math.hypot(e4.rx * Math.sin(a4), e4.ry * Math.cos(a4)));
          }
          let s3 = r4[128] * t3 / a3, o3 = Math.max(1, r4.findIndex((e5) => e5 >= s3)), n3 = (s3 - r4[o3 - 1]) / (r4[o3] - r4[o3 - 1]);
          l3 = (o3 - 1 + n3) / 128 * Math.PI * 2;
        }
        let r3 = Math.PI / 2 + l3;
        return { x: e4.cx + Math.cos(r3) * e4.rx, y: e4.cy + Math.sin(r3) * e4.ry, a: r3 };
      })(ec, t2, a2), r2 = P(0.8, 1, (Math.sin(l2.a) + 1) / 2), s2 = ec.perch * g[e3.perch], o2 = x[e3.perch], n2 = l2.y - (1 - o2) * s2 * r2;
      e3.pos = { x: l2.x, y: n2, k: r2 }, e3.el.style.transform = `translate(${l2.x.toFixed(1)}px, ${n2.toFixed(1)}px)`, e3.el.style.zIndex = String(100 + Math.round(l2.y)), e3.el.classList.toggle("face-l", l2.x < ec.cx - 8), e3.body.style.transform = `scale(${r2.toFixed(3)})`, e3.body.style.transformOrigin = "0 0", e3.perchImg.style.top = -o2 * s2 + "px";
      let i2 = a2 > 8 && Math.abs(Math.cos(l2.a)) > 0.75, d2 = ea < 700 ? 48 : 64;
      e3.plate.style.left = i2 ? (l2.x < ec.cx ? -ec.perch * r2 / 2 - d2 - 4 : ec.perch * r2 / 2 + 4).toFixed(1) + "px" : "", e3.plate.style.top = ((1 - o2) * s2 * r2 + (i2 ? -18 : 5)).toFixed(1) + "px", e3.meter.style.top = ((1 - o2) * s2 * r2 - 7).toFixed(1) + "px", e3.meter.style.width = Math.round(ec.perch * r2 * 0.6) + "px";
      let c2 = h[e3.p?.character ?? "krill"] ?? h.krill;
      e3.el.style.setProperty("--pf-foot", String(c2.foot)), e3.headY = (1 - c2.foot - c2.top) * ec.spr * r2, ey(e3), e3.el.style.setProperty("--pf-sink-y", ((1 - o2) * s2 * r2 * 0.5 + 18).toFixed(0) + "px");
    }
    function ey(e3) {
      var t2;
      let a2, l2, s2, o2;
      if (!e3.say.textContent || !e3.say.offsetHeight) return;
      let n2 = e3.say.offsetHeight, i2 = (l2 = Math.max(a2 = (t2 = { seatX: e3.pos.x, seatY: e3.pos.y, headY: e3.headY, plateBottom: e3.pos.y + e3.plate.offsetTop + e3.plate.offsetHeight, width: e3.say.offsetWidth, height: n2, viewportWidth: ea, cardBottom: ei, dockTop: ed }).cardBottom + 8, t2.dockTop - t2.height - 8), o2 = (s2 = t2.seatY - t2.headY - 16 - t2.height) >= a2 + 46 ? s2 : t2.plateBottom + 8, { x: r(t2.seatX, t2.width / 2 + 8, t2.viewportWidth - t2.width / 2 - 8), top: r(o2, a2, l2) });
      e3.say.style.left = (i2.x - e3.pos.x).toFixed(1) + "px", e3.say.style.bottom = (e3.pos.y - i2.top - n2).toFixed(1) + "px";
    }
    function ex(e3) {
      return G.get(e3) ?? null;
    }
    function eg(e3, t2, a2, l2) {
      e3.say.className = "pf-say ds-chip ds-px" + (t2 ? " on" : "") + (a2 ? " " + a2 : ""), e3.say.textContent = t2, l2 ? e3.say.style.setProperty("--cc", `var(--tier-${l2}, ${d[l2]})`) : e3.say.style.removeProperty("--cc"), ey(e3);
    }
    function ev(e3, t2) {
      let a2 = e3.p, l2 = !!a2 && a2.id === W.meId;
      if (e3.el.classList.toggle("me", l2), e3.el.classList.toggle("open", !a2), e3.el.classList.toggle("away", !!a2 && !a2.connected), a2) {
        let t3, l3 = p(a2.character, e3.gold);
        e3.spr.getAttribute("src") !== l3 && (e3.spr.src = l3), e3.spr.alt = a2.name, e3.el.style.setProperty("--pf-glow", (t3 = parseInt(u(a2.character).slice(1), 16), `rgba(${t3 >> 16 & 255},${t3 >> 8 & 255},${255 & t3},0.4)`));
      }
      e3.name.textContent = a2?.name ?? "", e3.name.title = a2?.name ?? "";
      let r2 = a2 ? a2.lives : W.maxLives, s2 = null !== e3.heartPop && t2 < e3.heartPopUntil ? e3.heartPop : null, o2 = t2 < e3.spareUntil ? r2 - 1 : null, n2 = `${r2}|${W.maxLives}|${s2}|${o2}`;
      n2 !== e3.heartsKey && (e3.heartsKey = n2, e3.hearts.style.setProperty("--hearts", String(Math.min(5, Math.max(W.maxLives, r2, 2)))), e3.hearts.innerHTML = (function(e4, t3, a3) {
        let l3 = Math.max(W.maxLives, e4, 2), r3 = "";
        for (let s3 = 0; s3 < l3; s3++) {
          let l4 = (s3 < e4 ? "" : " empty") + (s3 === t3 ? " pop" : "") + (s3 === a3 ? " gain" : "");
          r3 += `<i class="pf-heart${l4}">${m}</i>`;
        }
        return r3;
      })(r2, s2, o2));
      let i2 = a2?.rating ?? "", c2 = a2?.ratingDelta ?? null, h2 = `${i2}|${c2}`;
      if (h2 !== e3.eloKey) {
        if (e3.eloKey = h2, e3.elo.textContent = "", i2 && (e3.elo.append(i2), null !== c2)) {
          let t3 = document.createElement("i");
          t3.className = c2 > 0 ? "up" : c2 < 0 ? "down" : "", t3.textContent = c2 > 0 ? ` +${c2}` : c2 < 0 ? ` ${c2}` : " \xB10", e3.elo.append(t3);
        }
        e3.elo.title = i2 ? "Rating" : "";
      }
      let y2 = a2 ? a2.segs : [], x2 = t2 < e3.spareUntil, g2 = W.meterTarget + ":" + y2.map((e4) => `${e4.tier}:${e4.amt}`).join(",") + (x2 ? "!" : "");
      g2 !== e3.meterKey && (e3.meterKey = g2, e3.meter.innerHTML = x2 ? `<i style="width:100%;background:${d.krillion}"></i>` : y2.map((e4) => `<i style="width:${e4.amt / W.meterTarget * 100}%;background:${f(e4)}"></i>`).join(""), e3.meter.classList.toggle("full", x2 || !!a2 && a2.meter >= W.meterTarget));
      let v2 = "round" === W.mode && "round" === W.phase && !!a2 && a2.id === W.holderId && t2 >= X;
      if (e3.el.classList.toggle("hold", v2), e3.el.classList.toggle("out", !!a2 && !a2.alive && null !== a2.place && !e3.outHold), e3.el.classList.toggle("waiting", !!a2 && !a2.alive && null === a2.place && "round" === W.mode), a2?.hideFreeText && e3.say.classList.contains("bad") && (e3.sayUntil = 0, eg(e3, "", "")), !v2 && a2 && a2.alive && "round" === W.mode && "round" === W.phase || (e3.rest = null), t2 >= e3.sayUntil) {
        let t3 = v2 && a2 && a2.typing ? a2.typing : "";
        t3 ? eg(e3, t3, "caret") : e3.rest ? eg(e3, e3.rest.text, "rest", e3.rest.tier) : eg(e3, "", "");
      }
    }
    ef.observe(E);
    let eM = document.createElement("div");
    eM.className = "pf-puffer", eM.innerHTML = `<div class="pf-pbody">${M.map((e3) => `<img class="pf-smooth" src="${i}puffer-${e3}.png" alt="">`).join("")}</div><span class="pf-zz"></span>`, O.appendChild(eM);
    let eb = { x: 195, y: 420, level: 0, shown: -1, pop: 0, popV: 0, face: 1, rot: 0, trot: 0, visible: true, sleep: true, spin: 0, alpha: 1, el: eM, body: eM.firstChild, imgs: [...eM.firstChild.children], zz: eM.querySelector(".pf-zz"), override: null };
    function ew(e3, t2 = true) {
      if ((e3 = I(e3, 0, 5)) === eb.level) return;
      let a2 = e3 > eb.level;
      eb.level = e3, t2 && (eb.popV += a2 ? 3.4 : -1.2), a2 && t2 && (function() {
        let e4 = ek();
        for (let t3 = 0; t3 < 6; t3++) {
          let t4 = k(-0.9, 0.9) + (1 === eb.face ? Math.PI : 0) + eb.rot, a3 = k(20, 44);
          eI.push({ k: "suck", x: e4.x + Math.cos(t4) * a3, y: e4.y + Math.sin(t4) * a3, tx: e4.x, ty: e4.y, life: 0, max: k(0.35, 0.55), r: k(1.4, 2.6) });
        }
      })(), j.onLevel?.(e3);
    }
    function eN() {
      return W.holderId ? ex(W.holderId) : null;
    }
    function ek() {
      let [e3, t2] = v[eb.level], a2 = ec.fs * (b[e3] / 399) * 0.5 * t2, l2 = 0.03 * ec.fs, r2 = Math.cos(eb.rot), s2 = Math.sin(eb.rot), o2 = -(0.97 * a2) * eb.face;
      return { x: eb.x + o2 * r2 - l2 * s2, y: eb.y + o2 * s2 + l2 * r2, r: a2 };
    }
    let eI = [];
    function eP(e3, t2, a2 = {}) {
      eI.push({ k: "bub", x: e3, y: t2, vx: a2.vx ?? k(-8, 8), vy: a2.vy ?? k(-50, -26), r: a2.r ?? k(1.6, 4), life: 0, max: a2.max ?? k(1.6, 3.2), ph: 9 * Math.random(), drag: a2.drag ?? 1.4, a: a2.a ?? 0.7 });
    }
    let ej = [], eS = -1, eL = [], eE = 0, eC = 0, eT = 0, eR = false;
    function e$(e3, t2, a2) {
      let l2 = document.createElement("div");
      l2.className = "pf-rise";
      let r2 = e3.pos.x - ec.cx;
      l2.style.left = (30 > Math.abs(r2) ? 0 : r2 > 0 ? -40 : 40) + "px", l2.style.setProperty("--tc", a2), l2.innerHTML = t2, l2.style.bottom = e3.headY + 44 + "px", e3.inEl.appendChild(l2), K(1800, () => l2.remove());
    }
    function eA(e3, t2) {
      e3.classList.remove(t2), e3.offsetWidth, e3.classList.add(t2);
    }
    function eO() {
      eb.y = -60, eb.x = ec.cx + k(-40, 40), eb.level = 0, eb.pop = 0, eb.popV = 0, eb.visible = true, eb.alpha = 1;
    }
    return ep(), eb.x = ec.cx, eb.y = ec.cy + 6, H.start(function(e3, t2, a2) {
      var r2, s2;
      if (D) return;
      q !== H.revision && (q = H.revision, ep());
      let n2 = Math.min(0.05, t2), i2 = Date.now();
      ew((function(e4) {
        if ("round" !== W.mode || "round" !== W.phase || !eb.visible || e4 < X) return 0;
        if (null !== W.levelOverride) return W.levelOverride;
        if (null === W.holderSince || !W.holderId) return 0;
        let t3 = (e4 - W.holderSince) / 1e3;
        if (t3 < 0) return 0;
        let a3 = 0;
        for (let e5 of J) t3 >= e5 && a3++;
        return a3;
      })(i2));
      let d2 = eb.level >= 5 && "round" === W.phase && !!W.meId && W.holderId === W.meId;
      d2 !== eR && (eR = d2, _.classList.toggle("danger", d2)), (function(e4, t3) {
        var a3, l2, r3, s3, n3;
        let i3 = (function() {
          if (eb.override) return eb.override;
          let e5 = ec.cx, t4 = ec.cy + 6, a4 = eN();
          if (a4 && "round" === W.mode && "round" === W.phase) {
            let l3 = a4.pos.x - e5, r4 = a4.pos.y - t4, s4 = Math.hypot(l3, r4) || 1;
            e5 += l3 / s4 * (er ? 12 : 18) * ec.Z, t4 += r4 / s4 * 4;
          }
          return { x: e5, y: t4 };
        })(), d3 = eb.sleep ? Math.sin(1.45 * t3) : 0, c3 = eb.sleep ? 2 * Math.sin(0.72 * t3) + 0.8 * d3 : 4 * Math.sin(1.7 * t3) + 2 * Math.sin(0.63 * t3);
        eb.x = P(eb.x, i3.x, 1 - Math.pow(0.02, e4)), eb.y = P(eb.y, i3.y + c3, 1 - Math.pow(0.02, e4));
        let h2 = eN();
        if (h2 && "round" === W.mode && !eb.override) {
          let e5, t4, r4, s4 = h2.pos.x - eb.x, n4 = h2.pos.y - 0.5 * h2.headY - eb.y, i4 = (a3 = eb.face, l2 = eb.rot, t4 = o(l2 + ((e5 = Math.abs(s4) > 30 ? s4 > 0 ? -1 : 1 : a3) !== a3 ? Math.PI : 0)), r4 = 1e-3 > Math.hypot(s4, n4) ? t4 : Math.atan2(-e5 * n4, -e5 * s4), { face: e5, rotation: t4, target: r4 });
          eb.face = i4.face, eb.rot = i4.rotation, eb.trot = i4.target;
        } else eb.override ? (eb.face = eb.override.face, eb.trot = 0) : eb.trot = eb.sleep ? -0.1 + 0.025 * Math.sin(0.72 * t3) : 0.06 * Math.sin(0.4 * t3);
        r3 = eb.rot, s3 = eb.trot, n3 = 1 - Math.pow(0.05, e4), eb.rot = o(r3 + o(s3 - r3) * n3), eb.popV += (-(120 * eb.pop) - 11 * eb.popV) * e4, eb.pop += eb.popV * e4, eb.spin > 0 && (eb.spin = Math.max(0, eb.spin - 2.4 * e4));
        let [p2, u2] = v[eb.level], f2 = eb.sleep ? 4 : p2;
        f2 !== eb.shown && (eb.imgs.forEach((e5, t4) => e5.classList.toggle("on", t4 === f2)), eb.shown = f2), eb.el.classList.toggle("furious", eb.level >= 5);
        let m2 = 0, y2 = 0;
        if (eb.level >= 4 && eb.visible) {
          let e5 = eb.level >= 5 ? 2.2 : 0.8;
          m2 = (Math.random() - 0.5) * e5 * 2, y2 = (Math.random() - 0.5) * e5 * 2;
        }
        let x2 = u2 * (1 + 0.08 * eb.pop) * (eb.visible ? 1 : 1e-3), g2 = eb.spin > 0 ? -((1 - eb.spin) * Math.PI * 2 * eb.face) : 0, M2 = ec.fs;
        if (eb.el.style.transform = `translate(${(eb.x + m2).toFixed(1)}px, ${(eb.y + y2).toFixed(1)}px)`, eb.el.style.zIndex = String(100 + Math.round(eb.y + 18)), eb.body.style.transform = `rotate(${(eb.rot + g2).toFixed(3)}rad) scale(${(eb.face * x2 * (1 + 0.012 * d3)).toFixed(3)}, ${(x2 * (1 + 0.025 * d3)).toFixed(3)})`, eb.body.style.opacity = eb.alpha.toFixed(2), eb.zz.style.display = eb.sleep && eb.visible ? "block" : "none", eb.sleep) {
          let e5 = 0.45 * t3 % 1, a4 = e5 < 0.33 ? "z" : e5 < 0.66 ? "z z" : "z z z";
          eb.zz.textContent !== a4 && (eb.zz.textContent = a4), eb.zz.style.transform = `translate(${(0.18 * M2).toFixed(0)}px, ${(-(0.32 * M2) - 14 * e5).toFixed(0)}px)`, eb.zz.style.opacity = String(0.4 + 0.5 * Math.sin(e5 * Math.PI));
        }
      })(n2, a2);
      let c2 = eI.length > 0;
      for (let e4 = eI.length - 1; e4 >= 0; e4--) {
        let t3 = eI[e4];
        if (t3.life += n2, t3.life > t3.max) {
          eI.splice(e4, 1);
          continue;
        }
        if ("bub" === t3.k) t3.vx *= Math.exp(-t3.drag * n2), t3.vy = P(t3.vy, -38, 1 - Math.exp(-1.2 * n2)), t3.x += (t3.vx + 6 * Math.sin(4 * t3.life + t3.ph)) * n2, t3.y += t3.vy * n2;
        else if ("spine" === t3.k) {
          let e5 = Math.exp(-2.6 * n2);
          t3.vx *= e5, t3.vy = t3.vy * e5 + 10 * n2, t3.x += t3.vx * n2, t3.y += t3.vy * n2, t3.rot += t3.vr * n2 * (Math.hypot(t3.vx, t3.vy) / 200 + 0.08);
        } else if ("spark" === t3.k) t3.x += t3.vx * n2, t3.y += t3.vy * n2, t3.vy *= Math.exp(-0.8 * n2);
        else if ("trail" === t3.k) {
          let e5 = t3.life / t3.max;
          t3.x = P(t3.sx, t3.tx, e5), t3.y = P(t3.sy, t3.ty, e5) - 10 * Math.sin(e5 * Math.PI);
        }
      }
      if (!(function(e4, t3) {
        let a3, r3, s3, o2 = ec.pane;
        if ($.clearRect(0, 0, ea, el), eb.visible && !eb.override) {
          let [e5, t4] = v[eb.level], a4 = ec.fs * (b[e5] / 399) * t4 * 0.42, l2 = Math.max(ec.cy + 0.42 * ec.ry, eb.y + 0.5 * ec.fs), r4 = I((l2 - eb.y) / (0.7 * ec.fs), 0.6, 1.4);
          $.fillStyle = `rgba(3,8,18,${(0.32 / r4).toFixed(3)})`, $.beginPath(), $.ellipse(Math.round(eb.x), Math.round(l2), a4 * (1.1 - 0.15 * r4), 0.26 * a4, 0, 0, 2 * Math.PI), $.fill();
        }
        let n3 = (a3 = Math.min(el, o2.oy + l[o2.k].waterBottom * o2.s) - 24) > 24 ? { top: 24, bottom: a3 } : null;
        n3 && H.particleScale && eL.length < 2 && Math.random() < 0.08 * t3 && (r3 = 0.5 > Math.random(), s3 = k(9, 15) * (er ? 1 : 1.3), eL.push({ x: r3 ? -30 : ea + 30, y: k(n3.top, n3.bottom), v: k(10, 22) * (r3 ? 1 : -1), sz: s3, ph: 9 * Math.random(), n: 0.4 > Math.random() ? 3 : 1 })), $.fillStyle = "rgba(6,16,32,0.55)";
        for (let a4 = eL.length - 1; a4 >= 0; a4--) {
          let l2 = eL[a4];
          if (l2.x += l2.v * t3, !H.particleScale || !n3 || l2.y < n3.top || l2.y > n3.bottom || l2.x < -60 || l2.x > ea + 60) {
            eL.splice(a4, 1);
            continue;
          }
          for (let t4 = 0; t4 < l2.n; t4++) {
            let a5 = Math.sign(l2.v), r4 = Math.round(l2.x - a5 * t4 * l2.sz * 1.8), s4 = Math.round(l2.y + 3 * Math.sin(1.4 * e4 + l2.ph + t4) + 5 * t4);
            $.beginPath(), $.ellipse(r4, s4, l2.sz, 0.42 * l2.sz, 0, 0, 2 * Math.PI), $.fill(), $.beginPath(), $.moveTo(r4 - a5 * l2.sz * 0.8, s4), $.lineTo(r4 - a5 * l2.sz * 1.6, s4 - 0.5 * l2.sz), $.lineTo(r4 - a5 * l2.sz * 1.6, s4 + 0.5 * l2.sz), $.closePath(), $.fill();
          }
        }
        for (let a4 of ej) a4.y += a4.v * t3, a4.x += 3 * Math.sin(0.5 * e4 + a4.ph) * t3, a4.y > el + 4 && (a4.y = -4, a4.x = Math.random() * ea), $.fillStyle = `rgba(200,220,255,${a4.a})`, $.fillRect(2 * Math.round(a4.x / 2), 2 * Math.round(a4.y / 2), a4.s, a4.s);
        if ((eE -= t3) <= 0 && H.particleScale) {
          eE = k(0.35, 0.9);
          let e5 = k(0, 2 * Math.PI);
          eP(ec.cx + Math.cos(e5) * ec.rx * k(0.9, 1.3), ec.cy + Math.sin(e5) * ec.ry * k(0.9, 1.2) + 10, { r: k(1.4, 3), a: 0.45, max: k(2.5, 4) });
        }
      })(a2, n2), (c2 || eI.length) && (A.clearRect(0, 0, ea, el), !(function(e4) {
        for (let t3 of eI) {
          let a3 = t3.life / t3.max;
          if ("bub" === t3.k) {
            let l2 = t3.a * (a3 > 0.75 ? (1 - a3) / 0.25 : 1);
            e4.strokeStyle = `rgba(200,235,255,${l2.toFixed(3)})`, e4.lineWidth = 1.5, e4.beginPath(), e4.arc(t3.x, t3.y, t3.r, 0, 2 * Math.PI), e4.stroke(), t3.r > 3 && (e4.fillStyle = `rgba(232,246,255,${(0.7 * l2).toFixed(3)})`, e4.fillRect(Math.round(t3.x - 0.4 * t3.r), Math.round(t3.y - 0.5 * t3.r), 1.5, 1.5));
          } else if ("suck" === t3.k) {
            let l2 = P(t3.x, t3.tx, a3 * a3), r3 = P(t3.y, t3.ty, a3 * a3);
            e4.strokeStyle = `rgba(200,235,255,${(0.75 * (1 - a3)).toFixed(3)})`, e4.lineWidth = 1.2, e4.beginPath(), e4.arc(l2, r3, t3.r * (1 - 0.5 * a3), 0, 2 * Math.PI), e4.stroke();
          } else if ("spine" === t3.k) {
            let l2 = t3.hang ? 1 : a3 > 0.7 ? (1 - a3) / 0.3 : 1, r3 = Math.cos(t3.rot), s3 = Math.sin(t3.rot);
            e4.globalAlpha = l2;
            let o2 = er ? 3 : 4, n3 = Math.max(3, Math.round(t3.len / o2));
            for (let a4 = 0; a4 < n3; a4++) {
              let l3 = Math.round((t3.x + r3 * a4 * o2) / o2) * o2, i3 = Math.round((t3.y + s3 * a4 * o2) / o2) * o2;
              e4.fillStyle = a4 === n3 - 1 ? "#fff6d6" : a4 < 1 ? "#a87a2c" : "#f1d58c", e4.fillRect(l3, i3, o2, o2);
            }
            e4.globalAlpha = 1;
          } else if ("burst" === t3.k) {
            let l2 = er ? 3 : 4, r3 = t3.reach * (1 - Math.pow(1 - a3, 3)), s3 = t3.len * (1 - a3), o2 = Math.max(1, Math.ceil(s3 / l2)), n3 = Math.cos(t3.angle), i3 = Math.sin(t3.angle);
            e4.globalAlpha = Math.pow(1 - a3, 0.7), e4.fillStyle = t3.col;
            for (let a4 = 0; a4 <= o2; a4++) {
              let d3 = r3 - s3 + a4 / o2 * s3, c3 = Math.max(l2, Math.round(t3.width * (1 - a4 / (o2 + 1)) / l2) * l2), h2 = Math.round((t3.x + n3 * d3 - c3 / 2) / l2) * l2, p2 = Math.round((t3.y + i3 * d3 - c3 / 2) / l2) * l2;
              e4.fillRect(h2, p2, c3, c3);
            }
            e4.globalAlpha = 1;
          } else if ("spark" === t3.k) e4.fillStyle = t3.col.replace("A", (1 - a3).toFixed(3)), e4.fillRect(Math.round(t3.x), Math.round(t3.y), t3.s, t3.s), 3 === t3.s && a3 < 0.5 && (e4.fillRect(Math.round(t3.x) - 3, Math.round(t3.y) + 1, 9, 1), e4.fillRect(Math.round(t3.x) + 1, Math.round(t3.y) - 3, 1, 9));
          else if ("trail" === t3.k) {
            let l2 = 0.65 * Math.sin(a3 * Math.PI);
            e4.strokeStyle = `rgba(255,170,200,${l2.toFixed(3)})`, e4.lineWidth = 1.4, e4.beginPath(), e4.arc(t3.x, t3.y, 2.2, 0, 2 * Math.PI), e4.stroke();
          }
        }
      })(A)), "round" === W.mode && "round" === W.phase && eb.visible && i2 >= X) {
        eC -= n2;
        let e4 = eN();
        if (eC <= 0 && e4 && (null === W.holderSince || i2 >= W.holderSince)) {
          eC = 0.42;
          let t3 = ek();
          eI.push({ k: "trail", sx: t3.x, sy: t3.y, x: t3.x, y: t3.y, tx: e4.pos.x, ty: e4.pos.y - 0.5 * ec.spr * e4.pos.k, life: 0, max: 1.1 });
        }
      }
      if (ee) {
        eT -= n2;
        let e4 = ex(ee);
        if (eT <= 0 && e4) {
          eT = 0.12;
          for (let t3 = 0; t3 < 2; t3++) r2 = e4.pos.x + k(-(0.6 * ec.spr), 0.6 * ec.spr), s2 = e4.pos.y - k(0, 1.2 * ec.spr), eI.push({ k: "spark", x: r2, y: s2, vx: k(-20, 20), vy: k(-50, -15), life: 0, max: k(0.8, 1.6), col: "rgba(255,209,102,A)", s: 0.3 > Math.random() ? 3 : 2 });
          0.5 > Math.random() && eP(e4.pos.x + k(-20, 20), e4.pos.y - 10, { r: k(1.5, 3), a: 0.6 });
        }
      }
    }, () => "round" === W.phase || "countdown" === W.phase), { sync(e3) {
      let t2 = e3.mode !== W.mode, a2 = e3.players.length + ("lobby" === e3.mode ? e3.openSeats : 0) !== Z.length, l2 = "door" === W.mode, r2 = "countdown" === e3.phase && "countdown" !== W.phase;
      W = e3;
      let s2 = Date.now(), o2 = [...e3.players].sort((e4, t3) => e4.seat - t3.seat), n2 = o2.findIndex((t3) => t3.id === e3.meId), d2 = n2 > 0 ? [...o2.slice(n2), ...o2.slice(0, n2)] : o2, c2 = new Set(d2.map((e4) => y[e4.seat % y.length])), h2 = y.filter((e4) => !c2.has(e4)), p2 = d2.map((e4) => ({ key: e4.id, p: e4, perch: y[e4.seat % y.length] }));
      if ("lobby" === e3.mode) for (let t3 = 0; t3 < e3.openSeats; t3++) p2.push({ key: "open:" + t3, p: null, perch: h2[t3 % Math.max(1, h2.length)] ?? y[p2.length % y.length] });
      let u2 = new Set(p2.map((e4) => e4.key));
      for (let [e4, t3] of G) u2.has(e4) || (t3.el.remove(), G.delete(e4));
      let f2 = [];
      Z = p2.map((e4) => {
        let t3 = G.get(e4.key);
        if (t3 && t3.perch !== e4.perch && (t3.perch = e4.perch, t3.perchImg.src = `${i}perch-${e4.perch}.png`), !t3) {
          var a3, l3;
          let r3;
          a3 = e4.key, l3 = e4.perch, (r3 = document.createElement("div")).className = "pf-seat", r3.innerHTML = `<div class="pf-seat-in"><div class="pf-body"><img class="pf-perch pf-smooth" src="${i}perch-${l3}.png" alt=""><div class="pf-spr-wrap"><img class="pf-spr" alt=""></div></div><span class="pf-meter pf-seat-meter"></span><div class="pf-say ds-chip ds-px"></div><div class="pf-plate"><b class="pf-name"></b><div class="pf-row"><span class="pf-hearts"></span><span class="pf-elo"></span></div></div></div>`, t3 = { key: a3, p: null, perch: l3, el: r3, inEl: r3.firstChild, body: r3.querySelector(".pf-body"), perchImg: r3.querySelector(".pf-perch"), spr: r3.querySelector(".pf-spr"), say: r3.querySelector(".pf-say"), plate: r3.querySelector(".pf-plate"), name: r3.querySelector(".pf-name"), hearts: r3.querySelector(".pf-hearts"), meter: r3.querySelector(".pf-meter"), elo: r3.querySelector(".pf-elo"), pos: { x: ec.cx, y: ec.cy, k: 1 }, headY: 40, sayUntil: 0, rest: null, outHold: false, heartPop: null, heartPopUntil: 0, spareUntil: 0, gold: false, heartsKey: "", meterKey: "", eloKey: "" }, G.set(e4.key, t3), f2.push(t3);
        }
        return t3.p = e4.p, t3;
      }), t2 && O.classList.remove("settled"), (t2 || a2) && (ep(), l2 && (eb.x = ec.cx, eb.y = ec.cy + 6));
      let m2 = Z.length;
      Z.forEach((e4, t3) => {
        em(e4, t3, m2), f2.includes(e4) && O.insertBefore(e4.el, eM);
      }), t2 && requestAnimationFrame(() => requestAnimationFrame(() => O.classList.add("settled"))), eb.sleep = "round" !== e3.mode, r2 && (eb.popV = 4), "over" !== e3.phase && (function() {
        if (!ee) return;
        let e4 = ex(ee);
        e4 && (e4.el.classList.remove("win"), e4.gold = false), ee = null, eb.override = null;
      })(), "round" !== e3.mode && (eb.visible = true, X = 0);
      let x2 = `${e3.holderId}|${e3.holderSince}`;
      if (x2 !== Q) {
        let t3;
        Q = x2;
        let a3 = (t3 = (2654435769 ^ Math.floor(e3.holderSince ?? 0)) >>> 0, () => {
          let e4 = t3 = t3 + 1831565813 >>> 0;
          return e4 = Math.imul(e4 ^ e4 >>> 15, 1 | e4), (((e4 ^= e4 + Math.imul(e4 ^ e4 >>> 7, 61 | e4)) ^ e4 >>> 14) >>> 0) / 4294967296;
        });
        J = N.map((e4) => e4 + (0.55 * a3() - 0.25));
      }
      for (let e4 of Z) ev(e4, s2);
    }, relayout() {
      ep();
    }, pass(e3, t2, a2) {
      H.invalidate();
      let l2 = ex(e3);
      l2 && (eg(l2, t2.toLowerCase(), "ok", a2), l2.rest = { text: t2.toLowerCase(), tier: a2 }, l2.sayUntil = Date.now() + 1300, K(1320, () => {
        Date.now() >= l2.sayUntil && ev(l2, Date.now());
      }), e$(l2, `<img src="/tiers/${a2}.png" alt="">${c[a2]}`, d[a2]), eb.visible && (function() {
        let e4 = ek(), t3 = 1 === eb.face ? -1 : 1, a3 = Math.cos(eb.rot), l3 = Math.sin(eb.rot);
        for (let r2 = 0; r2 < 16; r2++) {
          let r3 = t3 * k(40, 140), s2 = k(-60, 10);
          eP(e4.x, e4.y + k(-4, 4), { vx: r3 * a3 - s2 * l3, vy: r3 * l3 + s2 * a3, r: k(1.5, 4.5), max: k(1, 2.2), drag: 2.4 });
        }
      })(), ew(0, false), eb.popV -= 2, eb.spin = 1);
    }, reject(e3, t2) {
      H.invalidate();
      let a2 = ex(e3);
      eb.popV += 1.6, a2 && (eg(a2, t2, "bad"), eA(a2.say, "ds-reject-shake"), a2.sayUntil = Date.now() + 1400, K(1420, () => {
        Date.now() >= a2.sayUntil && ev(a2, Date.now());
      }));
    }, pop(e3, t2, l2) {
      H.invalidate();
      let r2 = ex(e3), s2 = !!j.hang;
      X = s2 ? 1 / 0 : Date.now() + (l2 ? 1100 : a.POP_FREEZE_MS), (function(e4) {
        let t3 = eb.x, a2 = eb.y;
        eA(L, "ds-shake");
        let l3 = L.querySelector(".ds-crt");
        l3 && eA(l3, "zap"), z.style.transition = "none", z.style.background = "rgba(255,244,214,.55)", z.style.opacity = ".5", requestAnimationFrame(() => requestAnimationFrame(() => {
          z.style.transition = "opacity 380ms ease-out", z.style.opacity = "0";
        })), (function(e5, t4, a3, l4) {
          for (let r4 = 0; r4 < a3; r4++) {
            let s3 = r4 / a3 * Math.PI * 2 + k(-0.12, 0.12), o2 = k(160, 330) * (er ? 0.85 : 1.15);
            eI.push({ k: "spine", x: e5, y: t4, vx: Math.cos(s3) * o2, vy: Math.sin(s3) * o2, rot: s3, vr: k(-3, 3), len: k(10, 16) * (er ? 1 : 1.4), life: 0, max: l4 ? 1e9 : k(2.4, 3.4), hang: l4 });
          }
        })(t3, a2, er ? 26 : 34, e4);
        for (let l4 = 0; l4 < (er ? 26 : 36); l4++) {
          let l5 = k(0, 2 * Math.PI), r4 = k(40, 200);
          eP(t3 + 10 * Math.cos(l5), a2 + 10 * Math.sin(l5), { vx: Math.cos(l5) * r4, vy: Math.sin(l5) * r4 - 20, r: k(1.5, 5.5), max: e4 ? k(6, 12) : k(1.6, 3.4), drag: 2 });
        }
        let r3 = ec.fs / 124;
        for (let e5 = 0; e5 < 11; e5++) eI.push({ k: "burst", x: t3 + k(-5, 5) * r3, y: a2 + k(-5, 5) * r3, angle: e5 / 11 * Math.PI * 2 + k(-0.22, 0.22), reach: k(38, 90) * r3, len: k(28, 48) * r3, width: k(7, 12) * r3, life: 0, max: k(0.18, 0.3), col: e5 % 3 == 0 ? "#f1d58c" : "#fff6d6" });
        eb.visible = false, ew(0, false), eb.sleep = false;
      })(s2), et && clearTimeout(et), et = null, s2 || (et = K(900, () => {
        et = null, "round" === W.mode && "round" === W.phase && eO();
      })), r2 && (eg(r2, "", ""), r2.sayUntil = 0, r2.el.classList.remove("hit", "recover"), r2.el.offsetWidth, r2.el.classList.add("hit"), r2.heartPop = t2, r2.heartPopUntil = Date.now() + 1e3, l2 ? (r2.outHold = true, K(900, () => {
        r2.outHold = false, r2.el.classList.remove("hit"), ev(r2, Date.now());
      })) : s2 || K(a.POP_FREEZE_MS + 300, () => {
        r2.el.classList.remove("hit"), r2.el.classList.add("recover"), K(1e3, () => r2.el.classList.remove("recover"));
      }));
    }, spare(e3) {
      let t2 = ex(e3);
      t2 && (t2.spareUntil = Date.now() + 700, e$(t2, "+1 \u2665 SPARE LIFE", "#ff5d8f"), K(720, () => ev(t2, Date.now())));
    }, join(e3) {
      let a2 = ex(e3);
      if (!a2 || !a2.p) return;
      eA(a2.el, "joining");
      let l2 = (0, t.getMascotCharacter)(a2.p.character);
      e$(a2, l2.blub, l2.color);
      for (let e4 = 0; e4 < 6; e4++) eP(a2.pos.x + k(-14, 14), a2.pos.y - 8, { r: k(1.5, 3.5) });
    }, win(e3, t2) {
      H.invalidate(), et && clearTimeout(et), et = null;
      let a2 = () => {
        H.invalidate();
        let a3 = ex(e3);
        if (!a3) return;
        for (let t3 of (ee = e3, eI)) "spine" === t3.k && t3.hang && (t3.hang = false, t3.max = t3.life + k(0.8, 1.6));
        X = 0, F.classList.remove("on"), a3.el.classList.remove("hit", "recover", "out"), a3.el.classList.add("win"), a3.gold = true, ev(a3, Date.now()), eO(), eb.sleep = false;
        let l2 = a3.pos.x < ec.cx - 8 ? 1 : a3.pos.x > ec.cx + 8 ? -1 : 0;
        eb.override = a3.pos.y < ec.cy - 0.3 * ec.ry ? { x: a3.pos.x + (ec.cx - a3.pos.x) * 0.35, y: a3.pos.y + 0.62 * ec.fs, face: a3.pos.x > ec.cx + 8 ? 1 : -1 } : { x: a3.pos.x + l2 * ec.fs * 0.5, y: a3.pos.y - a3.headY - 0.34 * ec.fs, face: a3.pos.x > ec.cx + 8 ? 1 : -1 }, t2 && (eb.x = eb.override.x, eb.y = eb.override.y);
      };
      t2 ? a2() : K(1200, a2);
    }, clearAnswers() {
      let e3 = Date.now();
      for (let t2 of Z) t2.rest = null, ev(t2, e3);
    }, destroy() {
      for (let e3 of (D = true, H.destroy(), Object.values(Y))) e3.onload = null;
      for (let e3 of (removeEventListener("resize", eu), ef.disconnect(), U)) clearTimeout(e3);
      U.clear(), e2.innerHTML = "", S.removeAttribute("data-short"), S.removeAttribute("data-tight");
    } };
  }, "feedMeter", 0, function(e2, t2) {
    return [...e2, { tier: t2, amt: a.METER_BY_TIER[t2] }];
  }, "meterSegHex", 0, f, "reconcileMeter", 0, function(e2, t2, l2 = a.METER_FULL) {
    let r2 = Math.max(0, Math.min(l2, t2)), s2 = e2.reduce((e3, t3) => e3 + t3.amt, 0);
    if (s2 === r2) return e2;
    if (s2 < r2) return [{ tier: null, amt: r2 - s2 }, ...e2];
    let o2 = [], n2 = 0;
    for (let t3 = e2.length - 1; t3 >= 0 && n2 < r2; t3--) {
      let a2 = Math.min(e2[t3].amt, r2 - n2);
      o2.unshift({ tier: e2[t3].tier, amt: a2 }), n2 += a2;
    }
    return o2;
  }], 61736);
}, 84956, (e) => {
  e.v({ body: "PartyHowToPlay-module__VNfVIq__body", close: "PartyHowToPlay-module__VNfVIq__close", dialog: "PartyHowToPlay-module__VNfVIq__dialog", footer: "PartyHowToPlay-module__VNfVIq__footer", header: "PartyHowToPlay-module__VNfVIq__header", panel: "PartyHowToPlay-module__VNfVIq__panel", rules: "PartyHowToPlay-module__VNfVIq__rules" });
}, 34339, (e) => {
  "use strict";
  var t = e.i(43476), a = e.i(71645), l = e.i(3823), r = e.i(46513), s = e.i(84956);
  e.s(["default", 0, function({ launcherClassName: e2 }) {
    let o = (0, a.useRef)(null), n = (0, a.useId)(), i = () => o.current?.close();
    return (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)("button", { type: "button", className: e2 ?? "pf-howto-trigger", onClick: () => {
      o.current && !o.current.open && (o.current.showModal(), (0, l.notifyModalChange)());
    }, "aria-haspopup": "dialog", children: "HOW TO PLAY" }), (0, t.jsx)("dialog", { ref: o, className: s.default.dialog, "aria-labelledby": n, onClose: l.notifyModalChange, onClick: (e3) => {
      e3.target === e3.currentTarget && i();
    }, children: (0, t.jsxs)("div", { className: s.default.panel, children: [(0, t.jsxs)("header", { className: s.default.header, children: [(0, t.jsxs)("div", { children: [(0, t.jsx)("p", { children: "PUFFER PARTY" }), (0, t.jsx)("h2", { id: n, children: "HOW TO PLAY" })] }), (0, t.jsx)("button", { type: "button", className: s.default.close, onClick: i, "aria-label": "Close how to play", children: "\xD7" })] }), (0, t.jsx)("div", { className: s.default.body, children: (0, t.jsxs)("ol", { className: s.default.rules, children: [(0, t.jsx)("li", { children: "Answer the question before the puffer explodes on you." }), (0, t.jsx)("li", { children: "Rarer answers get you closer to an extra heart." }), (0, t.jsx)("li", { children: "No reusing answers for the current question." })] }) }), (0, t.jsx)("footer", { className: `${r.default.actions} ${s.default.footer}`, children: (0, t.jsx)("button", { type: "button", className: `btn-quiet ${r.default.dismiss}`, onClick: i, children: "GOT IT" }) })] }) })] });
  }]);
}, 86897, 74588, (e) => {
  "use strict";
  function t(e2, t2, a2) {
    let l2 = e2?.players.find((e3) => e3.id === t2);
    return e2?.rated && e2.gameId && l2 && void 0 !== l2.rating && ["round", "over"].includes(e2.phase) && (l2.alive || null !== l2.place) ? { gameId: e2.gameId, at: a2 } : null;
  }
  function a(e2, t2) {
    try {
      let a2 = JSON.parse(e2 ?? "[]");
      if (!Array.isArray(a2)) return [];
      return a2.filter((e3) => !!e3 && "string" == typeof e3.gameId && e3.gameId.length < 200 && "number" == typeof e3.at && e3.at <= t2 && e3.at > t2 - 864e5).slice(-20);
    } catch {
      return [];
    }
  }
  e.s(["parsePendingRatings", 0, a, "pendingRatingFor", 0, t, "resolvePendingRatings", 0, function(e2, t2) {
    let a2 = new Map((t2?.recent ?? []).map((e3) => [e3.gameId, e3]));
    return { pending: e2.filter((e3) => !a2.has(e3.gameId)), settled: e2.flatMap((e3) => a2.has(e3.gameId) ? [a2.get(e3.gameId)] : []) };
  }], 86897);
  let l = "krillion:party:pending-ratings", r = [];
  function s() {
    try {
      return a(sessionStorage.getItem(l), Date.now());
    } catch {
      return a(JSON.stringify(r), Date.now());
    }
  }
  function o(e2) {
    r = e2;
    try {
      sessionStorage.setItem(l, JSON.stringify(e2));
    } catch {
    }
  }
  e.s(["loadPendingRatings", 0, s, "rememberLeavingRating", 0, function(e2, a2) {
    let l2 = t(e2, a2, Date.now());
    l2 && o([...s().filter((e3) => e3.gameId !== l2.gameId), l2].slice(-20));
  }, "savePendingRatings", 0, o], 74588);
}, 89744, (e) => {
  "use strict";
  var t = e.i(43476), a = e.i(36484), l = e.i(35406), r = e.i(71645), s = e.i(86968), o = e.i(37812), n = e.i(15326), i = e.i(61736);
  let d = () => () => {
  }, c = () => (0, o.loadStats)().maxStreak, h = { krill: "KRILL", schooler: "SCHOOLER", rare: "SQUID", deepcut: "ANGLER", "evil-krill": "EVIL", hackmanite: "HACKMANITE", "fossil-krill": "FOSSIL", "mantis-shrimp": "MANTIS", leviathan: "LEVIATHAN" };
  e.s(["IdentityFields", 0, function({ name: e2, onName: l2, character: o2, onCharacter: i2, onEnter: p }) {
    let u = (0, r.useSyncExternalStore)(d, c, () => 0);
    return (0, t.jsxs)(t.Fragment, { children: [(0, t.jsxs)("label", { className: "pf-field", children: [(0, t.jsx)("span", { className: "label", children: "YOUR NAME" }), (0, t.jsx)("input", { className: "ds-input", type: "text", value: e2, maxLength: n.MAX_NAME_LENGTH, autoComplete: "nickname", autoCapitalize: "off", spellCheck: false, enterKeyHint: "go", placeholder: "what the ring calls you", onChange: (e3) => l2(e3.target.value), onKeyDown: (e3) => {
      "Enter" === e3.key && p && (e3.preventDefault(), p());
    } })] }), (0, t.jsx)("div", { className: "pf-keys", role: "group", "aria-label": "Your buddy", children: s.MASCOT_CHARACTERS.map((e3) => {
      let l3 = e3.unlockStreak > u;
      return (0, t.jsxs)("button", { type: "button", className: "pf-key", disabled: l3, "aria-pressed": l3 ? void 0 : o2 === e3.id, "aria-label": l3 ? `${e3.name}, unlocks at a ${e3.unlockStreak}-day streak` : e3.name, title: l3 ? `${e3.unlockStreak}-day streak` : e3.name, onClick: () => i2(e3.id), children: [(0, t.jsx)(a.default, { src: e3.sprite, alt: "", draggable: false }), (0, t.jsx)("span", { children: h[e3.id] }), l3 && (0, t.jsxs)("small", { children: [e3.unlockStreak, "-day"] })] }, e3.id);
    }) })] });
  }, "PartyTitle", 0, function() {
    return (0, t.jsxs)("div", { className: "pf-door-title", children: [(0, t.jsx)("div", { className: "ds-title", children: "KRILLION".split("").map((e2, a2) => (0, t.jsx)("span", { style: { animationDelay: `${0.18 * a2}s` }, children: e2 }, a2)) }), (0, t.jsx)("h1", { className: "ds-tagline", children: "PUFFER PARTY" }), (0, t.jsx)("div", { className: "pf-lobby-sub", children: "pass the puffer \xB7 don't let it pop on you" })] });
  }, "default", 0, function({ children: e2 }) {
    let a2 = (0, r.useRef)(null);
    return (0, r.useEffect)(() => {
      let e3 = a2.current;
      if (!e3) return;
      let t2 = (0, i.createPufferEngine)(e3);
      return t2.sync({ mode: "door", phase: "door", players: [], meId: null, openSeats: 0, holderId: null, holderSince: null, maxLives: 2, meterTarget: n.METER_FULL, levelOverride: null }), () => t2.destroy();
    }, []), (0, t.jsx)(l.default, { phase: "preview", railMode: "left", allowAdPreview: true, keyboardBehavior: "resize", children: (0, t.jsxs)("div", { className: "ds-root pf-root", "data-phase": "preview", "data-mode": "door", "data-world": "puffer", children: [(0, t.jsxs)("div", { className: "ds-stage", children: [(0, t.jsx)("div", { ref: a2, className: "pf-world" }), (0, t.jsx)("div", { className: "ds-crt" })] }), e2] }) });
  }]);
}, 56838, (e) => {
  "use strict";
  var t = e.i(43476), a = e.i(14528), l = e.i(71645), r = e.i(18566), s = e.i(22016), o = e.i(15326), n = e.i(32358), i = e.i(86897), d = e.i(74588), c = e.i(12260), h = e.i(44252), p = e.i(89744), u = e.i(34339);
  let f = [{ code: "KRLP", hostName: "INKJET", players: 4, maxPlayers: o.DEFAULT_SETTINGS.maxPlayers, phase: "lobby" }, { code: "WXYZ", hostName: "LANTERNJAW", players: 6, maxPlayers: 6, phase: "round" }, { code: "BQMN", hostName: "glubtron", players: 2, maxPlayers: 8, phase: "lobby" }], m = { duel: "one on one", trio: "three at a table", party: "4 to 6 players", crowd: "8 to 10 players" }, y = { rating: { rating: 1342, games: 7, wins: 3, peak: 1360, recent: [] }, account: false, merged: 0 }, x = Array.from({ length: 63 }, (e2, t2) => ({ ...f[t2 % f.length], code: `AA${String.fromCharCode(65 + Math.floor(t2 / 26))}${String.fromCharCode(65 + t2 % 26)}` })), g = "2 to 16 letters, numbers or spaces";
  function v(e2, t2) {
    return e2 instanceof h.PartyError ? 404 === e2.status && t2 ? `no room ${t2}` : 0 === e2.status ? "no signal. try again" : e2.message : "something went wrong";
  }
  function M(e2, t2) {
    let a2 = (0, h.seatedElsewhere)(e2);
    return { msg: v(e2, t2), ...a2 ? { room: a2 } : {} };
  }
  function b({ failure: e2, disabled: a2 = false, onLeave: l2 }) {
    return (0, t.jsxs)("div", { className: "pf-err", children: [e2.msg, e2.room && (0, t.jsxs)("button", { type: "button", className: "pf-confirm-leave", disabled: a2, onClick: l2, children: ["LEAVE ROOM ", e2.room, " AND CONTINUE"] })] });
  }
  function w() {
    let e2 = (0, a.usePartyAdmin)(), v2 = (0, r.useSearchParams)().get("preview"), w2 = null !== v2, N = (0, r.useRouter)(), k = (0, h.usePartyName)(), I = (0, c.usePreferences)(), [P, j] = (0, l.useState)(null), [S, L] = (0, l.useState)(null), E = (0, h.usePartyCharacter)(), C = P ?? k, T = S ?? E ?? I.character, R = (0, h.useQuickPlaySize)(), [$, A] = (0, l.useState)(null), [O, F] = (0, l.useState)(0), [_, z] = (0, l.useState)([]), H = w2 ? y : $, [q, D] = (0, l.useState)(false), [U, K] = (0, l.useState)(""), [V, Y] = (0, l.useState)(null), [B, W] = (0, l.useState)(null), [G, Z] = (0, l.useState)(null), [J, Q] = (0, l.useState)(1), [X, ee] = (0, l.useState)(false), [et, ea] = (0, l.useState)(false), el = "rooms" === v2 ? x : f, er = w2 ? el.slice(0, J * o.PUBLIC_ROOM_PAGE_SIZE) : G?.rooms ?? null, es = w2 ? el.length > J * o.PUBLIC_ROOM_PAGE_SIZE : !!G?.nextCursor;
    (0, l.useEffect)(() => {
      if (w2) return;
      (0, h.warmPartyIdentity)();
      let e3 = true, t2 = false, a2 = async () => {
        if (!t2 && !document.hidden) {
          t2 = true, F((0, d.loadPendingRatings)().length);
          try {
            let t3 = await (0, h.myRating)();
            if (!e3) return;
            A(t3);
            let a3 = (0, i.resolvePendingRatings)((0, d.loadPendingRatings)(), t3?.rating ?? null);
            (0, d.savePendingRatings)(a3.pending), F(a3.pending.length), a3.settled.length && z((e4) => [...e4, ...a3.settled].filter((e5, t4, a4) => a4.findIndex((t5) => t5.gameId === e5.gameId) === t4));
          } catch {
          } finally {
            t2 = false;
          }
        }
      };
      a2();
      let l2 = setInterval(() => {
        let e4 = (0, d.loadPendingRatings)();
        F(e4.length), e4.length && a2();
      }, 5e3), r2 = () => {
        a2();
      };
      return window.addEventListener("focus", r2), document.addEventListener("visibilitychange", r2), () => {
        e3 = false, clearInterval(l2), window.removeEventListener("focus", r2), document.removeEventListener("visibilitychange", r2);
      };
    }, [w2]), (0, l.useEffect)(() => {
      let e3;
      if (w2) return;
      let t2 = true, a2 = new AbortController(), l2 = async () => {
        try {
          let e4 = await (0, h.listRoomPages)(J, a2.signal);
          if (!t2) return;
          Z(e4), ea(false);
        } catch {
          t2 && ea(true);
        } finally {
          t2 && (ee(false), e3 = setTimeout(l2, 5e3));
        }
      };
      return l2(), () => {
        t2 = false, a2.abort(), clearTimeout(e3);
      };
    }, [w2, J]);
    let eo = () => {
      let e3 = (0, o.normalizeName)(C);
      return e3 || W({ where: "name", msg: g }), e3;
    }, en = async (e3, t2 = false) => {
      let a2 = eo();
      if (a2 && !V && !w2) {
        Y(e3 ? "rated" : "quick"), W(null);
        try {
          let l2 = await (0, h.quickPlay)({ name: a2, character: T, size: R, rated: e3, ...t2 ? { replace: t2 } : {} });
          if (l2.stay) throw Error("no seat");
          (0, h.savePartyName)(a2), (0, h.saveSeat)(l2.code, { playerId: l2.playerId, playerKey: l2.playerKey, name: a2, character: T }), N.push(`/party/${l2.code}`);
        } catch (t3) {
          W({ where: "quick", ask: { kind: "quick", rated: e3 }, ...M(t3) }), Y(null);
        }
      }
    }, ei = async (e3 = false) => {
      let t2 = eo();
      if (t2 && !V && !w2) {
        Y("host"), W(null);
        try {
          let a2 = await (0, h.createRoom)({ name: t2, character: T, isPrivate: q, ...e3 ? { replace: e3 } : {} });
          (0, h.savePartyName)(t2), (0, h.saveSeat)(a2.code, { playerId: a2.playerId, playerKey: a2.playerKey, name: t2, character: T }), N.push(`/party/${a2.code}`);
        } catch (e4) {
          W({ where: "host", ask: { kind: "host" }, ...M(e4) }), Y(null);
        }
      }
    }, ed = async (e3, t2, a2 = false) => {
      let l2 = (0, h.normalizeCode)(e3);
      if (!l2) return void W({ where: t2, msg: "room codes are 4 letters" });
      if ((0, h.loadSeat)(l2)) return void N.push(`/party/${l2}`);
      let r2 = eo();
      if (r2 && !V && !w2) {
        Y(l2), W(null);
        try {
          let e4 = await (0, h.joinRoom)(l2, { name: r2, character: T, ...a2 ? { replace: a2 } : {} });
          (0, h.savePartyName)(r2), (0, h.saveSeat)(l2, { playerId: e4.playerId, playerKey: e4.playerKey, name: r2, character: T }), N.push(`/party/${l2}`);
        } catch (e4) {
          W({ where: t2, ask: { kind: "join", code: l2, where: t2 }, ...M(e4, l2) }), Y(null);
        }
      }
    }, ec = (e3) => B?.where === e3 ? (0, t.jsx)(b, { failure: B, disabled: !!V, onLeave: () => {
      var e4;
      return e4 = B.ask, void (e4?.kind === "quick" ? en(e4.rated, true) : e4?.kind === "host" ? ei(true) : e4 && ed(e4.code, e4.where, true));
    } }) : null;
    return (0, t.jsxs)("div", { className: "pf-door-cols", children: [(0, t.jsxs)("div", { className: "pf-door-col", children: [(0, t.jsxs)("div", { className: "pf-panel", children: [(0, t.jsxs)("div", { className: "pf-panel-heading", children: [(0, t.jsx)("h3", { children: "WHO'S PLAYING" }), (0, t.jsx)(u.default, {})] }), (0, t.jsx)(p.IdentityFields, { name: C, onName: (e3) => {
      j(e3), B?.where === "name" && W(null);
    }, character: T, onCharacter: (e3) => {
      L(e3), (0, h.savePartyCharacter)(e3);
    }, onEnter: () => en(false) }), ec("name")] }), (0, t.jsxs)("div", { className: "pf-panel pf-quick", children: [(0, t.jsxs)("div", { className: "pf-panel-heading", children: [(0, t.jsx)("h3", { children: "PLAY NOW" }), H?.rating && (0, t.jsxs)("span", { className: "pf-my-rating", title: `${H.rating.games} rated ${1 === H.rating.games ? "game" : "games"} \xB7 ${H.rating.wins} ${1 === H.rating.wins ? "win" : "wins"} \xB7 best ${H.rating.peak}`, children: ["RATING ", (0, t.jsx)("b", { children: (0, n.formatRating)(H.rating.rating) })] })] }), (O > 0 || _.length > 0) && (0, t.jsxs)("div", { className: "pf-rating-return", role: "status", children: [_.map((e3) => (0, t.jsxs)("div", { className: "pf-rating-change", children: ["Previous rated game: ", (0, t.jsxs)("i", { className: e3.delta > 0 ? "up" : e3.delta < 0 ? "down" : void 0, children: [e3.delta > 0 ? `+${e3.delta}` : e3.delta < 0 ? e3.delta : "\xB10", " Elo"] })] }, e3.gameId)), O > 0 && (0, t.jsx)("p", { className: "pf-hint", children: "Updating your rating\u2026 Your Elo change will appear here." })] }), (0, t.jsx)("div", { className: "pf-sizes", role: "radiogroup", "aria-label": "Table size", children: o.QUICK_PLAY_SIZES.map((e3) => (0, t.jsx)("button", { type: "button", role: "radio", "aria-checked": e3 === R, className: "pf-size", disabled: !!V, onClick: () => (0, h.saveQuickPlaySize)(e3), children: o.QUICK_PLAY_TABLES[e3].label }, e3)) }), (0, t.jsx)("span", { className: "pf-hint pf-size-hint", children: m[R] }), (0, t.jsxs)("div", { className: "pf-modes", children: [(0, t.jsxs)("div", { className: "pf-mode", children: [(0, t.jsx)("button", { type: "button", className: "ds-begin-btn", disabled: !!V, onClick: () => en(true), children: "rated" === V ? "FINDING\u2026" : (0, t.jsx)(t.Fragment, { children: "\u25B6 RATED \u25C0" }) }), (0, t.jsx)("span", { className: "pf-hint", children: "near your rating \xB7 it moves" })] }), (0, t.jsxs)("div", { className: "pf-mode pf-mode-casual", children: [(0, t.jsx)("button", { type: "button", className: "ds-begin-btn", disabled: !!V, onClick: () => en(false), children: "quick" === V ? "FINDING\u2026" : (0, t.jsx)(t.Fragment, { children: "QUICK PLAY" }) }), (0, t.jsx)("span", { className: "pf-hint", children: "unrated \xB7 just for fun" })] })] }), H?.rating && (0, t.jsx)("span", { className: "pf-hint pf-rating-home", children: H.merged > 0 ? `${H.merged} ${1 === H.merged ? "game" : "games"} from this browser added to your Google account` : H.account ? "your rating is saved to your Google account" : (0, t.jsxs)(t.Fragment, { children: ["your rating is saved on this browser \xB7 ", (0, t.jsx)(s.default, { href: "/account", children: "sign in" }), " to keep it everywhere"] }) }), ec("quick")] }), (0, t.jsxs)("div", { className: "pf-panel pf-host-panel", children: [(0, t.jsx)("h3", { children: "HOST" }), (0, t.jsx)("button", { type: "button", className: "ds-begin-btn", disabled: "host" === V, onClick: () => ei(), children: "host" === V ? "OPENING\u2026" : (0, t.jsx)(t.Fragment, { children: "\u25BC HOST A ROOM \u25BC" }) }), (0, t.jsxs)("div", { className: "pf-host-row", children: [(0, t.jsx)("button", { type: "button", className: "pf-privacy", "aria-pressed": q, onClick: () => D((e3) => !e3), children: q ? "PRIVATE \xB7 CODE ONLY" : "PUBLIC \xB7 LISTED" }), (0, t.jsx)("span", { className: "pf-hint", children: q ? "friends join with the code" : "anyone can join from the list" })] }), ec("host")] }), (0, t.jsxs)("div", { className: "pf-panel", children: [(0, t.jsx)("h3", { children: "JOIN BY CODE" }), (0, t.jsxs)("div", { className: "pf-code-row", children: [(0, t.jsx)("input", { className: "ds-input", type: "text", value: U, maxLength: 4, autoComplete: "off", autoCapitalize: "characters", spellCheck: false, enterKeyHint: "go", placeholder: "KRLP", "aria-label": "Room code", onChange: (e3) => K(e3.target.value.toUpperCase().replace(/[^A-Z]/g, "")), onKeyDown: (e3) => {
      "Enter" === e3.key && (e3.preventDefault(), ed(U, "code"));
    } }), (0, t.jsx)("button", { type: "button", className: "ds-dive-btn", disabled: 4 !== U.length || !!V, onClick: () => ed(U, "code"), children: "JOIN" })] }), ec("code")] })] }), (0, t.jsx)("div", { className: "pf-door-col", children: (0, t.jsxs)("div", { className: "pf-panel", children: [(0, t.jsxs)("h3", { children: ["PUBLIC ROOMS ", er && er.length > 0 && (0, t.jsxs)("small", { "aria-live": "polite", children: ["SHOWING ", er.length] })] }), (0, t.jsxs)("div", { className: "pf-rooms", children: [null === er && !et && (0, t.jsx)("div", { className: "pf-empty", children: "listening for rooms\u2026" }), et && null === er && (0, t.jsx)("div", { className: "pf-empty", children: "can't reach the rooms right now" }), er && 0 === er.length && (0, t.jsx)("div", { className: "pf-empty", children: "no open rooms right now. host one" }), er?.map((a2) => {
      let l2 = a2.players >= a2.maxPlayers;
      return (0, t.jsxs)("button", { type: "button", className: "pf-room", disabled: l2 && (!e2 || a2.rated) || !!V, onClick: () => ed(a2.code, "list"), children: [(0, t.jsx)("span", { className: "c", children: a2.code }), (0, t.jsx)("span", { className: "h", children: a2.hostName }), (0, t.jsxs)("span", { className: "s" + ("lobby" === a2.phase ? "" : " playing"), children: [a2.players, "/", a2.maxPlayers, " \xB7 ", "lobby" === a2.phase ? "IN THE LOBBY" : "PLAYING"] }), (0, t.jsx)("span", { className: "go", children: V === a2.code ? "\u2026" : l2 ? e2 && !a2.rated ? "WATCH \u25B8" : "FULL" : "JOIN \u25B8" })] }, a2.code);
    })] }), es && (0, t.jsx)("button", { type: "button", className: "pf-privacy pf-load-more", disabled: X, onClick: () => {
      w2 || ee(true), Q((e3) => e3 + 1);
    }, children: X ? "LOADING\u2026" : "LOAD MORE" }), et && null !== er && (0, t.jsx)("div", { className: "pf-err", role: "status", children: "Couldn't update the rooms. Retrying\u2026" }), ec("list")] }) })] });
  }
  e.s(["JoinError", 0, b, "default", 0, function() {
    return (0, t.jsx)(p.default, { children: (0, t.jsxs)("div", { className: "pf-door", children: [(0, t.jsx)(p.PartyTitle, {}), (0, t.jsx)("p", { className: "pf-door-description", children: "Krillion's multiplayer category game. Name an answer and pass the puffer before it pops. Play with friends or join a public room. Last one floating wins." }), (0, t.jsx)("div", { className: "pf-door-gap" }), (0, t.jsx)(l.Suspense, { fallback: (0, t.jsx)("p", { className: "pf-door-description", role: "status", children: "Loading rooms\u2026" }), children: (0, t.jsx)(w, {}) })] }) });
  }, "errorText", 0, v, "joinFailure", 0, M, "nameHelp", 0, g]);
}]);
