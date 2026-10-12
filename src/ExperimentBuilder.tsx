import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { defaultCrossingProperties, defaultStrandProperties } from '../services/experiment'
import type { BuiltCrossing, CrossingProperties, FaceProperties, StrandProperties } from '../services/experiment'

type Props = {
  kind: 'crossing' | 'strand' | 'face'
  crossings: BuiltCrossing[]
  onCreateCrossing: (properties: CrossingProperties) => void
  onCreateStrand: (properties: StrandProperties) => void
  onCreateFace: (properties: FaceProperties) => void
  onClose: () => void
}

export default function ExperimentBuilder({ kind, crossings, onCreateCrossing, onCreateStrand, onCreateFace, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
  const [position, setPosition] = useState({ left: 24, top: 100 })
  const [strand, setStrand] = useState(defaultStrandProperties)
  const [crossing, setCrossing] = useState(defaultCrossingProperties)
  const [sides, setSides] = useState('')
  const objectLabel = kind === 'crossing' ? 'Crossing' : kind === 'strand' ? 'Strand' : 'Face'
  const title = `Build ${objectLabel}`

  function move(left: number, top: number) {
    const bounds = panel.current?.getBoundingClientRect()
    setPosition({
      left: Math.max(8, Math.min(left, window.innerWidth - (bounds?.width ?? 340) - 8)),
      top: Math.max(8, Math.min(top, window.innerHeight - (bounds?.height ?? 400) - 8)),
    })
  }

  useEffect(() => {
    const previousFocus = document.activeElement
    handle.current?.focus()
    const keepVisible = () => {
      const bounds = panel.current?.getBoundingClientRect()
      if (!bounds) return
      setPosition((current) => ({
        left: Math.max(8, Math.min(current.left, window.innerWidth - bounds.width - 8)),
        top: Math.max(8, Math.min(current.top, window.innerHeight - bounds.height - 8)),
      }))
    }
    const observer = new ResizeObserver(keepVisible)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', keepVisible)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', keepVisible)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  return createPortal(
    <div ref={panel} className="experiment_floating_builder" role="dialog" aria-labelledby="builder-title"
      style={{ left: position.left, top: position.top }} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      }}>
      <div className="experiment_builder_header">
        <button ref={handle} type="button" className="experiment_builder_handle" aria-label={`Move ${title} box`}
          aria-describedby="builder-move-help"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, ...position }
          }}
          onPointerMove={(event) => {
            const start = drag.current
            if (start?.pointerId === event.pointerId) move(start.left + event.clientX - start.x, start.top + event.clientY - start.y)
          }}
          onPointerUp={(event) => {
            drag.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancel={() => { drag.current = null }}
          onLostPointerCapture={() => { drag.current = null }}
          onKeyDown={(event) => {
            const offsets: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }
            const offset = offsets[event.key]
            if (offset) { event.preventDefault(); move(position.left + offset[0], position.top + offset[1]) }
          }}>
          <span id="builder-title">{title}</span><span aria-hidden="true"> ⠿</span>
        </button>
        <button type="button" className="algorithm_delete" aria-label={`Close ${title}`} onClick={onClose}>Close</button>
      </div>
      <p id="builder-move-help" className="experiment_builder_help">Drag the title to move this box, or use arrow keys when the title is focused.</p>
      <form className="experiment_builder_form" onSubmit={(event) => {
        event.preventDefault()
        if (kind === 'crossing') onCreateCrossing(crossing)
        else if (kind === 'strand') {
          if (!crossings.some((item) => item.id === strand.firstCrossingId) || !crossings.some((item) => item.id === strand.secondCrossingId)) return
          onCreateStrand(strand)
        }
        else onCreateFace({ sides: sides === '' ? null : Number(sides) })
      }}>
        {kind === 'crossing' ? <>
          <label htmlFor="builder-sign">Sign
            <select id="builder-sign" value={crossing.sign} onChange={(event) => setCrossing({ ...crossing, sign: event.target.value as CrossingProperties['sign'] })}>
              <option value="any">Any</option><option value="positive">+ (Positive)</option><option value="negative">- (Negative)</option>
            </select>
          </label>
          <label htmlFor="builder-role">Role
            <select id="builder-role" value={crossing.role} onChange={(event) => setCrossing({ ...crossing, role: event.target.value as CrossingProperties['role'] })}>
              <option value="any">Any</option><option value="over">Over</option><option value="under">Under</option>
            </select>
          </label>
        </> : kind === 'strand' ? <>
          {(['firstCrossingId', 'secondCrossingId'] as const).map((field, index) => <label key={field} htmlFor={`builder-${field}`}>Crossing {index + 1}
            <select id={`builder-${field}`} required value={strand[field]} onChange={(event) => setStrand({ ...strand, [field]: event.target.value })}>
              <option value="" disabled>Select a crossing</option>
              {crossings.map((item) => <option key={item.id} value={item.id}>{item.name} (Sign: {item.sign}; Role: {item.role})</option>)}
            </select>
          </label>)}
          {crossings.length === 0 && <small>Build crossings first, then select the two crossings for this strand.</small>}
          <label htmlFor="builder-orientation">Orientation
            <select id="builder-orientation" value={strand.orientation} onChange={(event) => setStrand({ ...strand, orientation: event.target.value as StrandProperties['orientation'] })}>
              <option value="any">Any</option><option value="with">With knot</option><option value="against">Against knot</option>
            </select>
          </label>
        </> : <label htmlFor="builder-sides">Number of sides
          <input id="builder-sides" type="number" min="1" step="1" placeholder="Any" value={sides} onChange={(event) => setSides(event.target.value)} />
          <small>Leave blank for Any. A triangular face has 3 sides.</small>
        </label>}
        <div className="experiment_builder_actions">
          <button type="submit" className="experiment_add_knots" disabled={kind === 'strand' && (!strand.firstCrossingId || !strand.secondCrossingId)}>Create {objectLabel}</button>
          <button type="button" className="algorithm_delete" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>, document.body,
  )
}
