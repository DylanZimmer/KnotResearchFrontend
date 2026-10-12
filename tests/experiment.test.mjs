import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../services/experiment.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { createExperimentStep, experimentMoves, strandName, defaultStrandProperties, toMoveRequests, hasRepeatCount } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('moves require only the specified location objects', () => {
  const signatures = {
    addTwist: [['strand']], poke: [['strand'], ['strand']],
    slide: [['strand', 'crossing']], saddle: [['strand'], ['strand']],
    r2: [['strand'], ['strand']], r3: [['face']], mirror: [], orientation_flip: [],
  }
  for (const [move, signature] of Object.entries(signatures)) {
    assert.deepEqual(experimentMoves[move].locationArguments.map((argument) => argument.types), signature)
    const step = createExperimentStep(1, move)
    assert.deepEqual(step.locations.map((argument) => argument.type), signature.map((types) => types[0]))
  }
})

test('step locations are independent and can share a stable built strand reference', () => {
  const first = createExperimentStep(1, 'r2')
  const second = createExperimentStep(2, 'saddle')
  first.locations[0] = { type: 'strand', source: 'built', strandId: 'strand-0' }
  assert.deepEqual(first.locations[1], { type: 'strand', source: 'any' })
  assert.deepEqual(second.locations[0], { type: 'strand', source: 'any' })
  second.locations[0] = { ...first.locations[0] }
  first.locations[0] = { type: 'strand', source: 'any' }
  assert.equal(second.locations[0].strandId, 'strand-0')
})

test('strand names continue beyond Z and new builder drafts are independent', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52].map(strandName),
    ['Strand A', 'Strand B', 'Strand Z', 'Strand AA', 'Strand AB', 'Strand AZ', 'Strand BA'])
  const draft = defaultStrandProperties()
  draft.firstCrossingId = 'crossing-0'
  assert.deepEqual(defaultStrandProperties(), { firstCrossingId: '', secondCrossingId: '', orientation: 'any' })
})

test('Add Twist requests use the existing Java record fields and enum values', () => {
  const step = createExperimentStep(1, 'addTwist')
  assert.deepEqual(toMoveRequests([step], [], []), [{
    type: 'addTwist', location: { crossing_before: null, crossing_after: null, orientedWith: null },
    typeSpecificChoice: 'pos', until: 1,
  }])
  step.twistSign = 'neg'
  step.until = 5
  step.locations[0] = { type: 'strand', source: 'built', strandId: 'strand-0' }
  const crossings = [
    { id: 'a', sign: 'positive', role: 'over' },
    { id: 'b', sign: 'any', role: 'under' },
  ]
  const strands = [{ id: 'strand-0', firstCrossingId: 'a', secondCrossingId: 'b', orientation: 'against' }]
  assert.deepEqual(toMoveRequests([step], crossings, strands)[0], {
    type: 'addTwist', location: { crossing_before: { sign: 'pos', placement: 'over' }, crossing_after: { sign: null, placement: 'under' }, orientedWith: false },
    typeSpecificChoice: 'neg', until: 5,
  })
  assert.throws(() => toMoveRequests([step], crossings, []), /strand no longer exists/)
  assert.throws(() => toMoveRequests([createExperimentStep(2, 'mirror')], [], []), /no active backend request DTO/)
})

test('repeat counts exclude Mirror and Orientation Flip and reject invalid counts', () => {
  for (const move of Object.keys(experimentMoves)) {
    assert.equal(hasRepeatCount(move), move !== 'mirror' && move !== 'orientation_flip')
  }
  const step = createExperimentStep(1, 'addTwist')
  for (const until of [NaN, 0, -1, 1.5, Infinity]) {
    step.until = until
    assert.throws(() => toMoveRequests([step], [], []), /positive whole number/)
  }
})
