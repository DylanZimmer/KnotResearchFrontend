import { useEffect, useRef, useState } from 'react'
import * as api from '../services/api'
import type { RolfKnotNames } from '../services/types'

type MoveAlgorithm = 'mirror' | 'orientation_flip' | 'addTwist'
type TwistSegment = { sign: 'positive' | 'negative'; placement: 'over' | 'under'; segments: string[] }
type AlgorithmRow = { id: number; algorithm: MoveAlgorithm; from: TwistSegment; to: TwistSegment }
const defaultTwistSegment = (): TwistSegment => ({ sign: 'positive', placement: 'over', segments: [] })
const moveLabels: Record<MoveAlgorithm, string> = { mirror: 'Mirror', orientation_flip: 'Orientation Flip', addTwist: 'Add Twist' }

function TwistSegmentPicker({ id, side, value, disabled, onChange }: {
  id: number
  side: 'from' | 'to'
  value: TwistSegment
  disabled: boolean
  onChange: (value: TwistSegment) => void
}) {
  const label = `addTwist ${id} ${side}`
  return (
    <div className="experiment_twist_segment">
      <label htmlFor={`twist-${id}-${side}`}>{side === 'from' ? 'From one' : 'One'} crossing segment that is</label>
      <select id={`twist-${id}-${side}`} aria-label={`${label} crossing sign`} value={value.sign} disabled={disabled}
        onChange={(event) => onChange({ ...value, sign: event.target.value as TwistSegment['sign'] })}>
        <option value="positive">positive</option>
        <option value="negative">negative</option>
      </select>
      <div className="experiment_twist_strand">
        <span>On the strand's that</span>
        <div className="move_toggle_group" role="group" aria-label={`${label} strand placement`}>
          {(['over', 'under'] as const).map((placement) => (
            <button key={placement} type="button" disabled={disabled} aria-pressed={value.placement === placement}
              className={`move_toggle_button${value.placement === placement ? ' move_toggle_button--selected' : ''}`}
              onClick={() => onChange({ ...value, placement })}>
              {placement === 'over' ? 'Over' : 'Under'}
            </button>
          ))}
        </div>
      </div>
      <ul className="experiment_twist_list" aria-label={`${label} crossing segments`} tabIndex={0}>
        {value.segments.map((segment, index) => <li key={index}>{segment}</li>)}
      </ul>
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
  const [algorithmRows, setAlgorithmRows] = useState<AlgorithmRow[]>([])
  const [running, setRunning] = useState(false)
  const [runStatus, setRunStatus] = useState('')
  const [runError, setRunError] = useState<string | null>(null)
  const hasPendingTwist = algorithmRows.some((row) => row.algorithm === 'addTwist')

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
    if (runningRef.current || addingKnots || hasPendingTwist || !knotRanges.length || !algorithmRows.length) return
    runningRef.current = true
    setRunning(true)
    setRunError(null)
    setRunStatus('Starting experiment...')
    try {
      const knotIds = knotRanges.flatMap(({ from, to }) =>
        Array.from({ length: to.knotId - from.knotId + 1 }, (_, index) => from.knotId + index))
      const experimentId = await api.startExperiment(knotIds)
      for (const [stateNum, row] of algorithmRows.entries()) {
        setRunStatus(`Experiment ${experimentId}: running move ${stateNum + 1} of ${algorithmRows.length} (state ${stateNum})...`)
        await api.performMoveForState(experimentId, stateNum, row.algorithm)
      }
      setRunStatus(`Experiment ${experimentId} completed: ${algorithmRows.length} moves applied.`)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Unable to run experiment.')
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  return (
    <div className="run_experiment">
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
          <h2 id="move-algorithm-label">Select a Move</h2>
          <div className="algorithm_row experiment_move_picker">
            <select
              aria-label="Select a move"
              value=""
              disabled={running}
              onChange={(event) => {
                const row = { id: nextRowId.current++, algorithm: event.target.value as MoveAlgorithm, from: defaultTwistSegment(), to: defaultTwistSegment() }
                setAlgorithmRows((rows) => [...rows, row])
              }}
            >
              <option value="" disabled>Select a move</option>
              <option value="mirror">Mirror</option>
              <option value="orientation_flip">Orientation Flip</option>
              <option value="addTwist">addTwist</option>
            </select>
          </div>
          {algorithmRows.filter((row) => row.algorithm === 'addTwist').map((row) => (
            <fieldset key={row.id} className="experiment_twist_options" disabled={running}>
              <legend>addTwist — Move {algorithmRows.indexOf(row) + 1}</legend>
              <div className="experiment_twist_sides">
                <TwistSegmentPicker id={row.id} side="from" value={row.from} disabled={running}
                  onChange={(from) => setAlgorithmRows((rows) => rows.map((item) => item.id === row.id ? { ...item, from } : item))} />
                <span className="experiment_twist_to">to</span>
                <TwistSegmentPicker id={row.id} side="to" value={row.to} disabled={running}
                  onChange={(to) => setAlgorithmRows((rows) => rows.map((item) => item.id === row.id ? { ...item, to } : item))} />
              </div>
            </fieldset>
          ))}
          {hasPendingTwist && <p role="status">addTwist configuration is available for now; running this move is not yet connected.</p>}
        </section>
        <section className="experiment_section">
          <button type="submit" className="experiment_add_knots" disabled={running || addingKnots || hasPendingTwist || !knotRanges.length || !algorithmRows.length}>
            {running ? 'Running...' : 'Run Experiment'}
          </button>
          {runStatus && <p role="status">{runError ? `Stopped. ${runStatus}` : runStatus}</p>}
          {runError && <p role="alert">{runError}</p>}
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
                <span>{moveLabels[row.algorithm]}</span>
                <button type="button" className="algorithm_delete" disabled={running}
                  aria-label={`Remove move ${index + 1}`}
                  onClick={() => setAlgorithmRows((rows) => rows.filter((move) => move.id !== row.id))}>
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
