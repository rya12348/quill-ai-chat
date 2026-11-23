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

    const paint = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) {
        raf = requestAnimationFrame(paint)
        return
      }
      const depth = depthRef.current
      const anchor = worldCamera()
      const top = seaColor(depth)
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, shade(top, 1))
      grad.addColorStop(1, shade(seaColor(depth + 1200), 0.7))
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
