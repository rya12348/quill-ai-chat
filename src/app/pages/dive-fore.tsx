import { useEffect, useRef } from 'react'

/**
 * The foreground layer of the dive: the depth ruler down the right edge and the
 * fish that drift past. The shipped game paints these on a second canvas above
 * the world (`ds-fore`); without it the water looks empty no matter how right
 * the card and the dock are.
 *
 * Both drawings are ported from the game's own painter: ticks every 10 metres
 * (16 px at hundreds, 10 at fifties, 5 otherwise), labels every 100, a pink
 * marker where the diver is, a nine-fish school at 85 m, and four fish that
 * wander within ±180 m of wherever the diver has got to.
 */

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Screen position of the world's top edge, read from the element that scrolls. */
function worldCamera(canvas: HTMLCanvasElement): number {
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

/** A fish: ellipse body plus a triangular tail, the shape the game draws. */
function fish(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: number) {
  ctx.beginPath()
  ctx.ellipse(x, y, size, 0.45 * size, 0, 0, 7)
  ctx.moveTo(x - dir * size, y)
  ctx.lineTo(x - dir * size * 1.7, y - 0.5 * size)
  ctx.lineTo(x - dir * size * 1.7, y + 0.5 * size)
  ctx.closePath()
  ctx.fill()
}

export function Fore({ depthRef }: { depthRef: { current: number } }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()

    const drifters = Array.from({ length: 4 }, () => ({
      x: rnd(0, 400),
      dOff: rnd(-180, 180),
      sp: rnd(14, 34) * (Math.random() < 0.5 ? -1 : 1),
      s: rnd(7, 14),
      ph: rnd(0, 9),
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

    const paint = (now: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      const depth = depthRef.current
      const camera = worldCamera(canvas)
      /** Screen y of a depth in metres. */
      const ey = (metres: number) => camera + metres * 2

      ctx.clearRect(0, 0, w, h)

      // The school that lives at 85 m.
      if (ey(85) > -120 && ey(85) < h + 120) {
        ctx.fillStyle = 'rgba(4,9,18,0.85)'
        for (let i = 0; i < 9; i += 1) {
          fish(ctx, ((26 * t + 46 * i + i * i * 7) % (w + 360)) - 180, ey(85) + 12 * Math.sin(2 * t + i) + (i % 3) * 14, 8, 1)
        }
      }

      // The four that follow the diver, a little above or below.
      ctx.fillStyle = 'rgba(4,9,18,0.85)'
      for (const one of drifters) {
        one.x += one.sp * dt
        if (one.x > w + 60) {
          one.x = -60
          one.dOff = rnd(-200, 200)
        }
        if (one.x < -60) {
          one.x = w + 60
          one.dOff = rnd(-200, 200)
        }
        if (depth + one.dOff > 20) {
          fish(ctx, one.x, ey(depth + one.dOff) + 10 * Math.sin(t + one.ph), one.s, Math.sign(one.sp))
        }
      }

      // The ruler down the right edge.
      // The ruler hangs off the ad box's right edge, the way the shipped page
      // draws it; the canvas itself overscans the rails, so its own width would
      // park the ticks out in the margin.
      const canvasBox = canvas.getBoundingClientRect()
      const stageBox = canvas.parentElement?.getBoundingClientRect()
      const r = (stageBox ? stageBox.right : canvasBox.right) - canvasBox.left - 14
      ctx.strokeStyle = 'rgba(125,147,184,.55)'
      ctx.lineWidth = 2
      ctx.font = '13px VT323, ui-monospace, monospace'
      ctx.textAlign = 'right'
      const surface = Math.max(0, ey(0))
      if (surface < h) {
        ctx.beginPath()
        ctx.moveTo(r, surface)
        ctx.lineTo(r, h)
        ctx.stroke()
      }
      const marker = ey(Math.max(0, depth))
      const top = Math.max(0, 10 * Math.floor((0 - camera) / 2 / 10))
      const bottom = (h - camera) / 2
      for (let metres = top; metres <= bottom; metres += 10) {
        const y = ey(metres)
        if (y < -4 || y > h + 4) continue
        const tick = metres % 100 === 0 ? 16 : metres % 50 === 0 ? 10 : 5
        ctx.beginPath()
        ctx.moveTo(r - tick, y)
        ctx.lineTo(r, y)
        ctx.stroke()
        if (metres % 100 === 0 && !(depth > 0 && Math.abs(y - marker) < 14)) {
          ctx.fillStyle = 'rgba(125,147,184,.95)'
          ctx.fillText(metres === 0 ? '0m' : `-${metres.toLocaleString('en-US')}m`, r - tick - 5, y + 4)
        }
      }
      if (marker > -20 && marker < h + 20 && depth > 0) {
        ctx.fillStyle = '#ff5d8f'
        ctx.beginPath()
        ctx.moveTo(r + 4, marker)
        ctx.lineTo(r + 12, marker - 5)
        ctx.lineTo(r + 12, marker + 5)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,93,143,.85)'
        ctx.beginPath()
        ctx.moveTo(r - 20, marker)
        ctx.lineTo(r + 4, marker)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,93,143,.9)'
        ctx.fillText('YOU', r - 24, marker + 4)
      }

      raf = requestAnimationFrame(paint)
    }
    // One paint before the loop so the ruler is there even if the first frame
    // is held back (a background tab, a slow first layout).
    paint(performance.now())
    raf = requestAnimationFrame(paint)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [depthRef])

  return <canvas className="ds-fore" ref={canvasRef} aria-hidden />
}
