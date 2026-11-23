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

export function Fore({ depthRef }: { depthRef: { current: number } }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const paint = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const depth = depthRef.current
      const camera = worldCamera(canvas)
      /** Screen y of a depth in metres. */
      const ey = (metres: number) => camera + metres * 2

      ctx.clearRect(0, 0, w, h)

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
    paint()
    raf = requestAnimationFrame(paint)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [depthRef])

  return <canvas className="ds-fore" ref={canvasRef} aria-hidden />
}
