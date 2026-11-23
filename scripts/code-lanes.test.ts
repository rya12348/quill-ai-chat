import assert from 'node:assert/strict'
import test from 'node:test'

import { CODE_LANE_ORDER, codeLanes, type PublicLane } from '../src/worker/public-ai'

const lane = (model: string): PublicLane => ({
  url: `https://${model.replace(/[^a-z0-9]+/gi, '-')}.example/v1/chat/completions`,
  model,
  label: model,
  description: 'test',
})

test('the coder gets the measured lane first, whatever order it arrived in', () => {
  const best = CODE_LANE_ORDER[0]!
  const ordered = codeLanes([lane('strong-but-untested'), lane('other'), lane(best)])
  assert.equal(ordered[0]!.model, best)
})

test('the measured list is ordered, and unknown lanes keep their relative order', () => {
  const ordered = codeLanes([...CODE_LANE_ORDER].reverse().map(lane).concat([lane('untested-a'), lane('untested-b')]))
  assert.deepEqual(
    ordered.slice(0, CODE_LANE_ORDER.length).map((entry) => entry.model),
    [...CODE_LANE_ORDER],
  )
  assert.deepEqual(ordered.slice(CODE_LANE_ORDER.length).map((entry) => entry.model), ['untested-a', 'untested-b'])
})

test('ordering a copy leaves the caller list alone', () => {
  const input = [lane('untested'), lane(CODE_LANE_ORDER[0]!)]
  const before = input.map((entry) => entry.model)
  codeLanes(input)
  assert.deepEqual(input.map((entry) => entry.model), before)
})
