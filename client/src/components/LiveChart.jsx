import { useEffect, useRef } from 'react'

// Scrolling line chart of one field of the 'trace' messages, drawn straight to
// a canvas: points arrive ~30/s, far too often to go through React state.
// Points are [tMs, value, confidence?]. With minConfidence set, stretches below
// it are drawn faded. minSpan stops the y-axis zooming in on tiny wobbles.
export default function LiveChart({ subscribe, field, color, windowMs = 10000, minSpan = 0, minConfidence, className }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let points = []
    let raf = 0

    const draw = () => {
      raf = 0
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (points.length < 2) return

      let min = Infinity
      let max = -Infinity
      for (const p of points) {
        if (p[1] < min) min = p[1]
        if (p[1] > max) max = p[1]
      }
      const pad = Math.max(0, minSpan - (max - min)) / 2
      min -= pad
      max += pad
      const span = max - min || 1
      // The newest point sits on the right edge; older ones scroll left.
      const end = points[points.length - 1][0]
      const x = (t) => w - ((end - t) / windowMs) * w
      const y = (v) => h - 3 - ((v - min) / span) * (h - 6)

      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.strokeStyle = color
      let faded = null
      for (const p of points) {
        const px = x(p[0])
        const py = y(p[1])
        const isFaded = minConfidence != null && (p[2] ?? 0) < minConfidence
        if (isFaded === faded) {
          ctx.lineTo(px, py)
          continue
        }
        if (faded !== null) {
          ctx.lineTo(px, py)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.globalAlpha = isFaded ? 0.3 : 1
        ctx.moveTo(px, py)
        faded = isFaded
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    const schedule = () => {
      raf ||= requestAnimationFrame(draw)
    }

    const unsubscribe = subscribe((msg) => {
      const incoming = msg[field]
      if (!incoming?.length) return
      for (const p of incoming) {
        const last = points[points.length - 1]
        // Timestamps jump backwards when the stream restarts; start over.
        if (last && p[0] < last[0] - 2000) points = []
        else if (last && p[0] <= last[0]) continue
        points.push(p)
      }
      const cutoff = points[points.length - 1][0] - windowMs
      let drop = 0
      while (points[drop][0] < cutoff) drop++
      if (drop) points = points.slice(drop)
      schedule()
    })
    const resize = new ResizeObserver(schedule)
    resize.observe(canvas)

    return () => {
      unsubscribe()
      resize.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [subscribe, field, color, windowMs, minSpan, minConfidence])

  return <canvas ref={canvasRef} className={className} />
}
