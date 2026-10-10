import { useEffect, useRef, useState } from 'react'
import { useWebcam } from '../hooks/useWebcam.js'
import { useStableValidation } from '../hooks/useStableValidation.js'
import { STATES } from '../lib/contract.js'

// Draws Presage's preview frames (uint16 w, uint16 h, then RGB bytes) to a canvas.
function PresageFeed({ subscribeFrames }) {
  const canvasRef = useRef(null)
  const [hasFrame, setHasFrame] = useState(false)

  useEffect(() => {
    let image = null
    return subscribeFrames((buf) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const view = new DataView(buf)
      const w = view.getUint16(0, true)
      const h = view.getUint16(2, true)
      const rgb = new Uint8Array(buf, 4)
      if (rgb.length < w * h * 3) return
      const ctx = canvas.getContext('2d')
      if (!image || image.width !== w || image.height !== h) {
        canvas.width = w
        canvas.height = h
        image = ctx.createImageData(w, h)
      }
      const rgba = image.data
      for (let i = 0, j = 0; i < w * h * 3; i += 3, j += 4) {
        rgba[j] = rgb[i]
        rgba[j + 1] = rgb[i + 1]
        rgba[j + 2] = rgb[i + 2]
        rgba[j + 3] = 255
      }
      ctx.putImageData(image, 0, 0)
      setHasFrame(true)
    })
  }, [subscribeFrames])

  return (
    <>
      <canvas ref={canvasRef} className="h-full w-full -scale-x-100 object-cover" />
      {!hasFrame && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          Waiting for camera from Presage…
        </div>
      )}
    </>
  )
}

// Mock mode only: no Presage running, so the browser can own the camera.
function BrowserFeed() {
  const { videoRef, error } = useWebcam(true)
  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          Camera preview unavailable: {error}
        </div>
      )}
    </>
  )
}

function ValidationHint({ validation }) {
  const text = validation.hint || validation.code
  if (validation.blocksVitals) {
    return (
      <div className="flex items-center gap-2.5 rounded-full border border-amber-300/30 bg-amber-950/70 px-4 py-2 text-sm text-amber-100 backdrop-blur">
        <span>⚠ {text}</span>
        <span className="text-xs uppercase tracking-wider text-amber-300/80">Vitals paused</span>
      </div>
    )
  }
  return (
    <div className="rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm text-slate-100 backdrop-blur">{text}</div>
  )
}

export default function WebcamPanel({ state, faceDetected, validation, subscribeFrames }) {
  const color = STATES[state]?.color ?? STATES.calibrating.color
  const hint = useStableValidation(validation)
  const faceLost = faceDetected === false

  return (
    <div
      className="relative aspect-video overflow-hidden rounded-3xl border-2 bg-black transition-[border-color,box-shadow] duration-700"
      style={{ borderColor: color, boxShadow: `0 0 80px -20px ${color}` }}
    >
      {subscribeFrames ? <PresageFeed subscribeFrames={subscribeFrames} /> : <BrowserFeed />}

      {faceLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <span className="rounded-full bg-amber-400/20 px-4 py-2 text-amber-200">Face not detected</span>
        </div>
      )}

      {/* The face-lost overlay already covers kNoFaceFound. */}
      {hint && !faceLost && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
          <ValidationHint validation={hint} />
        </div>
      )}

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-sm backdrop-blur">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {STATES[state]?.label}
      </div>
    </div>
  )
}
