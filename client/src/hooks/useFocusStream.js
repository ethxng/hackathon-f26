import { useCallback, useEffect, useRef, useState } from 'react'
import { MSG } from '../lib/contract.js'
import { createMockStream } from '../lib/mockStream.js'

const SOURCE = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'
const HISTORY_LEN = 60

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
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState({ state: 'calibrating', reasons: [], confidence: null })
  const [nudge, setNudge] = useState(null)
  const [timeline, setTimeline] = useState([])
  const streamRef = useRef(null)
  // Preview frames bypass React state (15/s would re-render the whole tree).
  const frameListeners = useRef(new Set())
  // Same for waveform points (~30 messages/s).
  const traceListeners = useRef(new Set())
  // Timestamp of the first waveform point of the session: the charts' x = 0.
  const traceOrigin = useRef(null)
  const lastStateRef = useRef(null)

  useEffect(() => {
    const onMessage = (msg) => {
      switch (msg.type) {
        case MSG.METRICS:
          setMetrics(msg)
          setHistory((h) => [...h.slice(-(HISTORY_LEN - 1)), msg])
          break
        case MSG.TRACE:
          traceOrigin.current ??= Math.min(
            ...[msg.pulse, msg.breathing, msg.pulseRate, msg.breathingRate].map((s) => s?.[0]?.[0] ?? Infinity)
          )
          traceListeners.current.forEach((fn) => fn(msg, traceOrigin.current))
          break
        case MSG.STATE:
          setStatus({ state: msg.state, reasons: msg.reasons ?? [], confidence: msg.confidence ?? null })
          // State messages repeat when only the reasons change; log transitions only.
          if (msg.state !== lastStateRef.current) {
            lastStateRef.current = msg.state
            setTimeline((tl) => [...tl, { kind: 'state', ...msg }])
          }
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

  const start = useCallback(({ voice, goalMinutes }) => {
    setHistory([])
    setTimeline([])
    lastStateRef.current = null
    traceOrigin.current = null
    setMetrics(null)
    setNudge(null)
    setStatus({ state: 'calibrating', reasons: [], confidence: null })
    streamRef.current?.send({ type: MSG.SESSION_START, voice, goalMinutes })
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
    history,
    status,
    nudge,
    timeline,
    start,
    stop,
    // Camera frames from Presage (ws mode only). In mock mode the browser opens the camera itself.
    subscribeFrames: SOURCE === 'ws' ? subscribeFrames : null,
    subscribeTraces,
    // Only present in mock mode.
    demo: SOURCE === 'mock' ? streamRef : null,
  }
}
