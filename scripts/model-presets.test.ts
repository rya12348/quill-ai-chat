import assert from 'node:assert/strict'
import test from 'node:test'

import type { ModelInfo } from '../src/shared/types'
import { resolvePresetModel } from '../src/app/lib/model-presets'

const models: ModelInfo[] = [
  { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', description: '', available: true },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', description: '', available: true },
  { id: 'retired-pro', name: 'Retired Pro', description: '', available: false },
]

test('Fast picks a quick model', () => {
  assert.equal(resolvePresetModel('fast', 'blend', models), 'deepseek-v4.1-flash')
})

test('Best picks a stronger model and ignores unavailable offers', () => {
  assert.equal(resolvePresetModel('best', 'fast', models), 'claude-sonnet-5-5')
})

test('Auto uses a quick model for plain chat and a stronger one for task modes', () => {
  assert.equal(resolvePresetModel('auto', 'fast', models), 'deepseek-v4.1-flash')
  assert.equal(resolvePresetModel('auto', 'build', models), 'claude-sonnet-5-5')
})

test('Manual leaves model choice to the explicit picker', () => {
  assert.equal(resolvePresetModel('manual', 'fast', models), undefined)
})

test('No offered model produces no preset override', () => {
  assert.equal(resolvePresetModel('auto', 'fast', []), undefined)
})
