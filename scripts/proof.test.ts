import assert from 'node:assert/strict'
import test from 'node:test'

import { buildContract, kindFor } from '../src/worker/proof'

test('a stated equation is checked as arithmetic', () => {
  assert.equal(kindFor('Verify that 17 × 24 = 408, then answer in one short sentence.'), 'math')
  assert.equal(kindFor('Calculate 20% of 450'), 'math')
  assert.equal(kindFor('What is the capital of France?'), 'general')
})

test('an arithmetic contract requires a recomputation check', () => {
  const contract = buildContract('Verify that 17 × 24 = 408')
  assert.equal(contract.kind, 'math')
  assert.deepEqual(contract.requirements.map((item) => item.id), ['arithmetic'])
})
