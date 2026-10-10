import { useCallback, useEffect, useRef, useState } from 'react'
import { MSG } from '../lib/contract.js'
import { createMockStream } from '../lib/mockStream.js'

const SOURCE = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'

function createWsStream({ onMessage, onFrame, onOpen, onClose }) {
  let ws = null
  let closed = false
  let retry = null
  const queue = []

  function connect() {
    ws = new WebSocket(WS_URL)
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      onOpen?.()
      while (queue.length) ws.send(JSON.stringify(queue.shift()))
    }
    ws.onmessage = (e) => {
      // Binary messages are camera preview frames; text messages are JSON.
      if (e.data instanceof ArrayBuffer) return onFrame?.(e.data)
      try {
        onMessage(JSON.parse(e.data))
      } catch {
        console.warn('Bad message from server', e.data)
      }
    }
    ws.onclose = () => {
      onClose?.()
      if (!closed) retry = setTimeout(connect, 1500)
    }
  }

  return {
    connect,
    send(msg) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
      else queue.push(msg)
    },
    close() {
      closed = true
      clearTimeout(retry)
      ws?.close()
    },
  }
}

// Single source of truth for live session data, from the WS server or the mock.
export function useFocusStream() {
  const [connected, setConnected] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [status, setStatus] = useState({ state: 'calibrating', reasons: [], confidence: null })
  const [nudge, setNudge] = useState(null)
  const [validation, setValidation] = useState(null)
  const [timeline, setTimeline] = useState([])
  const streamRef = useRef(null)
  // Preview frames and chart traces bypass React state (15–30/s would re-render the whole tree).
  const frameListeners = useRef(new Set())
  const traceListeners = useRef(new Set())
  const lastStateRef = useRef(null)

  useEffect(() => {
    const onMessage = (msg) => {
      switch (msg.type) {
        case MSG.METRICS:
          setMetrics(msg)
          break
        case MSG.TRACE:
          traceListeners.current.forEach((fn) => fn(msg))
          break
        case MSG.STATE:
          setStatus({ state: msg.state, reasons: msg.reasons ?? [], confidence: msg.confidence ?? null })
          // State messages repeat when only the reasons change; log transitions only.
          if (msg.state !== lastStateRef.current) {
            lastStateRef.current = msg.state
            setTimeline((tl) => [...tl, { kind: 'state', ...msg }])
          }
          break
        case MSG.VALIDATION:
          setValidation(msg)
          break
        case MSG.NUDGE:
          setNudge({ ...msg, id: `${msg.t}-${Math.random()}` })
          setTimeline((tl) => [...tl, { kind: 'nudge', ...msg }])
          break
      }
    }
    const opts = {
      onMessage,
      onFrame: (frame) => frameListeners.current.forEach((fn) => fn(frame)),
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
    }
    const stream = SOURCE === 'ws' ? createWsStream(opts) : createMockStream(opts)
    streamRef.current = stream
    stream.connect()
    return () => stream.close()
  }, [])

  const start = useCallback(({ gender, tone, goalMinutes }) => {
    setTimeline([])
    lastStateRef.current = null
    setMetrics(null)
    setNudge(null)
    setValidation(null)
    setStatus({ state: 'calibrating', reasons: [], confidence: null })
    streamRef.current?.send({ type: MSG.SESSION_START, gender, tone, goalMinutes })
  }, [])

  const stop = useCallback(() => streamRef.current?.send({ type: MSG.SESSION_STOP }), [])

  const subscribeFrames = useCallback((fn) => {
    frameListeners.current.add(fn)
    return () => frameListeners.current.delete(fn)
  }, [])

  const subscribeTraces = useCallback((fn) => {
    traceListeners.current.add(fn)
    return () => traceListeners.current.delete(fn)
  }, [])

  return {
    source: SOURCE,
    connected,
    metrics,
    status,
    nudge,
    validation,
    timeline,
    start,
    stop,
    // Full-rate measurements for the live charts; see the 'trace' message in contract.js.
    subscribeTraces,
    // Camera frames from Presage (ws mode only). In mock mode the browser opens the camera itself.
    subscribeFrames: SOURCE === 'ws' ? subscribeFrames : null,
    // Only present in mock mode.
    demo: SOURCE === 'mock' ? streamRef : null,
  }
}
