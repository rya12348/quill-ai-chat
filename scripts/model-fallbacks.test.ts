import assert from 'node:assert/strict'
import test from 'node:test'

import { fallbackForUnavailableModel, replacementLabels, replacementLane } from '../src/worker/model-fallbacks'
import { laneKey, type PublicLane } from '../src/worker/public-ai'
import type { HealthRow } from '../src/worker/provider-health'

const lane = (model: string, label: string, url = 'https://api.groq.com/openai/v1/chat/completions'): PublicLane => ({
  model,
  label,
  description: '',
  url,
})

const health = (
  id: string,
  status: string,
  lastErrorCode: string | null = null,
  lastError: string | null = null,
): HealthRow => ({
  provider_id: id,
  status,
  last_success_at: status === 'healthy' ? Date.now() : null,
  last_failure_at: status === 'healthy' ? null : Date.now(),
  last_error: lastError,
  last_error_code: lastErrorCode,
  latency_ms: status === 'healthy' ? 400 : null,
  consecutive_failures: status === 'healthy' ? 0 : 3,
  last_checked_at: Date.now(),
  next_probe_at: null,
})

test('an exact healthy route never gets a fallback', () => {
  const ernie = lane('baidu/ernie-5.5-flash-preview:free', 'ERNIE 5.5 Flash', 'https://openrouter.ai/api/v1/chat/completions')
  const qwen = lane('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)')
  assert.equal(
    fallbackForUnavailableModel(ernie.model, [ernie, qwen], [health(laneKey(ernie), 'healthy'), health(laneKey(qwen), 'healthy')]),
    undefined,
  )
})

test('a quota-exhausted ERNIE row routes to a healthy Qwen lane', () => {
  const ernie = lane('baidu/ernie-5.5-flash-preview:free', 'ERNIE 5.5 Flash', 'https://openrouter.ai/api/v1/chat/completions')
  const qwen = lane('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)')
  const fallback = fallbackForUnavailableModel(
    ernie.model,
    [ernie, qwen],
    [health(laneKey(ernie), 'down', 'quota', 'ERNIE has used its free daily requests.'), health(laneKey(qwen), 'healthy')],
  )
  assert.equal(fallback?.lane.model, qwen.model)
  assert.equal(fallback?.label, 'Qwen 3.8 27B')
  assert.match(fallback?.reason ?? '', /free daily requests/)
})

test('a quota-exhausted Kimi row routes to a working model', () => {
  const kimi = lane('coding-kimi-k3-free', 'Kimi K3', 'https://aihubmix.com/v1/chat/completions')
  const step = lane('stepfun-ai/step-5-preview', 'Step 5 Preview (NVIDIA)', 'https://integrate.api.nvidia.com/v1/chat/completions')
  const qwen = lane('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)')
  const fallback = fallbackForUnavailableModel(
    kimi.model,
    [kimi, step, qwen],
    [health(laneKey(kimi), 'down', 'quota', 'Kimi K3 has no quota left right now.'), health(laneKey(step), 'healthy'), health(laneKey(qwen), 'healthy')],
  )
  assert.equal(fallback?.lane.model, step.model)
  assert.match(fallback?.reason ?? '', /no quota left/)
})

test('Particle falls through to the shared replacement ladder', () => {
  const particle = lane('particle-ai/particle-1:free', 'Particle-1', 'https://openrouter.ai/api/v1/chat/completions')
  const deepseek = lane('deepseek-ai/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash (NVIDIA)', 'https://integrate.api.nvidia.com/v1/chat/completions')
  const qwen = lane('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)')
  const fallback = fallbackForUnavailableModel(
    particle.model,
    [particle, deepseek, qwen],
    [health(laneKey(particle), 'down', 'quota'), health(laneKey(deepseek), 'healthy'), health(laneKey(qwen), 'healthy')],
  )
  assert.equal(fallback?.lane.model, qwen.model)
})

test('the replacement primary falls back to the next configured backup', () => {
  const primary = lane('nvidia/nemotron-3-ultra-550b-a55b', 'Nemotron 3 Ultra 550B (NVIDIA)', 'https://integrate.api.nvidia.com/v1/chat/completions')
  const command = lane('command-a-plus-05-2026', 'Command A+ (Cohere)', 'https://api.cohere.ai/compatibility/v1/chat/completions')
  const qwen = lane('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)')
  const fallback = fallbackForUnavailableModel(
    primary.model,
    [primary, command, qwen],
    [health(laneKey(primary), 'down', 'timeout'), health(laneKey(command), 'healthy'), health(laneKey(qwen), 'healthy')],
  )
  assert.equal(fallback?.lane.model, command.model)
})

test('the shared replacement has one primary and two configured backups', () => {
  const primary = lane('nvidia/nemotron-3-ultra-550b-a55b', 'Nemotron 3 Ultra 550B (NVIDIA)', 'https://integrate.api.nvidia.com/v1/chat/completions')
  const command = lane('command-a-plus-05-2026', 'Command A+ (Cohere)', 'https://api.cohere.ai/compatibility/v1/chat/completions')
  const qwen = lane('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)')
  assert.equal(replacementLane([qwen, command, primary])?.model, primary.model)
  assert.deepEqual(replacementLabels([primary, command, qwen]), ['Nemotron 3 Ultra 550B', 'Command A+', 'Qwen 3.8 27B'])
})

test('a fallback never picks another OpenRouter free lane or a paid lane', () => {
  const ernie = lane('baidu/ernie-5.5-flash-preview:free', 'ERNIE 5.5 Flash', 'https://openrouter.ai/api/v1/chat/completions')
  const otherFree = lane('nvidia/nemotron-3-ultra-550b-a55b:free', 'Nemotron 3 Ultra', 'https://openrouter.ai/api/v1/chat/completions')
  const paid = { ...lane('mistral-large-4', 'Mistral Large 4', 'https://api.mistral.ai/v1/chat/completions'), billing: 'paid' as const }
  const qwen = lane('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)')
  const fallback = fallbackForUnavailableModel(
    ernie.model,
    [ernie, otherFree, paid, qwen],
    [health(laneKey(ernie), 'down', 'quota'), health(laneKey(otherFree), 'healthy'), health(laneKey(paid), 'healthy'), health(laneKey(qwen), 'healthy')],
  )
  assert.equal(fallback?.lane.model, qwen.model)
})
