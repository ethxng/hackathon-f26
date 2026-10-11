import { useState } from 'react'
import { useFocusStream } from './hooks/useFocusStream.js'
import SetupScreen from './components/SetupScreen.jsx'
import SessionScreen from './components/SessionScreen.jsx'

export default function App() {
  const stream = useFocusStream()
  const [session, setSession] = useState(null)

  if (!session) {
    return (
      <SetupScreen
        onStart={(s) => {
          setSession(s)
          stream.start(s)
        }}
      />
    )
  }

  return (
    <SessionScreen
      session={session}
      stream={stream}
      onEnd={() => {
        stream.stop()
        window.speechSynthesis?.cancel()
        setSession(null)
      }}
    />
  )
}
