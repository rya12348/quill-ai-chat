import { useEffect, useRef } from 'react'

/**
 * The water behind the dive, painted the way the shipped game paints it: a
 * gradient that darkens with depth, the seamount's parallax bands, the sky and
 * the little boat on the waterline, then marine snow drifting past.
 *
 * `depthRef` is metres below the surface and `anchorRef` is where the world's
 * y=0 sits on screen, so the painter can place the waterline without knowing
 * anything about the React tree.
 */

const STOPS: [number, string][] = [
  [0, '#1d5580'],
  [150, '#123a5e'],
  [350, '#0b1526'],
  [800, '#081020'],
  [1400, '#050a14'],
  [2600, '#03070f'],
  [5200, '#02050b'],
]

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The water's colour at a depth, interpolated between the shipped stops. */
function seaColor(metres: number): [number, number, number] {
  const m = Math.max(0, metres)
  for (let i = STOPS.length - 1; i >= 0; i -= 1) {
    const [depth, color] = STOPS[i]
    if (m >= depth) {
      const next = STOPS[i + 1]
      if (!next) return rgb(color)
      const t = Math.min(1, (m - depth) / (next[0] - depth))
      const a = rgb(color)
      const b = rgb(next[1])
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
    }
  }
  return rgb(STOPS[0][1])
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function shade(color: [number, number, number], factor: number): string {
  return `rgb(${clampChannel(color[0] * factor)}, ${clampChannel(color[1] * factor)}, ${clampChannel(color[2] * factor)})`
}

/** A fish silhouette — the shipped `ty` shape: an ellipse with a triangular tail. */
function fishShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  dir: number,
): void {
  ctx.beginPath()
  ctx.ellipse(x, y, size, 0.45 * size, 0, 0, 7)
  ctx.moveTo(x - dir * size, y)
  ctx.lineTo(x - dir * size * 1.7, y - 0.5 * size)
  ctx.lineTo(x - dir * size * 1.7, y + 0.5 * size)
  ctx.closePath()
  ctx.fill()
}

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function Sea({ depthRef }: { depthRef: { current: number } }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const asset = (src: string) => {
      const image = new Image()
      image.src = src
      return image
    }
    const sky = asset('/dive/bg-sky.webp')
    const skyTop = asset('/dive/bg-sky-upper-clean.webp')
    const bandTop = asset('/dive/bg-top.webp')
    const bandMid = asset('/dive/bg-mid.webp')
    const bandTrench = asset('/dive/bg-trench.webp')
    // The four fish that wander within ±180 m of wherever the diver has got to.
    const drifters = Array.from({ length: 4 }, () => ({
      x: Math.random() * (canvas.clientWidth || 375),
      dOff: rnd(-180, 180),
      sp: rnd(14, 34) * (Math.random() < 0.5 ? -1 : 1),
      s: rnd(7, 14),
      ph: 9 * Math.random(),
    }))
    const dust = Array.from({ length: 64 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 1.9,
      v: 0.00004 + Math.random() * 0.00016,
      a: 0.06 + Math.random() * 0.24,
    }))
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    /** Where the world is on screen right now, read from the element that
     *  actually carries the dive's scroll, so the painter can never disagree
     *  with the card and the title about where the waterline is. */
    const worldCamera = () => {
      const world = canvas.parentElement?.querySelector('.ds-world')
      if (!world) return 0
      const transform = getComputedStyle(world).transform
      if (!transform || transform === 'none') return 0
      try {
        return new DOMMatrixReadOnly(transform).m42
      } catch {
        return 0
      }
    }

    /** One of the seamount's painted bands, tiled inside its depth range. */
    const paintBand = (image: HTMLImageElement, from: number, to: number, alpha: number) => {
      if (!image.complete || !image.naturalWidth) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const tile = (w * image.naturalHeight) / image.naturalWidth
      const camera = worldCamera()
      const y1 = camera + from * 2
      const y2 = camera + to * 2
      const top = Math.max(y1, 0)
      const bottom = Math.min(y2, h)
      if (bottom <= top || !tile) return
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, top, w, bottom - top)
      ctx.clip()
      ctx.globalAlpha = alpha
      const start = y1 + Math.floor(Math.max(0, -y1) / tile) * tile
      for (let y = start; y < y2; y += tile) ctx.drawImage(image, 0, y, w, tile + 1)
      ctx.restore()
    }

    let last = performance.now()
    const paint = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) {
        raf = requestAnimationFrame(paint)
        return
      }
      const depth = depthRef.current
      const anchor = worldCamera()
      const top = seaColor(depth)
      // The shipped painter reads its ramp across a quarter of the frame either
      // side of the camera — not across the whole column — which is why the
      // water goes dark within a screen of the surface.
      const cameraDepth = h / 4 - anchor / 2
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, shade(seaColor(Math.max(0, cameraDepth - h / 4)), 1))
      grad.addColorStop(0.5, shade(seaColor(Math.max(0, cameraDepth)), 1))
      grad.addColorStop(1, shade(seaColor(Math.max(0, cameraDepth + h / 4)), 1))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      paintBand(bandTop, 40, 470, 0.45)
      paintBand(bandMid, 480, 2620, 0.5)
      paintBand(bandTrench, 2950, 7060, 0.55)

      // Sky, boat and the waterline, while the surface is still in shot.
      const surface = anchor
      if (surface > -420) {
        if (sky.complete && sky.naturalWidth) {
          const sh = (w * sky.naturalHeight) / sky.naturalWidth
          const sy = surface + 6 - sh
          if (sy > 0) {
            ctx.fillStyle = '#81cbe8'
            ctx.fillRect(0, 0, w, sy + 1)
          }
          ctx.drawImage(sky, 0, sy, w, sh)
          if (skyTop.complete && skyTop.naturalWidth) {
            const scale = w / skyTop.naturalWidth
            const sy2 = sy - (skyTop.naturalHeight - 136) * scale
            ctx.drawImage(skyTop, 0, sy2, w, skyTop.naturalHeight * scale)
          }
        } else {
          const fallback = ctx.createLinearGradient(0, surface - 400, 0, surface)
          fallback.addColorStop(0, '#8fd0f0')
          fallback.addColorStop(1, '#d8f0ff')
          ctx.fillStyle = fallback
          ctx.fillRect(0, 0, w, Math.max(0, surface))
        }

        // The shipped art carries its sun in the top-right of the sky, but the
        // copy Ink paints is a squarer crop, so the sun is off the top of the
        // frame. It is drawn back here at the shipped corner: a blocky disc
        // half out of shot with its glow spilling down over the clouds.
        const sunX = w * 0.855
        const sunY = surface - 460
        const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 165)
        glow.addColorStop(0, 'rgba(255,238,176,0.9)')
        glow.addColorStop(0.4, 'rgba(255,228,145,0.34)')
        glow.addColorStop(1, 'rgba(255,228,145,0)')
        ctx.fillStyle = glow
        ctx.fillRect(sunX - 165, sunY - 165, 330, 330)
        ctx.fillStyle = '#ffe08a'
        ctx.fillRect(sunX - 27, sunY - 40, 54, 80)
        ctx.fillRect(sunX - 40, sunY - 27, 80, 54)
        ctx.fillStyle = '#f8cf78'
        ctx.fillRect(sunX - 34, sunY + 27, 68, 7)
        ctx.fillRect(sunX + 27, sunY - 34, 7, 68)

        // The swell: a lit crest with the water's own colour filled beneath.
        ctx.beginPath()
        ctx.moveTo(0, surface)
        for (let x = 0; x <= w; x += 8) {
          ctx.lineTo(x, surface + 3 * Math.sin(0.02 * x) + 2.4 * Math.sin(0.011 * x))
        }
        ctx.lineTo(w, surface + 30)
        ctx.lineTo(0, surface + 30)
        ctx.closePath()
        ctx.fillStyle = shade(top, 1)
        ctx.fill()
        ctx.beginPath()
        for (let x = 0; x <= w; x += 8) {
          const y = surface + 3 * Math.sin(0.02 * x) + 2.4 * Math.sin(0.011 * x)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = 'rgba(232,241,255,.6)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Sunlight only reaches the first few hundred metres.
      const light = Math.max(0, 1 - depth / 620)
      if (light > 0) {
        ctx.save()
        ctx.globalAlpha = 0.12 * light
        for (let i = 0; i < 5; i += 1) {
          const x = (w / 5) * (i + 0.5) + Math.sin(i * 2.1) * 24
          const shaft = ctx.createLinearGradient(x, 0, x + 90, h * 0.85)
          shaft.addColorStop(0, 'rgba(190,232,255,0.85)')
          shaft.addColorStop(1, 'rgba(190,232,255,0)')
          ctx.fillStyle = shaft
          ctx.beginPath()
          ctx.moveTo(x - 40, 0)
          ctx.lineTo(x + 40, 0)
          ctx.lineTo(x + 150, h)
          ctx.lineTo(x + 20, h)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      for (const flake of dust) {
        flake.y -= flake.v * 16 * (1 + depth / 900)
        if (flake.y < -0.02) {
          flake.y = 1.02
          flake.x = Math.random()
        }
        ctx.fillStyle = `rgba(214,238,255,${flake.a})`
        ctx.beginPath()
        ctx.arc(flake.x * w, flake.y * h, flake.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // The creature layer, above the snow and in the shipped order: the school
      // at 85 m, the siphonophore bloom at 800 m, the anglerfish at 980 m, the
      // Titanic at 3800 m, the cusk eels at 4400 m, then the four wanderers.
      // Every one of them is canvas geometry in the game's own painter — there
      // are no sprite files for them to copy.
      const seconds = now / 1000
      const cameraMetres = cameraDepth
      /** True while a depth is in shot (the shipped `tM`). */
      const inShot = (metres: number, margin: number) => {
        const y = anchor + metres * 2
        return y > -margin && y < h + margin
      }

      if (inShot(85, 80)) {
        ctx.fillStyle = 'rgba(4,9,18,0.85)'
        for (let i = 0; i < 9; i += 1) {
          fishShape(
            ctx,
            ((26 * seconds + 46 * i + i * i * 7) % (w + 360)) - 180,
            anchor + 170 + 12 * Math.sin(2 * seconds + i) + (i % 3) * 14,
            8,
            1,
          )
        }
      }

      if (inShot(800, 120)) {
        for (let i = 0; i < 22; i += 1) {
          const x = 0.12 * w + 0.034 * w * i
          const y = anchor + 1600 + 22 * Math.sin(0.7 * seconds + 0.55 * i)
          const alpha = 0.25 + 0.2 * Math.sin(3 * seconds + i)
          ctx.fillStyle = `rgba(77,227,255,${Math.max(0.06, alpha)})`
          ctx.beginPath()
          ctx.arc(x, y, 2.2, 0, 7)
          ctx.fill()
        }
      }

      if (inShot(980, 80)) {
        for (let i = 0; i < 6; i += 1) {
          const x = ((14 * seconds + 110 * i) % (w + 200)) - 100
          const y = anchor + 1960 + 20 * Math.sin(seconds + 2 * i) + 8 * i
          ctx.fillStyle = 'rgba(4,9,18,0.85)'
          fishShape(ctx, x, y, 5, -1)
          ctx.fillStyle = `rgba(232,241,255,${0.25 + 0.25 * Math.sin(5 * seconds + i)})`
          ctx.fillRect(x - 1, y - 1, 2, 2)
        }
      }

      if (inShot(3800, 160)) {
        ctx.fillStyle = 'rgba(4,9,18,0.9)'
        ctx.save()
        ctx.translate(0.5 * w, anchor + 7600)
        ctx.rotate(0.06)
        ctx.fillRect(-110, -8, 140, 22)
        ctx.beginPath()
        ctx.moveTo(-110, -8)
        ctx.lineTo(-132, 14)
        ctx.lineTo(-110, 14)
        ctx.closePath()
        ctx.fill()
        for (let i = 0; i < 3; i += 1) ctx.fillRect(-92 + 34 * i, -22, 8, 14)
        ctx.fillRect(58, -4, 60, 18)
        ctx.restore()
      }

      if (inShot(4400, 80)) {
        for (let i = 0; i < 8; i += 1) {
          const x = (0.13 * i + 0.05) * w + 14 * Math.sin(0.8 * seconds + 2 * i)
          const y = anchor + 8800 + 18 * Math.sin(1.3 * seconds + i) + (i % 3) * 10
          ctx.fillStyle = `rgba(255,93,143,${0.15 + 0.2 * Math.sin(4 * seconds + 3 * i)})`
          ctx.fillRect(x, y, 2, 2)
        }
      }

      ctx.fillStyle = 'rgba(4,9,18,0.7)'
      for (const one of drifters) {
        one.x += one.sp * dt
        if (one.sp > 0 && one.x > w + 60) {
          one.x = -60
          one.dOff = rnd(-200, 200)
        }
        if (one.sp < 0 && one.x < -60) {
          one.x = w + 60
          one.dOff = rnd(-200, 200)
        }
        if (cameraMetres + one.dOff > 20) {
          fishShape(
            ctx,
            one.x,
            anchor + 2 * (cameraMetres + one.dOff) + 10 * Math.sin(seconds + one.ph),
            one.s,
            Math.sign(one.sp),
          )
        }
      }

      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [depthRef])

  return <canvas className="ds-sea" ref={canvasRef} aria-hidden />
}
