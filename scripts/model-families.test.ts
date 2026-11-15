import assert from 'node:assert/strict'
import test from 'node:test'

import type { Env } from '../src/worker/env'
import { PICKER_MODEL_DESCRIPTIONS, PICKER_MODEL_NAMES } from '../src/shared/config'
import { familyForLane, laneKey, laneStrength, laneSupportsVision, pickModelFamilies, pickPickerFamilies, publicLanes } from '../src/worker/public-ai'

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
    ['qwen3.8-max', 'Qwen 3.8 Max', 'Qwen'],
    ['stepfun-ai/step-5-preview', 'Step 5 Preview', 'Step'],
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
  // The 550B Ultra lane is deliberately the Nemotron representative now; the
  // 120B Super is the fallback when Ultra is rate-limited.
  assert.equal(picks[0]?.lane.model, 'nvidia/nemotron-3-ultra-550b-a55b')
  assert.equal(picks[1]?.lane.model, 'deepseek-ai/deepseek-v4.1-flash')
})

test('the two strongest free models are lanes ranked above the 550B', () => {
  const env = { OPENROUTER_API_KEY: 'openrouter-key' } as unknown as Env
  const lanes = publicLanes(env)
  for (const model of [
    'inclusionai/ling-3.2-flash:free',
    'baidu/ernie-5.5-flash-preview:free',
    'particle-ai/particle-1:free',
  ]) {
    const found = lanes.find((lane) => lane.model === model)
    assert.ok(found, model)
    assert.equal(found.billing, 'free')
    assert.ok(
      laneStrength(found.model, found.url) >
        laneStrength('nvidia/nemotron-3-ultra-550b-a55b:free', 'https://openrouter.ai/api/v1/chat/completions'),
    )
  }
})

test('the picker uses the five short model names in order', () => {
  assert.deepEqual([...PICKER_MODEL_NAMES], ['Sable', 'Quill', 'Stride', 'Ink', 'Prism'])
  assert.equal(new Set(PICKER_MODEL_DESCRIPTIONS).size, PICKER_MODEL_NAMES.length)
  assert.ok(PICKER_MODEL_DESCRIPTIONS.every((description) => description.endsWith('.')))
})

test('the model picker exposes five families at most', () => {
  const picks = pickPickerFamilies(publicLanes({} as unknown as Env))
  assert.equal(picks.length, 5)
  assert.equal(new Set(picks.map((pick) => pick.family)).size, picks.length)
})

test('DeepSeek 4.1 is pinned into the shortlist when its lane is configured', () => {
  const env = { DEEPSEEK_API_KEY: 'deepseek-key' } as unknown as Env
  const lanes = publicLanes(env)
  const deepseek = lanes.find((lane) => lane.model === 'deepseek-flash')
  assert.ok(deepseek)
  assert.equal(deepseek.label, 'DeepSeek V4.1 Flash')
  assert.equal(deepseek.key, 'deepseek-key')

  const crowded = [
    lane('stepfun-ai/step-5-preview', 'Step 5 Preview (NVIDIA)'),
    lane('claude-sonnet-5', 'Claude Sonnet 5'),
    lane('gemini-4', 'Gemini 4'),
    lane('qwen3.8-max', 'Qwen 3.8 Max'),
    lane('kimi-k3', 'Kimi K3'),
    lane('deepseek-flash', 'DeepSeek V4.1 Flash', 'https://api.deepseek.com/chat/completions'),
  ]
  const picks = pickPickerFamilies(crowded)
  assert.equal(picks.length, 5)
  assert.ok(picks.some((pick) => pick.lane.model === 'deepseek-flash'))
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

test('the keyless Pollinations lane stays honestly labeled GPT-OSS', () => {
  const lanes = publicLanes({} as unknown as Env)
  const lane = lanes.find((item) => item.url.includes('text.pollinations.ai') && item.model === 'pollinations-gpt-oss')

  assert.ok(lane)
  assert.equal(lane.requestModel, 'openai-fast')
  assert.equal(lane.label, 'GPT-OSS 20B (Pollinations)')
  assert.equal(lane.billing, 'free')
  assert.equal(lane.key, undefined)
  assert.equal(lanes.some((item) => item.model === 'chatgpt'), false)
})

test('an Alibaba Model Studio key adds the free-trial frontier lanes', () => {
  const env = { DASHSCOPE_API_KEY: 'dash-key' } as unknown as Env
  const lanes = publicLanes(env).filter((lane) => lane.url.includes('dashscope-intl.aliyuncs.com'))
  assert.deepEqual(lanes.map((lane) => lane.model), ['qwen3.8-max', 'deepseek-v4-pro', 'glm-5.3'])
  assert.equal(lanes[0]?.label, 'Qwen 3.8 Max')
  assert.equal(lanes[1]?.label, 'DeepSeek V4 Pro')
  assert.equal(lanes[2]?.label, 'GLM-5.3')
  assert.ok(lanes.every((lane) => lane.key === 'dash-key'))
  assert.ok(lanes.every((lane) => lane.description.includes('Alibaba')))
  assert.deepEqual(pickModelFamilies(lanes).map((pick) => pick.family).sort(), ['DeepSeek', 'GLM', 'Qwen'])
  assert.equal(laneStrength('qwen3.8-max', lanes[0]?.url), 92)
})

test('DASHSCOPE_MODELS overrides the Alibaba model list', () => {
  const env = { DASHSCOPE_API_KEY: 'dash-key', DASHSCOPE_MODELS: 'qwen3.8-2.4t-a95b, glm-5.3' } as unknown as Env
  const lanes = publicLanes(env).filter((lane) => lane.url.includes('dashscope-intl.aliyuncs.com'))
  assert.deepEqual(lanes.map((lane) => lane.model).sort(), ['glm-5.3', 'qwen3.8-2.4t-a95b'])
  assert.equal(lanes.find((lane) => lane.model === 'qwen3.8-2.4t-a95b')?.label, 'Qwen 3.8 2.4T')
})

test('Alibaba lanes require an explicit key', () => {
  const lanes = publicLanes({} as unknown as Env)
  assert.equal(lanes.some((lane) => lane.url.includes('dashscope-intl.aliyuncs.com')), false)
})

test('a free NVIDIA key adds Step 5 Preview and the other free NIM lanes', () => {
  const env = { NVIDIA_API_KEY: 'nvapi-key' } as unknown as Env
  const lanes = publicLanes(env).filter((lane) => lane.url.includes('integrate.api.nvidia.com'))
  const step = lanes.find((lane) => lane.model === 'stepfun-ai/step-5-preview')
  assert.ok(step)
  assert.equal(step.label, 'Step 5 Preview (NVIDIA)')
  assert.equal(familyForLane(step), 'Step')
  assert.equal(laneStrength(step.model, step.url), 98)
  assert.equal(laneSupportsVision(step), true)
  assert.ok(lanes.some((lane) => lane.model === 'minimaxai/minimax-m3.1-flash'))
  assert.ok(lanes.some((lane) => lane.model === 'nvidia/nemotron-3.5-super-vl-120b-a12b'))
})

test('a free AIHubMix key adds the zero-cost Kimi K3 lane', () => {
  const env = { AIHUBMIX_API_KEY: 'free-key' } as unknown as Env
  const kimi = publicLanes(env).find((lane) => lane.model === 'coding-kimi-k3-free')
  assert.ok(kimi)
  assert.equal(kimi.label, 'Kimi K3')
  assert.equal(kimi.key, 'free-key')
  assert.equal(familyForLane(kimi), 'Kimi')
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
