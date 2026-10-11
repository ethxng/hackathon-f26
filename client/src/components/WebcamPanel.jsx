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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-[#e9dfcf]">
          <span className="h-3 w-3 animate-ping rounded-full bg-[#ffd68a]/70" />
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
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[#e9dfcf]">
          Camera preview unavailable: {error}
        </div>
      )}
    </>
  )
}

// Light frosted pill that stays readable over any camera image.
const PILL = 'rounded-full border border-white/60 bg-[#fffaf2]/80 text-ink shadow-sm backdrop-blur-xl'

function ValidationHint({ validation }) {
  const text = validation.hint || validation.code
  if (validation.blocksVitals) {
    return (
      <div className={`${PILL} flex items-center gap-2.5 px-4 py-2 text-sm`} style={{ background: 'rgba(255, 241, 220, 0.92)' }}>
        <span className="text-[#a8650f]">⚠ {text}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c47a14]">Vitals paused</span>
      </div>
    )
  }
  return <div className={`${PILL} px-4 py-2 text-sm`}>{text}</div>
}

export default function WebcamPanel({ state, faceDetected, validation, subscribeFrames }) {
  const color = STATES[state]?.color ?? STATES.calibrating.color
  const hint = useStableValidation(validation)
  const faceLost = faceDetected === false

  return (
    // Outer layer: slowly rotating state-colored glow border.
    <div
      className="glow-border rounded-[34px] p-[3px] transition-shadow duration-700"
      style={{ '--glow': color, boxShadow: `0 24px 60px -28px ${color}, 0 18px 40px -24px rgba(90,60,20,0.35)` }}
    >
      <div className="relative aspect-video overflow-hidden rounded-[31px] bg-[#2b2620]">
        {subscribeFrames ? <PresageFeed subscribeFrames={subscribeFrames} /> : <BrowserFeed />}

        {/* Warm lamp tint over the video */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ffd68a]/15 via-transparent to-black/25" />

        {faceLost && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#2b2620]/45 backdrop-blur-md">
            <span className={`${PILL} px-5 py-2.5 text-[#a8650f]`}>Face not detected</span>
          </div>
        )}

        {/* The face-lost overlay already covers kNoFaceFound. */}
        {hint && !faceLost && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
            <ValidationHint validation={hint} />
          </div>
        )}

        <div className={`${PILL} absolute left-4 top-4 flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium`}>
          <span className="h-2 w-2 rounded-full transition-colors duration-700" style={{ background: color }} />
          {STATES[state]?.label}
        </div>
      </div>
    </div>
  )
}
