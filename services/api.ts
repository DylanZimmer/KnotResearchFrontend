import type { RolfKnotNames, Geometry, Invariants, GeometricLine, CrossingSpec, Handedness } from './types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080' : 'https://knots-backend-smjr.onrender.com')).replace(/\/$/, '');

// Match the experiment controller's class-level @RequestMapping.
const experimentsUrl = `${apiBaseUrl}/api/experiments`;

export async function startExperiment(knotIds: number[]): Promise<number> {
  const res = await fetch(`${experimentsUrl}/start_experiment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(knotIds),
  });
  if (!res.ok) throw new Error(`Failed to start experiment (${res.status})`);
  const body = await res.text();
  if (!body.trim()) {
    throw new Error('The experiment was started, but start_experiment must return its experiment ID before moves can run.');
  }
  const payload = JSON.parse(body);
  const experimentId = typeof payload === 'number' ? payload : payload?.experimentId;
  if (!Number.isSafeInteger(experimentId) || experimentId < 0) {
    throw new Error('The experiment was started, but the server returned an invalid experiment ID.');
  }
  return experimentId;
}

async function postExperimentMove(endpoint: string, params: Record<string, string>) {
  const res = await fetch(`${experimentsUrl}/${endpoint}?${new URLSearchParams(params)}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to perform move (${res.status})`);
}

export async function performMoveSingleInstance(experimentId: number, ogKnotId: number, stateNum: number, move: string) {
  await postExperimentMove('perform_move_single_instance', {
    experimentId: String(experimentId), ogKnotId: String(ogKnotId), stateNum: String(stateNum), move,
  });
}

export async function performMoveForState(experimentId: number, stateNum: number, move: string) {
  await postExperimentMove('perform_move_for_state', {
    experimentId: String(experimentId), stateNum: String(stateNum), move,
  });
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asNumber(value: unknown, field: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid ${field} in diagram info`);
  }
  return number;
}

function asNullableNumber(value: unknown, field: string): number | null {
  return value === null || value === undefined ? null : asNumber(value, field);
}

/** Convert database-shaped diagram rows to the compact format used by buildSvg. */
export function normalizeGeometry(payload: unknown): Geometry {
  if (!isRecord(payload)) {
    throw new Error('Unexpected diagram info response');
  }

  const crossings = payload.crossing_specs;
  if (!Array.isArray(crossings)) {
    throw new Error('Diagram info is missing crossing_specs');
  }

  const vertexRows = payload.vertices_and_arrows;
  const sortedVertices = Array.isArray(vertexRows)
    ? vertexRows.map((row) => {
        if (!isRecord(row)) throw new Error('Invalid vertices_and_arrows row');
        return {
          point: asNumber(row.point, 'point'),
          position: [
            asNumber(row.strand_x, 'strand_x'),
            asNumber(row.strand_y, 'strand_y'),
          ] as [number, number],
        };
      }).sort((left, right) => left.point - right.point)
    : Array.isArray(payload.vertex_positions)
      ? payload.vertex_positions.map((position, point) => {
          if (!Array.isArray(position) || position.length < 2) {
            throw new Error('Invalid vertex_positions entry');
          }
          return {
            point,
            position: [
              asNumber(position[0], 'vertex x'),
              asNumber(position[1], 'vertex y'),
            ] as [number, number],
          };
        })
      : (() => { throw new Error('Diagram info is missing vertex positions'); })();

  if (sortedVertices.length === 0) {
    throw new Error('Diagram info contains no vertices');
  }

  const pointIndexes = new Map(sortedVertices.map((vertex, index) => [vertex.point, index]));
  // `point` is the traversal order. Each line runs to the next point and the
  // final line closes the knot back to the first point.
  const arrows = sortedVertices.map((vertex, index) => {
    const nextPoint = sortedVertices[(index + 1) % sortedVertices.length].point;
    return [pointIndexes.get(vertex.point)!, pointIndexes.get(nextPoint)!] as [number, number];
  });

  const crossing_specs: CrossingSpec[] = crossings.map((row): CrossingSpec => {
    if (Array.isArray(row)) return row as Geometry['crossing_specs'][number];
    if (!isRecord(row)) throw new Error('Invalid crossing_specs row');
    const underLine = asNullableNumber(row.under_line, 'under_line');
    const overLine = asNullableNumber(row.over_line, 'over_line');
    return [
      asNumber(row.crossing_id, 'crossing_id'),
      underLine === null ? null : pointIndexes.get(underLine) ?? underLine,
      overLine === null ? null : pointIndexes.get(overLine) ?? overLine,
      asNumber(row.crossing_x, 'crossing_x'),
      asNumber(row.crossing_y, 'crossing_y'),
    ];
  }).sort((left, right) => left[0] - right[0]);

  let handedness : Handedness;
  if (payload.handedness != "L" && payload.handedness != "R") {
    handedness = "R";
  } else {
    handedness = payload.handedness as Handedness;
  }

  return {
    vertex_positions: sortedVertices.map((vertex) => vertex.position),
    arrows,
    crossing_specs,
    handedness
  };
}

export async function fetchRolfNames(): Promise<RolfKnotNames> {
  const res = await fetch(`${apiBaseUrl}/api/knots/rolf_names`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load knot names');
  }
  return payload;
};

export async function fetchKnotId(num_crossings: string, rolf_index: string): Promise<number> {
  const res = await fetch(`${apiBaseUrl}/api/knots/knot_id?num_crossings=${num_crossings}&rolf_index=${rolf_index}`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load diagram id');
  }
  return payload;
}

export async function fetchDiagramId(num_crossings: string, rolf_index: string): Promise<number> {
  const res = await fetch(`${apiBaseUrl}/api/knots/diagram_id?num_crossings=${num_crossings}&rolf_index=${rolf_index}`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load diagram id');
  }
  return payload;
}

export async function fetchDiagramInfo(): Promise<Geometry> {
  const res = await fetch(`${apiBaseUrl}/api/geom/diagram_info`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load diagram info');
  }
  return normalizeGeometry(payload);
};

export async function fetchRolfDiagramInfo(diagramId: number): Promise<Geometry> {
  const res = await fetch(`${apiBaseUrl}/api/geom/diagram_info?diagramId=${diagramId}`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load diagram info');
  }
  return normalizeGeometry(payload);
};

export async function fetchInvariantInfo(knotId: number): Promise<Invariants> {
  const res = await fetch(`${apiBaseUrl}/api/rolf/rolf_invariants?knotId=${knotId}`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load invariant info');
  }
  return payload;
};

export async function postBaseGeometryInfo(knotId: number) {
  const res = await fetch(`${apiBaseUrl}/api/moves/populate_current?knotId=${knotId}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to copy geometry data");
  }
};

export async function performMirrorGeometry() {
  const res = await fetch(`${apiBaseUrl}/api/moves/mirror`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to create mirror knot");
  }
}

export async function performOrientationFlipGeometry() {
  const res = await fetch(`${apiBaseUrl}/api/moves/orientation_flip`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to flip knot orientation");
  }
}

export async function performAddTwist(line: GeometricLine, handedness: string) {
  const res = await fetch(`${apiBaseUrl}/api/knots/add_twist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", },
    body: JSON.stringify({ line, handedness }),
  });
  if (!res.ok) {
    throw new Error("Failed to add twist");
  }
}
