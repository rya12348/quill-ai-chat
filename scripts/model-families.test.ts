import assert from 'node:assert/strict'
import test from 'node:test'

import type { Env } from '../src/worker/env'
import { familyForLane, laneKey, laneSupportsVision, pickModelFamilies, publicLanes } from '../src/worker/public-ai'

const lane = (model: string, label: string, url = 'https://free.example/v1/chat/completions') => ({
  model,
  label,
  description: '',
  url,
})

test('family names collapse provider and version suffixes', () => {
  const families: [string, string, string][] = [
    ['nvidia/nemotron-3-ultra-550b-a55b', 'Nemotron 3 Ultra 550B (NVIDIA)', 'Nemotron'],
    ['nvidia/nemotron-3-super-120b', 'Nemotron 3 Super 120B (BlockRun)', 'Nemotron'],
    ['@cf/qwen/qwen3.8-27b', 'Qwen 3.8 27B (Workers AI)', 'Qwen'],
    ['qwen2.5-coder:7b', 'Qwen2.5 Coder 7B (Local Ollama)', 'Qwen'],
    ['ministral-14b-latest', 'Ministral 14B', 'Ministral'],
    ['codestral-latest', 'Codestral', 'Codestral'],
    ['mistral-large-4', 'Mistral Large 4', 'Mistral'],
    ['mistral-Nemo-Instruct-2407', 'Mistral Nemo', 'Mistral'],
    ['openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)', 'GPT'],
    ['google/gemma-4-31b-it:free', 'Gemma 4 31B', 'Gemma'],
    ['z-ai/glm-5.3-flash', 'GLM-5.3 Flash (NVIDIA)', 'GLM'],
    ['deepseek-ai/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash (NVIDIA)', 'DeepSeek'],
    ['@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', 'DeepSeek R1 Distill 32B (Workers AI)', 'DeepSeek'],
    ['dots-studio/dots-3-note-preview:free', 'Dots3 Note (Kilo)', 'Dots'],
    ['liquid/lfm-3-1.7b:free', 'Liquid LFM3 1.7B (Kilo)', 'Liquid'],
    ['stealth/glyph-cluster', 'Glyph Cluster (Kilo)', 'Stealth'],
    ['kilo-auto/free', 'Kilo Auto Free', 'Kilo'],
    ['poolside/laguna-xs-2.1', 'Laguna XS 2.1 (BlockRun)', 'Laguna'],
    ['nvidia/muse-glimmer-30b', 'Muse Glimmer 30B (BlockRun)', 'Muse'],
    ['nvidia/minimax-m3.1-flash', 'MiniMax M3.1 Flash (BlockRun)', 'MiniMax'],
  ]
  for (const [model, label, expected] of families) {
    assert.equal(familyForLane(lane(model, label)), expected, label)
  }
})

test('one row per family, represented by its strongest lane', () => {
  const lanes = [
    lane('nvidia/nemotron-3-super-120b', 'Nemotron 3 Super 120B (BlockRun)', 'https://blockrun.ai/api/v1/chat/completions'),
    lane('nvidia/nemotron-3-ultra-550b-a55b', 'Nemotron 3 Ultra 550B (NVIDIA)', 'https://integrate.api.nvidia.com/v1/chat/completions'),
    lane('nvidia/nemotron-3-ultra-550b-a55b:free', 'Nemotron 3 Ultra 550B', 'https://openrouter.ai/api/v1/chat/completions'),
    lane('deepseek-ai/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash (NVIDIA)', 'https://integrate.api.nvidia.com/v1/chat/completions'),
    lane('@cf/deepseek-ai/deepseek-v4-flash-0731', 'DeepSeek V4 Flash (Workers AI)', 'https://api.cloudflare.com/client/v4/accounts/x/ai/v1/chat/completions'),
    lane('openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)', 'https://api.groq.com/openai/v1/chat/completions'),
  ]
  const picks = pickModelFamilies(lanes)
  assert.deepEqual(picks.map((pick) => pick.family), ['Nemotron', 'DeepSeek', 'GPT'])
  assert.equal(picks[0]?.lane.model, 'nvidia/nemotron-3-super-120b')
  assert.equal(picks[1]?.lane.model, 'deepseek-ai/deepseek-v4.1-flash')
})

test('the added keyless lanes are wired into the free chain', () => {
  const lanes = publicLanes({} as unknown as Env)
  const byModel = (model: string) => lanes.find((lane) => lane.model === model)

  for (const model of [
    'gpt-oss-120b',
    'gpt-oss-20b',
    'Qwen3.5-397B-A17B',
    'Qwen3.5-9B',
    'Qwen3.6-27B',
    'Qwen3.8-27B',
    'Qwen2.5-VL-72B-Instruct',
    'kilo-auto/free',
    'nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'cohere/north-mini-code:free',
    'nvidia/nemotron-3.5-lightning',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    'poolside/laguna-xs-2.1',
    'nvidia/muse-glimmer-30b',
  ]) {
    const found = byModel(model)
    assert.ok(found, model)
    assert.equal(found.key, undefined, `${model} should be keyless`)
  }

  assert.equal(byModel('Qwen3.6-27B')?.label, 'Qwen 3.6 27B (OVHcloud)')
  assert.equal(byModel('Qwen3.5-397B-A17B')?.label, 'Qwen 3.5 397B (OVHcloud)')
  assert.equal(byModel('kilo-auto/free')?.label, 'Kilo Auto Free')
  assert.equal(laneSupportsVision(byModel('nvidia/nemotron-3.5-super-vl:free')!), true)
  assert.equal(laneSupportsVision(byModel('Qwen2.5-VL-72B-Instruct')!), true)

  const families = new Set(pickModelFamilies(lanes).map((pick) => pick.family))
  for (const family of ['Laguna', 'Muse', 'Dots', 'Liquid', 'Kilo', 'Stealth']) {
    assert.ok(families.has(family), family)
  }
})

test('Workers AI DeepSeek R1 stays in the DeepSeek family', () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_AI_TOKEN: 'token' } as unknown as Env
  const deepseek = publicLanes(env).find((lane) => lane.model === '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b')
  assert.ok(deepseek)
  assert.equal(deepseek.label, 'DeepSeek R1 Distill 32B (Workers AI)')
  assert.equal(familyForLane(deepseek), 'DeepSeek')
})

test('a healthy lane outranks a stronger failed one', () => {
  const strong = lane('nvidia/nemotron-3-super-120b', 'Nemotron 3 Super 120B (BlockRun)', 'https://blockrun.ai/api/v1/chat/completions')
  const healthy = lane('nvidia/nemotron-3-ultra-550b-a55b', 'Nemotron 3 Ultra 550B (NVIDIA)', 'https://integrate.api.nvidia.com/v1/chat/completions')
  const statuses = new Map([
    [laneKey(strong), 'down'],
    [laneKey(healthy), 'healthy'],
  ])
  const [pick] = pickModelFamilies([strong, healthy], statuses)
  assert.equal(pick?.family, 'Nemotron')
  assert.equal(pick?.lane.model, healthy.model)
})
