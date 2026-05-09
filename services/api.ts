import type { RolfKnotNames, Geometry } from './types'

const apiBaseUrl = 'https://knots-backend-smjr.onrender.com'


export async function fetchRolfNames(): Promise<RolfKnotNames> {
  const res = await fetch(`${apiBaseUrl}/api/knots/rolf_names`);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'Failed to load knot names');
  }
  return payload;
};

export async function fetchDiagramInfo(num_crossings: string, rolf_index: string): Promise<Geometry> {
  const res0 = await fetch(`${apiBaseUrl}/api/knots/diagram_id?num_crossings=${num_crossings}&rolf_index=${rolf_index}`);
  const diagramId = await res0.json();
  if (!res0.ok) {
    throw new Error(diagramId?.error || 'Failed to load diagram id');
  }
  const res1 = await fetch(`${apiBaseUrl}/api/knots/diagram_info?diagramId=${diagramId}`);
  const payload = await res1.json();
  if (!res1.ok) {
    throw new Error(payload?.error || 'Failed to load diagram info');
  }
  return payload;
};
