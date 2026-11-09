import assert from 'node:assert/strict'
import test from 'node:test'

import { modelTrait } from '../src/shared/model-traits'

test('every free family has one best-at label', () => {
  const families: [string, string][] = [
    ['Nemotron', 'Reasoning'],
    ['Qwen', 'Coding'],
    ['North', 'Coding'],
    ['GPT', 'Reasoning'],
    ['OpenRouter', 'Router'],
    ['Muse', 'Creative'],
    ['Kilo', 'Router'],
    ['Dots', 'Notes'],
    ['Liquid', 'Fast'],
    ['GLM', 'Coding'],
    ['Codestral', 'Coding'],
    ['Mistral', 'Writing'],
    ['Ministral', 'Fast'],
    ['Laguna', 'Coding'],
    ['Llama', 'General'],
    ['DeepSeek', 'Coding'],
    ['Command', 'Writing'],
    ['Gemma', 'Fast'],
    ['Flint', 'General'],
    ['Xing', 'General'],
    ['Stealth', 'Experimental'],
    ['Kimi', 'Reasoning'],
    ['Claude', 'Writing'],
    ['Gemini', 'Long docs'],
    ['MiniMax', 'Coding'],
  ]

  for (const [family, expected] of families) {
    assert.equal(modelTrait({ id: family.toLowerCase(), name: family, family }), expected, family)
  }
})

test('keyed API model names get the same labels without a family', () => {
  assert.equal(modelTrait({ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }), 'Coding')
  assert.equal(modelTrait({ id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' }), 'Writing')
  assert.equal(modelTrait({ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }), 'Reasoning')
  assert.equal(modelTrait({ id: 'gemini-4-argon', name: 'Gemini 4 Argon' }), 'Long docs')
})

test('an unrecognised model still gets a label', () => {
  assert.equal(modelTrait({ id: 'mystery', name: 'Mystery' }), 'General')
})
