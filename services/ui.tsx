import type { Dispatch, KeyboardEvent, PointerEvent, ReactNode, RefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RolfKnotNames } from './types';

export type PanelMode = 'moves' | 'invariants' | 'both';
export type PanelKind = Exclude<PanelMode, 'both'>;

export const MIN_PANEL_SPLIT = 0.25;
export const MAX_PANEL_SPLIT = 0.75;
const PANEL_SPLIT_KEYBOARD_STEP = 0.05;

type KnotPickerProps = {
  rolfNames: RolfKnotNames
  rolfNamesLoading: boolean
  numCrossings: string
  rolfIndex: string
  setNumCrossings: Dispatch<SetStateAction<string>>
  setRolfIndex: Dispatch<SetStateAction<string>>
}

export function KnotPicker({
  rolfNames,
  rolfNamesLoading,
  numCrossings,
  rolfIndex,
  setNumCrossings,
  setRolfIndex,
}: KnotPickerProps) {
  const [draftNumCrossings, setDraftNumCrossings] = useState(numCrossings)
  const [draftRolfIndex, setDraftRolfIndex] = useState(rolfIndex)
  const crossingNums = rolfNames.map((group) => group.numCrossings)
  const selectedGroup = rolfNames.find((group) => group.numCrossings === draftNumCrossings)
  const rolfIndices = selectedGroup?.rolfIndexes ?? []
  const canSubmit =
    Boolean(draftNumCrossings) &&
    Boolean(draftRolfIndex) &&
    (draftNumCrossings !== numCrossings || draftRolfIndex !== rolfIndex)

  useEffect(() => {
    setDraftNumCrossings(numCrossings)
  }, [numCrossings])

  useEffect(() => {
    setDraftRolfIndex(rolfIndex)
  }, [rolfIndex])

  function handleNumCrossingsChange(value: string) {
    setDraftNumCrossings(value)

    const nextGroup = rolfNames.find((group) => group.numCrossings === value)
    setDraftRolfIndex(nextGroup?.rolfIndexes[0] ?? '')
  }

  function handleSubmit() {
    if (!canSubmit) {
      return
    }

    setNumCrossings(draftNumCrossings)
    setRolfIndex(draftRolfIndex)
  }

  return (
    <div className="knot_picker" aria-label="Knot selector">
      <select
        id="knot-crossing-num"
        className="knot_picker_input"
        aria-label="crossing number"
        value={draftNumCrossings}
        disabled={rolfNamesLoading || crossingNums.length === 0}
        onChange={(event) => handleNumCrossingsChange(event.target.value)}
      >
        {rolfNamesLoading ? (
          <option value="">Loading knots...</option>
        ) : crossingNums.length === 0 ? (
          <option value="">No crossing numbers found</option>
        ) : (
          crossingNums.map((crossingNum) => (
            <option key={crossingNum} value={crossingNum}>
              {crossingNum}
            </option>
          ))
        )}
      </select>
      <span className="knot_picker_sep" aria-hidden="true">
        _
      </span>
      <select
        id="knot-rolf-index"
        className="knot_picker_input"
        aria-label="Rolfsen index"
        value={draftRolfIndex}
        disabled={rolfNamesLoading || rolfIndices.length === 0}
        onChange={(event) => setDraftRolfIndex(event.target.value)}
      >
        {rolfNamesLoading ? (
          <option value="">Loading knots...</option>
        ) : rolfIndices.length === 0 ? (
          <option value="">No Rolfsen indices found</option>
        ) : (
          rolfIndices.map((nextRolfIndex) => (
            <option key={nextRolfIndex} value={nextRolfIndex}>
              {nextRolfIndex}
            </option>
          ))
        )}
      </select>
      <button
        type="button"
        className="knot_picker_go"
        aria-label="Load selected knot"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        Go
      </button>
    </div>
  )
}

function clampPanelSplit(value: number) {
  return Math.min(MAX_PANEL_SPLIT, Math.max(MIN_PANEL_SPLIT, value));
}

