import { useEffect, useRef, useState } from 'react'

// Preview only. Presage reads the camera on the Node side.
export function useWebcam(enabled) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) return
    let stream
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch((e) => setError(e.message || 'Camera unavailable'))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [enabled])

  return { videoRef, error }
}
