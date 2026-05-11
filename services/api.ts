import type { RolfKnotNames, Geometry, Invariants } from './types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

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
  const res = await fetch(`${apiBaseUrl}/api/knots/diagram_info`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load diagram info');
  }
  return payload;
};

export async function fetchRolfDiagramInfo(diagramId: number): Promise<Geometry> {
  const res = await fetch(`${apiBaseUrl}/api/knots/diagram_info?diagramId=${diagramId}`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load diagram info');
  }
  return payload;
};

export async function fetchInvariantInfo(knotId: number): Promise<Invariants> {
  const res = await fetch(`${apiBaseUrl}/api/knots/rolf_invariants?knotId=${knotId}`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load invariant info');
  }
  return payload;
};

export async function postBaseGeometryInfo(diagramId: number) {
  const res = await fetch(`${apiBaseUrl}/api/knots/copy_over?diagramId=${diagramId}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to copy geometry data");
  }
};

export async function performMirrorGeometry() {
  const res = await fetch(`${apiBaseUrl}/api/knots/mirror`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to flip knot orientation");
  }
}

export async function performOrientationFlipGeometry() {
  const res = await fetch(`${apiBaseUrl}/api/knots/orientation_flip`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to create mirror knot");
  }
}
