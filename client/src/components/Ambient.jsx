// Study-room background: warm paper lit by a desk lamp from the top-left,
// with a faint drifting tint in the current state's color.
export default function Ambient({ color }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-paper">
      <div className="lamp-glow" />
      <div className="lamp-glow-soft" />
      <div className="ambient-blob ambient-blob-1" style={{ backgroundColor: color }} />
      <div className="ambient-blob ambient-blob-2" style={{ backgroundColor: color }} />
      <div className="ambient-grain" />
      <div className="ambient-vignette" />
    </div>
  )
}
