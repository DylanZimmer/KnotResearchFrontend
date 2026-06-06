import * as api from '../api'
import type { Geometry, GeometricLine } from '../types'

export type GeometryMoveNoArgument = () => Promise<Geometry>;
export type GeometryMoveWithArgument = {
  fn: (line: GeometricLine, handedness: string) => Promise<Geometry>;
  argKind: 'one_line_and_handedness';
};

async function mirror(): Promise<Geometry> {
  await api.performMirrorGeometry();
  return api.fetchDiagramInfo();
}

async function flipOrientation(): Promise<Geometry> {
  await api.performOrientationFlipGeometry();
  return api.fetchDiagramInfo();
}

export const movesNoArgument: Record<string, GeometryMoveNoArgument> = {
  'Flip Orientation': flipOrientation,
  Mirror: mirror,
}


async function addTwist(line: GeometricLine, handedness: string): Promise<Geometry> {
  //await api.addTwist(cidx, oux, cidy, ouy);   //This might be better to pass to backend
  await api.performAddTwist(line, handedness);
  return api.fetchDiagramInfo();
}

export const movesWithArgument: Record<string, GeometryMoveWithArgument> = {
  'Add Twist': { fn: addTwist, argKind: 'one_line_and_handedness' },
}
