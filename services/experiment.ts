import type { MoveType, Placement } from './types'

export type LocationType = 'strand' | 'crossing' | 'face'
export type LocationArgument =
  | { type: 'strand'; source: 'any' }
  | { type: 'strand'; source: 'built'; strandId: string }
  | { type: 'crossing'; source: 'any' }
  | { type: 'crossing'; source: 'built'; crossingId: string }
  | { type: 'face'; source: 'any' }
  | { type: 'face'; source: 'built'; faceId: string }

export type CrossingProperties = {
  sign: 'any' | 'positive' | 'negative'
  role: 'any' | Placement
}
export type BuiltCrossing = CrossingProperties & { id: string; name: string }
export type StrandProperties = {
  firstCrossingId: string
  secondCrossingId: string
  orientation: 'any' | 'with' | 'against'
}
export type BuiltStrand = StrandProperties & { id: string; name: string }
export type FaceProperties = { sides: number | null }
export type BuiltFace = FaceProperties & { id: string; name: string }
export type LocationRequirement = { types: readonly LocationType[]; allowAny: boolean }
type MoveDefinition = { label: string; locationArguments: readonly LocationRequirement[] }
const strand: LocationRequirement = { types: ['strand'], allowAny: true }

export const experimentMoves = {
  mirror: { label: 'Mirror', locationArguments: [] },
  orientation_flip: { label: 'Orientation Flip', locationArguments: [] },
  addTwist: { label: 'Add Twist', locationArguments: [strand] },
  poke: { label: 'Poke', locationArguments: [strand, strand] },
  slide: { label: 'Slide', locationArguments: [{ types: ['strand', 'crossing'], allowAny: true }] },
  saddle: { label: 'Saddle', locationArguments: [strand, strand] },
  r2: { label: 'Add R2', locationArguments: [strand, strand] },
  r3: { label: 'R3', locationArguments: [{ types: ['face'], allowAny: true }] },
} satisfies Record<string, MoveDefinition>

export type ExperimentMove = keyof typeof experimentMoves
export type ExperimentStep = { id: number; algorithm: ExperimentMove; locations: LocationArgument[]; twistSign: 'pos' | 'neg'; until: number }
export const hasRepeatCount = (move: ExperimentMove): boolean => move !== 'mirror' && move !== 'orientation_flip'
export function createExperimentStep(id: number, algorithm: ExperimentMove): ExperimentStep {
  const definition: MoveDefinition = experimentMoves[algorithm]
  return { id, algorithm, twistSign: 'pos', until: 1, locations: definition.locationArguments.map(({ types }) => ({ type: types[0], source: 'any' })) }
}
export type AddTwistRequest = {
  type: Extract<MoveType, 'addTwist'>
  location: { crossing_before: { sign: 'pos' | 'neg' | null; placement: Placement | null } | null; crossing_after: { sign: 'pos' | 'neg' | null; placement: Placement | null } | null; orientedWith: boolean | null }
  typeSpecificChoice: 'pos' | 'neg'
  until: number
}

export function toMoveRequests(steps: ExperimentStep[], crossings: BuiltCrossing[], strands: BuiltStrand[]): AddTwistRequest[] {
  const crossingDto = (id: string) => {
    const crossing = crossings.find((item) => item.id === id)
    if (!crossing) throw new Error('A selected crossing no longer exists.')
    return { sign: crossing.sign === 'any' ? null : crossing.sign === 'positive' ? 'pos' as const : 'neg' as const, placement: crossing.role === 'any' ? null : crossing.role }
  }
  return steps.map((step) => {
    if (step.algorithm !== 'addTwist') throw new Error(`${experimentMoves[step.algorithm].label} has no active backend request DTO yet.`)
    if (!Number.isSafeInteger(step.until) || step.until < 1) throw new Error('Move repetitions must be a positive whole number.')
    const selection = step.locations[0]
    if (!selection || selection.type !== 'strand') throw new Error('Add Twist requires a strand location.')
    let location: AddTwistRequest['location'] = { crossing_before: null, crossing_after: null, orientedWith: null }
    if (selection.source === 'built') {
      const strand = strands.find((item) => item.id === selection.strandId)
      if (!strand) throw new Error('A selected strand no longer exists.')
      location = { crossing_before: crossingDto(strand.firstCrossingId), crossing_after: crossingDto(strand.secondCrossingId), orientedWith: strand.orientation === 'any' ? null : strand.orientation === 'with' }
    }
    return { type: 'addTwist', location, typeSpecificChoice: step.twistSign, until: step.until }
  })
}
export const defaultStrandProperties = (): StrandProperties => ({ firstCrossingId: '', secondCrossingId: '', orientation: 'any' })
export const defaultCrossingProperties = (): CrossingProperties => ({ sign: 'any', role: 'any' })
export function crossingName(index: number): string {
  return objectName('Crossing', index)
}
export function strandName(index: number): string {
  return objectName('Strand', index)
}
export function faceName(index: number): string {
  return objectName('Face', index)
}
function objectName(type: string, index: number): string {
  let letters = ''
  for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) {
    letters = String.fromCharCode(65 + (number - 1) % 26) + letters
  }
  return `${type} ${letters}`
}
