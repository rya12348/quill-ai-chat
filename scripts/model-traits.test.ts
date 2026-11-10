import assert from 'node:assert/strict'
import test from 'node:test'

import { modelTrait } from '../src/shared/model-traits'

const FAMILIES: [string, string][] = [
  ['Nemotron', 'Reasoning'],
  ['Qwen', 'Math'],
  ['North', 'Code review'],
  ['GPT', 'Knowledge'],
  ['OpenRouter', 'Routing'],
  ['Muse', 'Creative'],
  ['Kilo', 'Fallback'],
  ['Dots', 'Notes'],
  ['Liquid', 'Speed'],
  ['GLM', 'Tools'],
  ['Codestral', 'Code edits'],
  ['Mistral', 'Writing'],
  ['Ministral', 'Quick tasks'],
  ['Laguna', 'Code search'],
  ['Llama', 'General'],
  ['DeepSeek', 'Coding'],
  ['Command', 'Business'],
  ['Gemma', 'Fast answers'],
  ['Flint', 'Everyday'],
  ['Xing', 'Concise'],
  ['Stealth', 'Experimental'],
  ['Kimi', 'Long context'],
  ['Claude', 'Editing'],
  ['Gemini', 'Documents'],
  ['MiniMax', 'Fast coding'],
  ['Step', 'Agentic'],
]

test('every free family has one best-at label', () => {
  for (const [family, expected] of FAMILIES) {
    assert.equal(modelTrait({ id: family.toLowerCase(), name: family, family }), expected, family)
  }
})

test('every free family has a distinct strength', () => {
  const traits = FAMILIES.map(([family]) => modelTrait({ id: family.toLowerCase(), name: family, family }))
  assert.equal(new Set(traits).size, FAMILIES.length)
})

test('keyed API model names get the same labels without a family', () => {
  assert.equal(modelTrait({ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }), 'Coding')
  assert.equal(modelTrait({ id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' }), 'Editing')
  assert.equal(modelTrait({ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }), 'Knowledge')
  assert.equal(modelTrait({ id: 'gemini-4-argon', name: 'Gemini 4 Argon' }), 'Documents')
})

test('an unrecognised model still gets a label', () => {
  assert.equal(modelTrait({ id: 'mystery', name: 'Mystery' }), 'General')
})
