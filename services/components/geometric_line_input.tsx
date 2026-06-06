import type { GeometricLine } from '../types';
import { PlacementToggle } from './placement_toggle_button'

type Props = {
  value: GeometricLine;
  onChange: (value: GeometricLine) => void;
}

export function GeometricLineInput({ value, onChange }: Props) {
  function update(patch: Partial<GeometricLine>) {
    onChange({ ...value, ...patch });
  }

  function updatePlacement1(placement1: GeometricLine['placement1']) {
    onChange({
      ...value,
      placement1,
      placement2: placement1 === 'over' ? 'under' : 'over',
    });
  }

  return (
    <div className="geometric_line_input">
      <div className="crossing_pair">
        <label className="crossing_id_box">
          <span className="crossing_id_prefix">C</span>
          <input
            type="number"
            className="crossing_id_input"
            aria-label="First crossing id"
            value={value.cid1}
            onFocus={e => e.target.select()}
            onChange={e => update({ cid1: Number(e.target.value) })}
          />
        </label>
        <PlacementToggle
          value={value.placement1}
          onChange={updatePlacement1}
        />
      </div>
      <div className="crossing_pair">
        <label className="crossing_id_box">
          <span className="crossing_id_prefix">C</span>
          <input
            type="number"
            className="crossing_id_input"
            aria-label="Second crossing id"
            value={value.cid2}
            onFocus={e => e.target.select()}
            onChange={e => update({ cid2: Number(e.target.value) })}
          />
        </label>
        <PlacementToggle
          value={value.placement2}
          onChange={p => update({ placement2: p })}
          disabled
        />
      </div>
    </div>
  );
}
