import assert from 'node:assert/strict'
import test from 'node:test'

import type { ModelInfo, ProviderHealth } from '../src/shared/types'
import { preferredBuffyModel, selectableBuffyModels } from '../src/app/lib/buffy-model-health'

function lane(overrides: Partial<ProviderHealth>): ProviderHealth {
  return {
    id: 'deepseek',
    name: 'DeepSeek V4.1 Flash',
    description: '',
    model: 'deepseek-ai/deepseek-v4.1-flash',
    family: 'DeepSeek',
    status: 'healthy',
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
    lastErrorCode: null,
    latencyMs: null,
    consecutiveFailures: 0,
    lastCheckedAt: null,
    nextProbeAt: null,
    ...overrides,
  }
}

function model(id: string, available = true): ModelInfo {
  return { id, name: id, description: '', available }
}

const catalogue = [model('claude-haiku-5-5'), model('gpt-6-luna')]

test('offers Dent only while a DeepSeek V4.1 lane is working', () => {
  const down = [
    lane({ status: 'down', lastErrorCode: 'unavailable' }),
    lane({
      id: 'deepseek-r1',
      name: 'DeepSeek R1 Distill 32B',
      model: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
      status: 'healthy',
    }),
  ]
  assert.deepEqual(selectableBuffyModels(down, catalogue), ['gpt-6-luna', 'claude-haiku-5-5'])
  assert.deepEqual(selectableBuffyModels(undefined, catalogue), ['gpt-6-luna', 'claude-haiku-5-5'])

  const up = [lane({ status: 'healthy' })]
  assert.deepEqual(selectableBuffyModels(up, catalogue), ['dent', 'gpt-6-luna', 'claude-haiku-5-5'])
})

test('a blocking provider error hides Dent even when another lane looks healthy', () => {
  const providers = [lane({ status: 'healthy', lastErrorCode: 'invalid_key' })]
  assert.ok(!selectableBuffyModels(providers, catalogue).includes('dent'))
})

test('hides a Duck model the server catalogue marks unavailable', () => {
  assert.deepEqual(selectableBuffyModels([], [model('claude-haiku-5-5', false), model('gpt-6-luna')]), [
    'gpt-6-luna',
  ])
})

test('replaces a hidden selection with the measured Claude default', () => {
  assert.equal(preferredBuffyModel(['gpt-6-luna', 'claude-haiku-5-5'], 'dent'), 'claude-haiku-5-5')
  assert.equal(preferredBuffyModel(['gpt-6-luna', 'claude-haiku-5-5'], 'gpt-6-luna'), 'gpt-6-luna')
  assert.equal(preferredBuffyModel(['gpt-6-luna'], 'dent'), 'gpt-6-luna')
  assert.equal(preferredBuffyModel([], 'dent'), 'dent')
})
