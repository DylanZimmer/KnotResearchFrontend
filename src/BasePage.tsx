import { useEffect, useState } from 'react';
import './App.css';
import * as api from '../services/api';
import * as type from '../services/types';
import * as ui from '../services/ui';
import * as geometryMoves from '../services/functions/geometry_moves';
import { buildSvg } from '../services/buildSvg';

type InvariantKey = keyof type.Invariants;

function BasePage() {
  const [rolfNames, setRolfNames] = useState<type.RolfKnotNames>([]);
  const [rolfNamesLoading, setRolfNamesLoading] = useState(true);
  const [rolfNamesError, setRolfNamesError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<ui.PanelMode>('both');
  const [invariants, setInvariants] = useState<type.Invariants | null>(null);
  const [selectedInvariantKeys, setSelectedInvariantKeys] = useState<InvariantKey[]>([]);
  const [hasInitializedSelectedInvariants, setHasInitializedSelectedInvariants] = useState(false);
  const [invariantsError, setInvariantsError] = useState<string | null>(null);
  const [isEditingInvariants, setIsEditingInvariants] = useState(false);
  const [numCrossings, setNumCrossings] = useState("3");
  const [rolfIndex, setRolfIndex] = useState("1");
  const [knotSvg, setKnotSvg] = useState("");
  const [knotSvgError, setKnotSvgError] = useState<string | null>(null);
  const [activeMoveName, setActiveMoveName] = useState<string | null>(null);
  const allInvariantKeys = invariants ? Object.keys(invariants) as InvariantKey[] : [];

  useEffect(() => {
    async function loadOnStartup() {
      try {
        const names = await api.fetchRolfNames();
        const currentGeometry = await api.fetchRolfDiagramInfo(1); //hardcode to open on trefoil
        const currentInvariants = await api.fetchInvariantInfo(1); //hardcode to open on trefoil
        setKnotSvg(buildSvg(currentGeometry));
        setInvariants(currentInvariants);
        setSelectedInvariantKeys(Object.keys(currentInvariants) as InvariantKey[]);
        setHasInitializedSelectedInvariants(true);
        setInvariantsError(null);
        setRolfNames(names)
        setRolfNamesError(null)
      } catch (error) {
        setRolfNames([])
        setRolfNamesError(error instanceof Error ? error.message : 'Failed to load Rolf names',);
      } finally {
        setRolfNamesLoading(false);
      }
    }
    loadOnStartup()
  }, [])

  useEffect(() => {
    async function loadKnotSvg() {
      if (!numCrossings || !rolfIndex) {
        setKnotSvg("")
        return
      }
      try {
        setKnotSvg("")
        setKnotSvgError(null)
        setInvariantsError(null)
        const knot_id = await api.fetchKnotId(numCrossings, rolfIndex);
        const diagram_id = await api.fetchDiagramId(numCrossings, rolfIndex);
        await api.postBaseGeometryInfo(diagram_id);
        const currentGeometry = await api.fetchDiagramInfo();
        setKnotSvg(buildSvg(currentGeometry));
        setKnotSvgError(null)
        const currentInvariants = await api.fetchInvariantInfo(knot_id);
        setInvariants(currentInvariants);
        if (!hasInitializedSelectedInvariants) {
          setSelectedInvariantKeys(Object.keys(currentInvariants) as InvariantKey[]);
          setHasInitializedSelectedInvariants(true);
        }
        setInvariantsError(null);
      } catch (error) {
        setKnotSvg("")
        setKnotSvgError(error instanceof Error ? error.message : 'Failed to load knot diagram')
        setInvariantsError(error instanceof Error ? error.message : 'Failed to load invariant info')
      }
    }
    loadKnotSvg()
  }, [numCrossings, rolfIndex])

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

  async function handleKnotSubmit(nextNumCrossings: string, nextRolfIndex: string) {
    try {
      setKnotSvgError(null)
      const diagramId = await api.fetchDiagramId(nextNumCrossings, nextRolfIndex);
      await api.postBaseGeometryInfo(diagramId);
      setNumCrossings(nextNumCrossings);
      setRolfIndex(nextRolfIndex);
    } catch (error) {
      setKnotSvgError(error instanceof Error ? error.message : 'Failed to prepare knot diagram');
    }
  }

  async function handleMoveNoArgument(moveName: string) {
    const move = geometryMoves.movesNoArgument[moveName];

    if (!move) {
      return;
    }

    try {
      setActiveMoveName(moveName);
      setKnotSvgError(null);
      const currentGeometry = await move();
      setKnotSvg(buildSvg(currentGeometry));
    } catch (error) {
      setKnotSvgError(error instanceof Error ? error.message : `Failed to apply ${moveName}`);
    } finally {
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
              disabled={activeMoveName !== null}
              onClick={() => handleMoveNoArgument(moveName)}
            >
              {activeMoveName === moveName ? 'Applying...' : moveName}
            </button>
          ))}
        </div>
      </div>
    )
  }

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
    <div className="background">
      <div className="container">
        <div className="knot_box">
          <ui.KnotPicker
            rolfNames={rolfNames}
            rolfNamesLoading={rolfNamesLoading}
            numCrossings={numCrossings}
            rolfIndex={rolfIndex}
            onSubmit={handleKnotSubmit}
          />
          {knotSvg ? (
            <div className="knot_svg" dangerouslySetInnerHTML={{ __html: knotSvg }} />
          ) : (
            <p className="knot_status">
              {rolfNamesLoading ? 'Loading knot options...' :
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

export default BasePage
