import assert from 'node:assert/strict'
import test from 'node:test'

import { familyForLane, laneKey, pickModelFamilies } from '../src/worker/public-ai'

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