type PanelDividerProps = {
  panelDividerRef: RefObject<HTMLDivElement | null>;
  panelSplit: number;
  isDraggingPanelDivider: boolean
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

function PanelDivider({
  panelDividerRef,
  panelSplit,
  isDraggingPanelDivider,
  onPointerDown,
  onKeyDown,
}: PanelDividerProps) {
  return (
    <div
      ref={panelDividerRef}
      role="separator"
      tabIndex={0}
      aria-label="Resize moves and invariants panels"
      aria-orientation="horizontal"
      aria-valuemin={MIN_PANEL_SPLIT * 100}
      aria-valuemax={MAX_PANEL_SPLIT * 100}
      aria-valuenow={Math.round(panelSplit * 100)}
      className={`panel_divider${
        isDraggingPanelDivider ? ' panel_divider--dragging' : ''
      }`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}

type ResizablePanelStackProps = {
  movesContent: ReactNode
  invariantsContent: ReactNode
}

export function ResizablePanelStack({
  movesContent,
  invariantsContent,
}: ResizablePanelStackProps) {
  const splitPanelRef = useRef<HTMLDivElement | null>(null)
  const panelDividerRef = useRef<HTMLDivElement | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const [panelSplit, setPanelSplit] = useState(0.58)
  const [isDraggingPanelDivider, setIsDraggingPanelDivider] = useState(false)

  const updatePanelSplitFromClientY = useCallback((clientY: number) => {
    const splitPanelElement = splitPanelRef.current

    if (!splitPanelElement) {
      return
    }

    const splitPanelRect = splitPanelElement.getBoundingClientRect()
    const dividerHeight = panelDividerRef.current?.getBoundingClientRect().height ?? 0
    const availablePanelHeight = splitPanelRect.height - dividerHeight

    if (availablePanelHeight <= 0) {
      return
    }

    const topPanelHeight = clientY - splitPanelRect.top - dividerHeight / 2
    setPanelSplit(clampPanelSplit(topPanelHeight / availablePanelHeight))
  }, [])

  useEffect(() => {
    if (!isDraggingPanelDivider) {
      return
    }

    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'

    function stopDragging(pointerId?: number) {
      if (pointerId != null && dragPointerIdRef.current !== pointerId) {
        return
      }

      dragPointerIdRef.current = null
      setIsDraggingPanelDivider(false)
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      if (dragPointerIdRef.current !== event.pointerId) {
        return
      }

      updatePanelSplitFromClientY(event.clientY)
    }

    function handlePointerUp(event: globalThis.PointerEvent) {
      stopDragging(event.pointerId)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isDraggingPanelDivider, updatePanelSplitFromClientY])

  function handlePanelDividerPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }

    dragPointerIdRef.current = event.pointerId
    setIsDraggingPanelDivider(true)
    updatePanelSplitFromClientY(event.clientY)
    event.preventDefault()
  }

  function handlePanelDividerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setPanelSplit((current) => clampPanelSplit(current - PANEL_SPLIT_KEYBOARD_STEP))
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setPanelSplit((current) => clampPanelSplit(current + PANEL_SPLIT_KEYBOARD_STEP))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setPanelSplit(MIN_PANEL_SPLIT)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setPanelSplit(MAX_PANEL_SPLIT)
    }
  }

  return (
    <div ref={splitPanelRef} className="panel_split_stack">
      <div className="moves_box panel_box panel_box--top" style={{ flex: panelSplit }}>
        <div className="panel_header">moves</div>
        <div className="panel_body">{movesContent}</div>
      </div>
      <PanelDivider
        panelDividerRef={panelDividerRef}
        panelSplit={panelSplit}
        isDraggingPanelDivider={isDraggingPanelDivider}
        onPointerDown={handlePanelDividerPointerDown}
        onKeyDown={handlePanelDividerKeyDown}
      />
      <div
        className="invariants_box panel_box panel_box--bottom"
        style={{ flex: 1 - panelSplit }}
      >
        <div className="panel_header">invariants</div>
        <div className="panel_body">{invariantsContent}</div>
      </div>
    </div>
  )
}

type MovesOrInvariantButtonsProps = {
  panelMode: PanelMode
  setPanelMode: Dispatch<SetStateAction<PanelMode>>
}

function getSinglePanelOppositeLabel(kind: PanelKind) {
  return kind === 'moves' ? 'invariants' : 'moves'
}

export function MovesOrInvariantButtons({
  panelMode,
  setPanelMode,
}: MovesOrInvariantButtonsProps) {
  if (panelMode === 'both') {
    return (
      <div className="panel_actions panel_actions--both">
        <button
          type="button"
          className="panel_button"
          onClick={() => setPanelMode('moves')}
        >
          show moves instead
        </button>
        <button
          type="button"
          className="panel_button"
          onClick={() => setPanelMode('invariants')}
        >
          show invariants instead
        </button>
      </div>
    )
  }

  const oppositeLabel = getSinglePanelOppositeLabel(panelMode)

  return (
    <div className="panel_actions">
      <button
        type="button"
        className="panel_button"
        onClick={() => setPanelMode('both')}
      >
        show {oppositeLabel}
      </button>
      <button
        type="button"
        className="panel_button"
        onClick={() => setPanelMode(oppositeLabel)}
      >
        show {oppositeLabel} instead
      </button>
    </div>
  )
}
