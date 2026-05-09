import { useEffect, useState } from 'react';
import './App.css';
import * as api from '../services/api';
import * as type from '../services/types';
import * as ui from '../services/ui';
import { buildSvg } from '../services/buildSvg';

function BasePage() {
  const [rolfNames, setRolfNames] = useState<type.RolfKnotNames>([]);
  const [rolfNamesLoading, setRolfNamesLoading] = useState(true);
  const [rolfNamesError, setRolfNamesError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<ui.PanelMode>('both');
  const [isEditingInvariants, setIsEditingInvariants] = useState(false);
  const [numCrossings, setNumCrossings] = useState("3");
  const [rolfIndex, setRolfIndex] = useState("1");
  const [knotSvg, setKnotSvg] = useState("");

  useEffect(() => {
    async function loadOnStartup() {
      try {
        const names = await api.fetchRolfNames();
        const currentGeometry = await api.fetchDiagramInfo(numCrossings, rolfIndex);
        setKnotSvg(buildSvg(currentGeometry));
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

  function getSinglePanelLabel(kind: ui.PanelKind) {
    return kind === 'moves' ? 'moves' : 'invariants'
  }

  function renderInvariantSelector() {
    return (
      <div className="selector_panel">
        <div className="selector_intro">
          Choose which invariants should appear in the invariants panel.
        </div>
        <button
          type="button"
          className="panel_button panel_button--selector"
          onClick={() => setIsEditingInvariants(false)}
        >
          Done
        </button>
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
      return <p className="knot_status">Moves will appear here.</p>
    }
    return (
      <div className="invariants_panel_wrap">
        <p className="knot_status">{rolfNames.length} Rolf crossing groups loaded.</p>
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
          {knotSvg ? (
            <div className="knot_svg" dangerouslySetInnerHTML={{ __html: knotSvg }} />
          ) : (
            <p className="knot_status">
              {rolfNamesLoading ? 'Loading knot options...' :
                rolfNamesError ? rolfNamesError  : 
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
