import { useEffect, useRef, useState } from 'react'
import * as api from '../services/api'
import type { RolfKnotNames } from '../services/types'

import { createExperimentStep, experimentMoves, crossingName, faceName, strandName, toMoveRequests, hasRepeatCount } from '../services/experiment'
import type { BuiltCrossing, CrossingProperties, BuiltFace, BuiltStrand, ExperimentMove, ExperimentStep, FaceProperties, LocationArgument, LocationRequirement, StrandProperties } from '../services/experiment'

import ExperimentBuilder from './ExperimentBuilder'

const locationLabels = { strand: 'Strand', crossing: 'Crossing', face: 'Face' }

function LocationPicker({ id, label, requirement, value, crossings, strands, faces, onChange, onBuild }: {
  id: string
  label: string
  requirement: LocationRequirement
  value: LocationArgument
  crossings: BuiltCrossing[]
  strands: BuiltStrand[]
  faces: BuiltFace[]
  onChange: (value: LocationArgument) => void
  onBuild: (kind: 'crossing' | 'strand' | 'face') => void
}) {
  const selectedId = value.source === 'any' ? 'any' : value.type === 'strand' ? value.strandId : value.type === 'crossing' ? value.crossingId : value.faceId
  const selectedStrand = value.type === 'strand' && value.source === 'built' ? strands.find((strand) => strand.id === value.strandId) : undefined
  const selectedFace = value.type === 'face' && value.source === 'built' ? faces.find((face) => face.id === value.faceId) : undefined
  return (
    <div className="experiment_location">
      {requirement.types.length > 1 && <label htmlFor={`${id}-type`}>Location type
        <select id={`${id}-type`} value={value.type} onChange={(event) => {
          const type = requirement.types.find((type) => type === event.target.value)
          if (type) onChange({ type, source: 'any' })
        }}>
          {requirement.types.map((type) => <option key={type} value={type}>{locationLabels[type]}</option>)}
        </select>
      </label>}
      <label htmlFor={id}>{label}
        <select id={id} value={selectedId} onChange={(event) => {
          if (event.target.value === 'build') onBuild(value.type)
          else if (event.target.value === 'any') onChange({ type: value.type, source: 'any' })
          else if (value.type === 'strand') onChange({ type: 'strand', source: 'built', strandId: event.target.value })
          else if (value.type === 'crossing') onChange({ type: 'crossing', source: 'built', crossingId: event.target.value })
          else if (value.type === 'face') onChange({ type: 'face', source: 'built', faceId: event.target.value })
        }}>
          {requirement.allowAny && <option value="any">Any matching {value.type}</option>}
          <option value="build">Build {locationLabels[value.type]}...</option>
          {value.type === 'crossing' && crossings.length > 0 && <optgroup label="Created crossings">{crossings.map((crossing) => <option key={crossing.id} value={crossing.id}>{crossing.name}</option>)}</optgroup>}
          {value.type === 'strand' && strands.length > 0 && <optgroup label="Created strands">{strands.map((strand) => <option key={strand.id} value={strand.id}>{strand.name}</option>)}</optgroup>}
          {value.type === 'face' && faces.length > 0 && <optgroup label="Created faces">{faces.map((face) => <option key={face.id} value={face.id}>{face.name}</option>)}</optgroup>}
        </select>
      </label>
      {selectedStrand && <small>Crossings: {crossings.find((crossing) => crossing.id === selectedStrand.firstCrossingId)?.name} and {crossings.find((crossing) => crossing.id === selectedStrand.secondCrossingId)?.name}; Orientation: {selectedStrand.orientation === 'with' ? 'With knot' : selectedStrand.orientation === 'against' ? 'Against knot' : 'Any'}</small>}
      {selectedFace && <small>Number of sides: {selectedFace.sides ?? 'Any'}</small>}
    </div>
  )
}

type KnotChoice = { numCrossings: string; rolfIndex: string }
type IdentifiedKnot = KnotChoice & { knotId: number }
type KnotRange = { from: IdentifiedKnot; to: IdentifiedKnot }

