import { useEffect, useRef, useState } from 'react'
import { speechSettings } from '../lib/contract.js'

// Plays nudges one at a time (never overlapping) and reports playback progress
// (0..1) so the text can be revealed in sync with the voice. Uses the
// ElevenLabs mp3 when present, otherwise falls back to browser speech.
export function useNudgeAudio(nudge, session) {
  const [current, setCurrent] = useState(null)
  const [progress, setProgress] = useState(0)
  const queue = useRef([])
  const playing = useRef(false)

  useEffect(() => {
    if (!nudge) return
    queue.current.push(nudge)
    playNext()
  }, [nudge])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  function playNext() {
    if (playing.current || !queue.current.length) return
    const item = queue.current.shift()
    playing.current = true
    setCurrent(item)
    setProgress(0)

    const done = () => {
      setProgress(1)
      // Leave the finished text on screen briefly before the next one.
      setTimeout(() => {
        playing.current = false
        setCurrent(null)
        playNext()
      }, 2500)
    }

    if (item.audio) {
      const audio = new Audio(`data:audio/mpeg;base64,${item.audio}`)
      audio.ontimeupdate = () => audio.duration && setProgress(audio.currentTime / audio.duration)
      audio.onended = done
      audio.onerror = done
      audio.play().catch(done)
    } else if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(item.text)
      Object.assign(u, speechSettings(session))
      u.onboundary = (e) => setProgress((e.charIndex + (e.charLength || 0)) / item.text.length)
      u.onend = done
      u.onerror = done
      window.speechSynthesis.speak(u)
    } else {
      setTimeout(done, 3000)
    }
  }

  return { current, progress, speaking: !!current && progress < 1 }
}
