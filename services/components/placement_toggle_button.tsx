import type { Placement } from '../types.ts';


type Props = {
  value: Placement;
  onChange: (value: Placement) => void;
  disabled?: boolean;
}

export function PlacementToggle({ value, onChange, disabled = false }: Props) {
  const labels: Record<Placement, string> = {
    over: 'O',
    under: 'U',
  };

  return (
    <div className="placement_toggle" aria-label="Over or under">
      {(['over', 'under'] as Placement[]).map(p => (
        <button
          key={p}
          type="button"
          className={`placement_option ${value === p ? 'placement_option--selected' : ''}`}
          aria-label={p}
          aria-pressed={value === p}
          disabled={disabled}
          onClick={() => onChange(p)}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  );
}