function mergeKnotRanges(ranges: KnotRange[]): KnotRange[] {
  const merged: KnotRange[] = []
  for (const range of [...ranges].sort((a, b) => a.from.knotId - b.from.knotId)) {
    const previous = merged[merged.length - 1]
    if (previous && range.from.knotId <= previous.to.knotId + 1) {
      if (range.to.knotId > previous.to.knotId) previous.to = range.to
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

const defaultKnotChoice = (): KnotChoice => ({ numCrossings: '3', rolfIndex: '1' })

type KnotDropdownsProps = {
  label: string
  rolfNames: RolfKnotNames
  loading: boolean
  value: KnotChoice
  onChange: (choice: KnotChoice) => void
}

function KnotDropdowns({ label, rolfNames, loading, value, onChange }: KnotDropdownsProps) {
  const crossingNums = rolfNames.map((group) => group.numCrossings)
  const rolfIndices = rolfNames.find((group) => group.numCrossings === value.numCrossings)?.rolfIndexes ?? []

  return (
    <div className="experiment_knot_picker" aria-label={label}>
      <select
        className="knot_picker_input"
        aria-label={`${label} crossing number`}
        value={value.numCrossings}
        disabled={loading || crossingNums.length === 0}
        onChange={(event) => {
          const numCrossings = event.target.value
          const nextGroup = rolfNames.find((group) => group.numCrossings === numCrossings)
          onChange({ numCrossings, rolfIndex: nextGroup?.rolfIndexes[0] ?? '' })
        }}
      >
        {loading ? <option value="3">Loading...</option> : crossingNums.map((crossingNum) => (
          <option key={crossingNum} value={crossingNum}>{crossingNum}</option>
        ))}
      </select>
      <span className="knot_picker_sep" aria-hidden="true">_</span>
      <select
        className="knot_picker_input"
        aria-label={`${label} Rolfsen index`}
        value={value.rolfIndex}
        disabled={loading || rolfIndices.length === 0}
        onChange={(event) => onChange({ ...value, rolfIndex: event.target.value })}
      >
        {loading ? <option value="1">Loading...</option> : rolfIndices.map((rolfIndex) => (
          <option key={rolfIndex} value={rolfIndex}>{rolfIndex}</option>
        ))}
      </select>
    </div>
  )
}

function RunExperiment() {
  const [rolfNames, setRolfNames] = useState<RolfKnotNames>([])
  const [rolfNamesLoading, setRolfNamesLoading] = useState(true)
  const [fromKnot, setFromKnot] = useState<KnotChoice>(defaultKnotChoice)
  const [toKnot, setToKnot] = useState<KnotChoice>(defaultKnotChoice)
  const [knotRanges, setKnotRanges] = useState<KnotRange[]>([])
  const [addingKnots, setAddingKnots] = useState(false)
  const [addKnotsError, setAddKnotsError] = useState<string | null>(null)
  const nextRowId = useRef(1)
  const runningRef = useRef(false)
  const [algorithmRows, setAlgorithmRows] = useState<ExperimentStep[]>([])
  const [running, setRunning] = useState(false)
  const [experimentId, setExperimentId] = useState<number | null>(null)
  const [runStatus, setRunStatus] = useState('')
  const [runError, setRunError] = useState<string | null>(null)
  const [builtCrossings, setBuiltCrossings] = useState<BuiltCrossing[]>([])
  const nextCrossingId = useRef(0)
  const [builtStrands, setBuiltStrands] = useState<BuiltStrand[]>([])
  const nextStrandId = useRef(0)
  const [builtFaces, setBuiltFaces] = useState<BuiltFace[]>([])
  const nextFaceId = useRef(0)
  const [builder, setBuilder] = useState<{ kind: 'crossing' | 'strand' | 'face'; target?: { rowId: number; index: number } } | null>(null)

  const createCrossing = (properties: CrossingProperties) => {
    const number = nextCrossingId.current++
    const crossing = { ...properties, id: `crossing-${number}`, name: crossingName(number) }
    setBuiltCrossings((crossings) => [...crossings, crossing])
    if (builder?.target) updateLocation(builder.target.rowId, builder.target.index, { type: 'crossing', source: 'built', crossingId: crossing.id })
    setBuilder(null)
  }
  const createStrand = (properties: StrandProperties) => {
    const number = nextStrandId.current++
    const strand = { ...properties, id: `strand-${number}`, name: strandName(number) }
    setBuiltStrands((strands) => [...strands, strand])
    if (builder?.target) updateLocation(builder.target.rowId, builder.target.index, { type: 'strand', source: 'built', strandId: strand.id })
    setBuilder(null)
  }
  const createFace = (properties: FaceProperties) => {
    const number = nextFaceId.current++
    const face = { ...properties, id: `face-${number}`, name: faceName(number) }
    setBuiltFaces((faces) => [...faces, face])
    if (builder?.target) updateLocation(builder.target.rowId, builder.target.index, { type: 'face', source: 'built', faceId: face.id })
    setBuilder(null)
  }
  const hasUnsupportedMoves = algorithmRows.some((row) => row.algorithm !== 'addTwist')

  const updateLocation = (rowId: number, index: number, location: LocationArgument) => {
    setAlgorithmRows((rows) => rows.map((row) => row.id === rowId
      ? { ...row, locations: row.locations.map((current, i) => i === index ? location : current) } : row))
  }
  const repeatCountInput = (row: ExperimentStep, id: string) => (
    <label className="experiment_repeat_count" htmlFor={id}>Times
      <input id={id} type="number" min="1" step="1" required disabled={running}
        aria-label={`Repetitions for step ${algorithmRows.findIndex((item) => item.id === row.id) + 1}`}
        value={Number.isNaN(row.until) ? '' : row.until}
        onChange={(event) => {
          const until = event.target.valueAsNumber
          setAlgorithmRows((rows) => rows.map((item) => item.id === row.id ? { ...item, until } : item))
        }} />
    </label>
  )

  useEffect(() => {
    api.fetchRolfNames()
      .then(setRolfNames)
      .catch(() => setRolfNames([]))
      .finally(() => setRolfNamesLoading(false))
  }, [])

  const addKnotRange = async () => {
    setAddingKnots(true)
    setAddKnotsError(null)
    try {
      const [fromId, toId] = await Promise.all([
        api.fetchKnotId(fromKnot.numCrossings, fromKnot.rolfIndex),
        api.fetchKnotId(toKnot.numCrossings, toKnot.rolfIndex),
      ])
      if (!Number.isSafeInteger(fromId) || !Number.isSafeInteger(toId)) {
        throw new Error('The server returned an invalid knot ID. Please try again.')
      }
      const first = { ...fromKnot, knotId: fromId }
      const last = { ...toKnot, knotId: toId }
      const range = fromId <= toId ? { from: first, to: last } : { from: last, to: first }
      setKnotRanges((ranges) => mergeKnotRanges([...ranges, range]))
    } catch (error) {
      setAddKnotsError(error instanceof Error ? error.message : 'Unable to add knots. Please try again.')
    } finally {
      setAddingKnots(false)
    }
  }

  const runExperiment = async () => {
    if (runningRef.current || addingKnots || hasUnsupportedMoves || !knotRanges.length || !algorithmRows.length) return
    setBuilder(null)
    runningRef.current = true
    setRunning(true)
    setRunError(null)
    setExperimentId(null)
    setRunStatus('Starting experiment...')
    try {
      const requests = toMoveRequests(algorithmRows, builtCrossings, builtStrands)
      const knotIds = knotRanges.flatMap(({ from, to }) =>
        Array.from({ length: to.knotId - from.knotId + 1 }, (_, index) => from.knotId + index))
      const startedId = await api.startExperiment(knotIds)
      setExperimentId(startedId)
      setRunStatus(`Experiment ${startedId}: running ${requests.length} moves...`)
      await api.runExperiment(startedId, requests)
      setRunStatus(`Experiment ${startedId} completed: ${requests.length} moves applied.`)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Unable to run experiment.')
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  return (
    <div className="run_experiment">
      {builder && <ExperimentBuilder key={`${builder.kind}-${builder.target?.rowId ?? 'global'}-${builder.target?.index ?? ''}`}
        kind={builder.kind} crossings={builtCrossings} onCreateCrossing={createCrossing} onCreateStrand={createStrand} onCreateFace={createFace} onClose={() => setBuilder(null)} />}
      <aside className="experiment_objects_card" aria-labelledby="created-objects-label">
        <h2 id="created-objects-label">Created Objects</h2>
        <p>Use these objects in the location selectors for your steps.</p>
        <div aria-live="polite">
          <section className="experiment_object_group" aria-labelledby="created-crossings-label">
            <h3 id="created-crossings-label">Crossings <span>({builtCrossings.length})</span></h3>
            {builtCrossings.length === 0 ? <p>No crossings created yet.</p> : <ul>
              {builtCrossings.map((crossing) => <li key={crossing.id}>
                <strong>{crossing.name}</strong>
                <small>Sign: {crossing.sign}; Role: {crossing.role}</small>
              </li>)}
            </ul>}
          </section>
          <section className="experiment_object_group" aria-labelledby="created-strands-label">
            <h3 id="created-strands-label">Strands <span>({builtStrands.length})</span></h3>
            {builtStrands.length === 0 ? <p>No strands created yet.</p> : <ul>
              {builtStrands.map((strand) => <li key={strand.id}>
                <strong>{strand.name}</strong>
                <small>{builtCrossings.find((crossing) => crossing.id === strand.firstCrossingId)?.name} and {builtCrossings.find((crossing) => crossing.id === strand.secondCrossingId)?.name}</small>
                <small>Orientation: {strand.orientation === 'with' ? 'With knot' : strand.orientation === 'against' ? 'Against knot' : 'Any'}</small>
              </li>)}
            </ul>}
          </section>
          <section className="experiment_object_group" aria-labelledby="created-faces-label">
            <h3 id="created-faces-label">Faces <span>({builtFaces.length})</span></h3>
            {builtFaces.length === 0 ? <p>No faces created yet.</p> : <ul>
              {builtFaces.map((face) => <li key={face.id}>
                <strong>{face.name}</strong>
                <small>Number of sides: {face.sides ?? 'Any'}</small>
              </li>)}
            </ul>}
          </section>
        </div>
      </aside>
      <form className="run_experiment_card" onSubmit={(event) => { event.preventDefault(); void runExperiment() }}>
        <h1>Run Experiment</h1>

        <section className="experiment_section experiment_knot_row" aria-labelledby="add-knots-label">
          <h2 id="add-knots-label">Add Knots :</h2>
          <div className="experiment_knot_controls">
            <KnotDropdowns label="First knot" rolfNames={rolfNames} loading={rolfNamesLoading || running} value={fromKnot} onChange={setFromKnot} />
            <span className="experiment_knot_to">to</span>
            <KnotDropdowns label="Last knot" rolfNames={rolfNames} loading={rolfNamesLoading || running} value={toKnot} onChange={setToKnot} />
            <button type="button" className="experiment_add_knots" disabled={running || addingKnots || rolfNamesLoading || rolfNames.length === 0} onClick={addKnotRange}>
              {addingKnots ? 'Adding...' : 'Add'}
            </button>
          </div>
        </section>

        {addKnotsError && <p role="alert">{addKnotsError}</p>}

        <section className="experiment_section" aria-labelledby="move-algorithm-label">
          <div className="experiment_builder_toolbar" aria-label="Build location objects">
            <button type="button" className="experiment_add_knots" disabled={running} onClick={() => setBuilder({ kind: 'crossing' })}>Build Crossing</button>
            <button type="button" className="experiment_add_knots" disabled={running} onClick={() => setBuilder({ kind: 'strand' })}>Build Strand</button>
            <button type="button" className="experiment_add_knots" disabled={running} onClick={() => setBuilder({ kind: 'face' })}>Build Face</button>
          </div>
          <h2 id="move-algorithm-label">Select a Move</h2>
          <div className="algorithm_row experiment_move_picker">
            <select
              aria-label="Select a move"
              value=""
              disabled={running}
              onChange={(event) => {
                const row = createExperimentStep(nextRowId.current++, event.target.value as ExperimentMove)
                setAlgorithmRows((rows) => [...rows, row])
              }}
            >
              <option value="" disabled>Select a move</option>
              {Object.entries(experimentMoves).map(([move, definition]) => <option key={move} value={move}>{definition.label}</option>)}
            </select>
          </div>
          {algorithmRows.map((row, stepIndex) => (
            <fieldset key={row.id} className="experiment_step" disabled={running}>
              <legend>Step {stepIndex + 1}</legend>
              <div className="experiment_move_controls">
              <label htmlFor={`move-${row.id}`}>Move
                <select id={`move-${row.id}`} value={row.algorithm} onChange={(event) => {
                  const updated = createExperimentStep(row.id, event.target.value as ExperimentMove)
                  if (builder?.target?.rowId === row.id) setBuilder(null)
                  setAlgorithmRows((rows) => rows.map((item) => item.id === row.id ? updated : item))
                }}>
                  {Object.entries(experimentMoves).map(([move, definition]) => <option key={move} value={move}>{definition.label}</option>)}
                </select>
              </label>
              {hasRepeatCount(row.algorithm) && repeatCountInput(row, `repeat-${row.id}`)}
              </div>
              {row.algorithm === 'addTwist' && <label htmlFor={`twist-sign-${row.id}`}>Twist sign
                <select id={`twist-sign-${row.id}`} value={row.twistSign} onChange={(event) => {
                  const twistSign = event.target.value as 'pos' | 'neg'
                  setAlgorithmRows((rows) => rows.map((item) => item.id === row.id ? { ...item, twistSign } : item))
                }}>
                  <option value="pos">Positive</option><option value="neg">Negative</option>
                </select>
              </label>}
              {row.locations.length > 0 && <div className="experiment_locations" role="group" aria-label={`Step ${stepIndex + 1} location`}>
                {row.locations.map((location, index) => {
                  const requirement: LocationRequirement = experimentMoves[row.algorithm].locationArguments[index]
                  const label = `${locationLabels[location.type]}${row.locations.length > 1 ? ` ${index + 1}` : ''}`
                  return <LocationPicker key={`${row.algorithm}-${index}`} id={`location-${row.id}-${index}`} label={label}
                    requirement={requirement} value={location} crossings={builtCrossings} strands={builtStrands} faces={builtFaces}
                    onChange={(value) => {
                      if (builder?.target?.rowId === row.id && builder.target.index === index) setBuilder(null)
                      updateLocation(row.id, index, value)
                    }}
                    onBuild={(kind) => setBuilder({ kind, target: { rowId: row.id, index } })} />
                })}
              </div>}
            </fieldset>
          ))}
          {hasUnsupportedMoves && <p role="status">The backend currently supports Add Twist requests only. Remove other moves to run this experiment.</p>}
        </section>
        <section className="experiment_section">
          <button type="submit" className="experiment_add_knots" disabled={running || addingKnots || hasUnsupportedMoves || !knotRanges.length || !algorithmRows.length}>
            {running ? 'Running...' : 'Run Experiment'}
          </button>
          {runStatus && <p role="status">{runError ? `Stopped. ${runStatus}` : runStatus}</p>}
          {runError && <p role="alert">{runError}</p>}
          {experimentId !== null && runError && <p>Experiment ID: {experimentId}</p>}
        </section>
      </form>
      <div className="experiment_summary_card">
        <section className="experiment_summary_section" aria-labelledby="experiment-knots-label">
          <h2 id="experiment-knots-label">Knots to Experiment On</h2>
          <ul className="experiment_knot_ranges" aria-live="polite">
            {knotRanges.map(({ from, to }) => (
              <li key={from.knotId}>
                {from.numCrossings}_{from.rolfIndex} to {to.numCrossings}_{to.rolfIndex}
              </li>
            ))}
          </ul>
        </section>
        <section className="experiment_summary_section" aria-labelledby="experiment-moves-label">
          <h2 id="experiment-moves-label">Set of Moves</h2>
          <ol className="experiment_moves" aria-live="polite">
            {algorithmRows.map((row, index) => (
              <li key={row.id}>
                <span>{experimentMoves[row.algorithm].label}{row.locations.length > 0 && ` (${row.locations.map((location) => location.source === 'built'
                  ? location.type === 'strand' ? builtStrands.find((strand) => strand.id === location.strandId)?.name ?? 'Unknown strand'
                    : location.type === 'crossing' ? builtCrossings.find((crossing) => crossing.id === location.crossingId)?.name ?? 'Unknown crossing'
                    : builtFaces.find((face) => face.id === location.faceId)?.name ?? 'Unknown face'
                  : `Any ${location.type}`).join(', ')})`}</span>
                {hasRepeatCount(row.algorithm) && repeatCountInput(row, `summary-repeat-${row.id}`)}
                <button type="button" className="algorithm_delete" disabled={running}
                  aria-label={`Remove move ${index + 1}`}
                  onClick={() => {
                    if (builder?.target?.rowId === row.id) setBuilder(null)
                    setAlgorithmRows((rows) => rows.filter((move) => move.id !== row.id))
                  }}>
                  Remove
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

export default RunExperiment
