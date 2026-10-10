import { useEffect, useRef, useState } from 'react'

// Presage's validation code often flaps between OK and a warning every second
// or two. Only show a warning once it has persisted, and keep it up long enough
// to read. Returns the validation message to display, or null.
export function useStableValidation(validation, { showAfterMs = 1500, minVisibleMs = 2500 } = {}) {
  const [shown, setShown] = useState(null)
  const shownRef = useRef(null)
  const shownAt = useRef(0)
  const timer = useRef(null)

  useEffect(() => {
    const warning = validation && !validation.ok ? validation : null
    const show = (v) => {
      if (!shownRef.current) shownAt.current = Date.now()
      shownRef.current = v
      setShown(v)
    }
    const hide = () => {
      shownRef.current = null
      setShown(null)
    }

    if (warning) {
      // Already showing a warning: swap the text right away.
      if (shownRef.current) show(warning)
      else timer.current = setTimeout(() => show(warning), showAfterMs)
    } else if (shownRef.current) {
      timer.current = setTimeout(hide, Math.max(0, shownAt.current + minVisibleMs - Date.now()))
    }
    return () => clearTimeout(timer.current)
  }, [validation, showAfterMs, minVisibleMs])

  return shown
}
