import { useEffect, useRef, useState } from 'react';
import './App.css';
import * as api from '../services/api';
import * as type from '../services/types';
import * as ui from '../services/ui';
import * as geometryMoves from '../services/functions/geometry_moves';
import { buildSvg } from '../services/buildSvg';
import { GeometricLineInput } from '../services/components/geometric_line_input';

type InvariantKey = keyof type.Invariants;
type TwistHandedness = 'l' | 'r';

type OneLineMoveInputProps = {
  disabled: boolean;
  onSubmit: (line: type.GeometricLine, handedness: TwistHandedness) => void;
};

const defaultGeometricLine: type.GeometricLine = {
  cid1: 1,
  placement1: 'over',
  cid2: 0,
  placement2: 'under',
};


function OneLineMoveInput({ onSubmit, disabled }: OneLineMoveInputProps) {
  const [line, setLine] = useState<type.GeometricLine>(defaultGeometricLine);
  const [handedness, setHandedness] = useState<TwistHandedness>('l');

  return (
    <fieldset className="one_line_move_input move_fieldset" disabled={disabled}>
      <GeometricLineInput value={line} onChange={setLine} />
      <div className="twist_control_row">
        <div className="handedness_control">
          <span className="handedness_label">Handedness:</span>
          <div className="handedness_toggle" aria-label="Twist handedness">
            {(['l', 'r'] as TwistHandedness[]).map((nextHandedness) => (
              <button
                key={nextHandedness}
                type="button"
                className={`handedness_toggle_button${handedness === nextHandedness ? ' handedness_toggle_button--active' : ''}`}
                aria-pressed={handedness === nextHandedness}
                onClick={() => setHandedness(nextHandedness)}
              >
                {nextHandedness}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="move_action_button twist_apply_button" onClick={() => onSubmit(line, handedness)}>
          Apply
        </button>
      </div>
    </fieldset>
  );
}
  

function VisualComponent() {
  const [rolfNames, setRolfNames] = useState<type.RolfKnotNames>([]);
  const [rolfNamesLoading, setRolfNamesLoading] = useState(true);
  const [rolfNamesError, setRolfNamesError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<ui.PanelMode>('both');
  const [invariants, setInvariants] = useState<type.Invariants | null>(null);
  const [selectedInvariantKeys, setSelectedInvariantKeys] = useState<InvariantKey[]>([]);
  const hasInitializedSelectedInvariants = useRef(false);
  const [knotLoading, setKnotLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const operationInFlight = useRef(false);
  const [invariantsError, setInvariantsError] = useState<string | null>(null);
  const [isEditingInvariants, setIsEditingInvariants] = useState(false);
  const [numCrossings, setNumCrossings] = useState("3");
  const [rolfIndex, setRolfIndex] = useState("1");
  const [knotSvg, setKnotSvg] = useState("");
  const [knotSvgError, setKnotSvgError] = useState<string | null>(null);
  const [activeMoveName, setActiveMoveName] = useState<string | null>(null);
  const allInvariantKeys = invariants ? Object.keys(invariants) as InvariantKey[] : [];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setRolfNamesLoading(true);
      setKnotLoading(true);
      setRolfNamesError(null);
      setKnotSvgError(null);
      setInvariantsError(null);
      setKnotSvg('');
      setInvariants(null);
      try {
        const names = await api.fetchRolfNames();
        if (cancelled) return;
        setRolfNames(names);
        setRolfNamesLoading(false);
        const [knotId, diagramId] = await Promise.all([
          api.fetchKnotId(numCrossings, rolfIndex),
          api.fetchDiagramId(numCrossings, rolfIndex),
        ]);
        if (cancelled) return;
        await api.postBaseGeometryInfo(diagramId);
        if (cancelled) return;
        const geometry = await api.fetchDiagramInfo();
        if (cancelled) return;
        setKnotSvg(buildSvg(geometry));
        try {
          const currentInvariants = await api.fetchInvariantInfo(knotId);
          if (cancelled) return;
          setInvariants(currentInvariants);
          if (!hasInitializedSelectedInvariants.current) {
            setSelectedInvariantKeys(Object.keys(currentInvariants) as InvariantKey[]);
            hasInitializedSelectedInvariants.current = true;
          }
        } catch (error) {
          if (!cancelled) setInvariantsError(error instanceof Error ? error.message : 'Failed to load invariants');
        }
      } catch (error) {
        if (!cancelled) {
          setKnotSvgError(error instanceof Error ? error.message : 'Failed to load knot data');
          setInvariantsError('Invariant information could not be loaded. Please retry.');
        }
      } finally {
        if (!cancelled) {
          setRolfNamesLoading(false);
          setKnotLoading(false);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [numCrossings, rolfIndex, reload]);

  function getSinglePanelLabel(kind: ui.PanelKind) {
    return kind === 'moves' ? 'moves' : 'invariants'
  }

  function getInvariantLabel(key: InvariantKey) {
    return key.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase())
  }

  function toggleInvariantKey(key: InvariantKey) {
    setSelectedInvariantKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    )
  }

  function handleKnotSubmit(nextNumCrossings: string, nextRolfIndex: string) {
    if (knotLoading || operationInFlight.current) return;
    setKnotLoading(true);
    setNumCrossings(nextNumCrossings);
    setRolfIndex(nextRolfIndex);
  }

  async function handleMoveNoArgument(moveName: string) {
    const move = geometryMoves.movesNoArgument[moveName];

    if (!move || knotLoading || !knotSvg || operationInFlight.current) {
      return;
    }

    try {
      operationInFlight.current = true;
      setActiveMoveName(moveName);
      setKnotSvgError(null);
      const currentGeometry = await move();
      setKnotSvg(buildSvg(currentGeometry));
    } catch (error) {
      setKnotSvgError(error instanceof Error ? error.message : `Failed to apply ${moveName}`);
    } finally {
      operationInFlight.current = false;
      setActiveMoveName(null);
    }
  }

  async function handleMoveWithArgument(moveName: string, line: type.GeometricLine, handedness: TwistHandedness) {
    const move = geometryMoves.movesWithArgument[moveName];

    if (!move || knotLoading || !knotSvg || operationInFlight.current) {
      return;
    }

    try {
      operationInFlight.current = true;
      setActiveMoveName(moveName);
      setKnotSvgError(null);
      const currentGeometry = await move.fn(line, handedness);
      setKnotSvg(buildSvg(currentGeometry));
    } catch (error) {
      setKnotSvgError(error instanceof Error ? error.message : `Failed to apply ${moveName}`);
    } finally {
      operationInFlight.current = false;
      setActiveMoveName(null);
    }
  }

  function renderInvariantSelector() {
    return (
      <div className="selector_panel">
        <div className="selector_intro">
          Choose which invariants should appear in the invariants panel.
        </div>
        <div className="invariant_selector_list">
          {allInvariantKeys.map((key) => (
            <label key={key} className="invariant_selector_item">
              <input
                type="checkbox"
                checked={selectedInvariantKeys.includes(key)}
                onChange={() => toggleInvariantKey(key)}
              />
              <span>{getInvariantLabel(key)}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="panel_button panel_button--selector"
          onClick={() => setSelectedInvariantKeys(allInvariantKeys)}
        >
          Show all
        </button>
        <button type="button" className="panel_button panel_button--selector" onClick={() => setIsEditingInvariants(false)}>
          Done
        </button>
      </div>
    )
  }

  function renderInvariantRows() {
    if (invariantsError) {
      return <p className="knot_status">{invariantsError}</p>
    }
    if (!invariants) {
      return <p className="knot_status">Loading invariants...</p>
    }
    if (selectedInvariantKeys.length === 0) {
      return <p className="knot_status">No invariants selected.</p>
    }
    return (
      <div className="invariants_list">
        {selectedInvariantKeys.map((key) => (
          <div key={key} className="invariant_row">
            <div className="invariant_name">{getInvariantLabel(key)}</div>
            <div className="invariant_value">{String(invariants[key])}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderMoves() {
    return (
      <div className="moves_panel">
        <div className="move_list">
          {Object.keys(geometryMoves.movesNoArgument).map((moveName) => (
            <button
              key={moveName}
              type="button"
              className="move_action_button"
              disabled={knotLoading || !knotSvg || activeMoveName !== null}
              onClick={() => handleMoveNoArgument(moveName)}
            >
              {activeMoveName === moveName ? 'Applying...' : moveName}
            </button>
          ))}
        </div>
      </div>
    )
  }

  /*
    To render moves with arguments (add twist right now) as well
          <div className="move_list">
          {Object.entries(geometryMoves.movesWithArgument).map(([moveName, move]) => (
            <div key={moveName} className="move_with_args">
              <div className="move_name">{moveName}</div>
              {move.argKind === 'one_line_and_handedness' && (
                <OneLineMoveInput
                  disabled={knotLoading || !knotSvg || activeMoveName !== null}
                  onSubmit={(line, handedness) => handleMoveWithArgument(moveName, line, handedness)}
                />
              )}
            </div>
          ))}
        </div>
  */

  function renderPanelContent(kind: ui.PanelKind) {
    if (rolfNamesLoading) {
      return <p className="knot_status">Loading knot options...</p>
    }
    if (rolfNamesError) {
      return <p className="knot_status">{rolfNamesError}</p>
    }
    if (kind === 'moves') {
      return renderMoves()
    }
    return (
      <div className="invariants_panel_wrap">
        {renderInvariantRows()}
        <button
          type="button"
          className="panel_button panel_button--selector"
          onClick={() => setIsEditingInvariants(true)}
        >
          Change shown invariants
        </button>
      </div>
    )
  }
  return (
      <div className="background visual_background">
        {knotLoading && (
          <div className="database_notice" role="status">
            Connecting to the database may take a minute. Thanks for your patience while the knot data loads.
          </div>
        )}
        {!knotLoading && (knotSvgError || invariantsError) && (
          <div className="database_notice database_notice--error" role="alert">
            <span>{knotSvgError || invariantsError}</span>
            <button type="button" disabled={activeMoveName !== null} onClick={() => setReload((value) => value + 1)}>Retry loading knot</button>
          </div>
        )}
        <div className="container">
          <div className="knot_box">
            <fieldset className="knot_picker_fieldset" disabled={knotLoading || activeMoveName !== null}>
            <ui.KnotPicker
              rolfNames={rolfNames}
              rolfNamesLoading={rolfNamesLoading}
              numCrossings={numCrossings}
              rolfIndex={rolfIndex}
              onSubmit={handleKnotSubmit}
            />
            </fieldset>
            {knotSvg ? (
              <div className="knot_svg" dangerouslySetInnerHTML={{ __html: knotSvg }} />
            ) : (
              <p className="knot_status">
                {knotLoading ? 'Loading knot data...' :
                  rolfNamesError ? rolfNamesError  : 
                  knotSvgError ? knotSvgError :
                  `${rolfNames.length} Rolf crossing groups loaded.`
                }
              </p>
            )}
          </div>
          {isEditingInvariants ? (
            <div className="right_col">
              <div className="invariants_box panel_box panel_box--single">
                <div className="panel_header">shown invariants</div>
                <div className="panel_body">{renderInvariantSelector()}</div>
              </div>
            </div>
          ) : panelMode === 'both' ? (
            <div className="right_col right_col--split">
              <ui.ResizablePanelStack movesContent={renderPanelContent('moves')} invariantsContent={renderPanelContent('invariants')} />
              <ui.MovesOrInvariantButtons panelMode={panelMode} setPanelMode={setPanelMode} />
            </div>
          ) : (
            <div className="right_col">
              <div className={`${panelMode}_box panel_box panel_box--single`}>
                <div className="panel_header">{getSinglePanelLabel(panelMode)}</div>
                <div className="panel_body">{renderPanelContent(panelMode)}</div>
              </div>
              <ui.MovesOrInvariantButtons panelMode={panelMode} setPanelMode={setPanelMode} />
            </div>
          )}
        </div>
      </div>
  )
}

export default VisualComponent
