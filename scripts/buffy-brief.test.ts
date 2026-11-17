import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { BuildInfo } from '../src/shared/types'
import { briefFromConversation, briefHandoff, briefReadiness, readBriefHistory, receiptFromBuild, receiptHandoff, rememberBrief, seedBriefGoal } from '../src/app/lib/buffy-brief'

test('keeps the latest assistant plan when the brief has pinned notes', () => {
  const handoff = briefHandoff(
    {
      goal: 'Build a weekly dinner planner',
      notes: ['Use warm colors', 'No external images'],
      files: ['menu.md'],
      checks: ['Adds a meal and shows it in the grid'],
    },
    [
      { role: 'user', content: 'Plan a weekly dinner planner.' },
      { role: 'assistant', content: 'Old plan: use a simple list.' },
      { role: 'assistant', content: 'Latest plan:\n1. Build a seven-day grid.\n2. Add a working add-meal form.' },
    ],
  )

  assert.match(handoff, /Goal: Build a weekly dinner planner/)
  assert.match(handoff, /Plan:\nLatest plan:\n1\. Build a seven-day grid\./)
  assert.match(handoff, /Pinned decisions:\n- Use warm colors\n- No external images/)
  assert.match(handoff, /Acceptance checks:\n- Adds a meal and shows it in the grid/)
  assert.match(handoff, /Context files: menu\.md/)
  assert.ok(handoff.indexOf('Latest plan:') < handoff.indexOf('Pinned decisions:'))
  assert.doesNotMatch(handoff, /Old plan:/)
})

test('seeds a blank goal from the first real user request', () => {
  const brief = seedBriefGoal(
    { goal: '', notes: ['Keep it warm'], files: ['menu.md'], checks: [] },
    [
      { role: 'assistant', content: 'What would you like to build?' },
      { role: 'user', content: 'Build a weekly dinner planner.' },
      { role: 'user', content: 'Actually, make it a lunch planner.' },
    ],
  )

  assert.equal(brief.goal, 'Build a weekly dinner planner.')
  assert.deepEqual(brief.notes, ['Keep it warm'])
  assert.deepEqual(brief.files, ['menu.md'])
})

test('does not overwrite a goal that was already edited', () => {
  const brief = seedBriefGoal(
    { goal: 'My edited goal', notes: [], files: [], checks: [] },
    [{ role: 'user', content: 'An older request that must not replace it.' }],
  )

  assert.equal(brief.goal, 'My edited goal')
})

test('requires a goal, a plan and a check before a build handoff', () => {
  const empty = briefReadiness({ goal: '', notes: [], files: [], checks: [] }, [])
  assert.equal(empty.ready, false)
  assert.deepEqual(empty.missing, ['Add a goal.', 'Get a plan from Buffy.', 'Add at least one acceptance check.'])

  const ready = briefReadiness(
    { goal: 'Build a planner', notes: [], files: [], checks: ['Saves a meal'] },
    [{ role: 'assistant', content: 'Use a weekly grid.' }],
  )
  assert.equal(ready.ready, true)
  assert.equal(ready.plan, 'Use a weekly grid.')
})

test('imports a Chat conversation as a brief without copying the transcript', () => {
  const brief = briefFromConversation([
    { role: 'user', content: 'Build a weekly dinner planner.' },
    { role: 'assistant', content: 'Latest plan: use a seven-day grid.' },
    { role: 'user', content: 'Use warm colors.' },
    { role: 'assistant', content: 'Plan: keep the grid simple.' },
  ])
  assert.equal(brief.goal, 'Build a weekly dinner planner.')
  assert.equal(brief.plan, 'Plan: keep the grid simple.')
  assert.equal(brief.notes.length, 0)
})

test('returns a compact receipt and carries failed checks into a repair handoff', () => {
  const build = {
    status: 'warning',
    title: 'Dinner planner',
    html: '<html></html>',
    pages: [{ name: 'index.html', html: '<html></html>' }],
    models: ['a'],
    asOf: 1,
    verification: {
      status: 'warning',
      checks: [
        { id: '1', label: 'Starts without errors', status: 'pass' },
        { id: '2', label: 'Saves a meal', status: 'fail' },
      ],
      repaired: false,
      spec: false,
      score: 1,
      asOf: 2,
    },
  } as BuildInfo
  const receipt = receiptFromBuild(build)
  assert.equal(receipt.title, 'Dinner planner')
  assert.equal(receipt.checks.length, 2)
  const repair = receiptHandoff(
    { goal: 'Build a planner', notes: [], files: [], checks: [], plan: 'Use a grid.' },
    receipt,
    [],
  )
  assert.match(repair, /Failed checks:\n- Saves a meal/)
})

test('keeps recent briefs without duplicating an unchanged one', () => {
  const first = { goal: 'Build a planner', notes: [], files: [], checks: [] }
  const history = rememberBrief([], first)
  assert.equal(history.length, 1)
  assert.equal(rememberBrief(history, first).length, 1)
  const newer = rememberBrief(history, { ...first, goal: 'Build a better planner' })
  assert.equal(newer.length, 2)
  assert.equal(readBriefHistory(newer)[0]?.brief.goal, 'Build a better planner')
})
