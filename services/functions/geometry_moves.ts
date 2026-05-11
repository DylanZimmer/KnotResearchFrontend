import * as api from '../api'
import type { Geometry } from '../types'

export type GeometryMoveNoArgument = () => Promise<Geometry>

async function mirror(): Promise<Geometry> {
  await api.performMirrorGeometry()
  return api.fetchDiagramInfo()
}

async function flipOrientation(): Promise<Geometry> {
  await api.performOrientationFlipGeometry()
  return api.fetchDiagramInfo()
}

export const movesNoArgument: Record<string, GeometryMoveNoArgument> = {
  'Flip Orientation': flipOrientation,
  Mirror: mirror,
}
