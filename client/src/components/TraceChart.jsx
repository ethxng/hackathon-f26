import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js/auto'

// Thin out old points once a whole-session chart gets this long.
const MAX_POINTS = 6000

// Live line chart of one trace series, set up like the charts in Presage's
// electron-quickstart: every point Presage sends, x = seconds since the session
// started, no animation. Points arrive ~30 times a second, so they stay out of
// React state and the chart redraws at most once per animation frame.
// With `windowSec` the chart scrolls over the last N seconds; without it the
// line grows for the whole session.
export default function TraceChart({ subscribeTraces, series, title, unit, windowSec, color }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const tick = { color: '#64748b', font: { size: 10 } }
    const grid = { color: 'rgba(255,255,255,0.06)' }
    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: { datasets: [{ data: [], borderColor: color, borderWidth: 1.5, pointRadius: 0, tension: 0 }] },
      options: {
        animation: false,
        parsing: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { type: 'linear', ticks: { ...tick, maxTicksLimit: 6, callback: (v) => `${Math.round(v)}s` }, grid },
          y: { ticks: { ...tick, maxTicksLimit: 4 }, grid },
        },
      },
    })

    let points = []
    let dirty = false
    let raf = requestAnimationFrame(function draw() {
      raf = requestAnimationFrame(draw)
      if (!dirty) return
      dirty = false
      chart.data.datasets[0].data = points
      if (windowSec) {
        const end = points[points.length - 1].x
        chart.options.scales.x.min = Math.max(0, end - windowSec)
        chart.options.scales.x.max = Math.max(windowSec, end)
      }
      chart.update('none')
    })

    const unsubscribe = subscribeTraces((msg, originMs) => {
      const incoming = msg[series]
      if (!incoming?.length) return
      for (const [t, v] of incoming) points.push({ x: (t - originMs) / 1000, y: v })
      if (windowSec) {
        const cutoff = points[points.length - 1].x - windowSec
        const keepFrom = points.findIndex((p) => p.x >= cutoff)
        if (keepFrom > 0) points = points.slice(keepFrom)
      } else if (points.length > MAX_POINTS) {
        // Halve the resolution of everything but the most recent stretch.
        const recent = points.length - MAX_POINTS / 4
        points = points.filter((_, i) => i >= recent || i % 2 === 0)
      }
      dirty = true
    })

    return () => {
      cancelAnimationFrame(raf)
      unsubscribe()
      chart.destroy()
    }
  }, [subscribeTraces, series, windowSec, color])

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-xs text-slate-500">
        <span>{title}</span>
        <span>{unit}</span>
      </div>
      <div className="relative h-24">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
