import test from 'node:test'
import assert from 'node:assert/strict'

import { detectCircularChains } from '../src/circular.js'

test('detectCircularChains finds a three-node cycle once', () => {
  const graph = new Map<string, string[]>([
    ['src/auth.ts', ['src/user.ts']],
    ['src/user.ts', ['src/db.ts']],
    ['src/db.ts', ['src/auth.ts']],
    ['src/ok.ts', []]
  ])

  const cycles = detectCircularChains(graph)

  assert.equal(cycles.length, 1)
  assert.deepEqual(cycles[0]?.chain, ['src/auth.ts', 'src/user.ts', 'src/db.ts', 'src/auth.ts'])
  assert.equal(cycles[0]?.nodeCount, 3)
})

test('detectCircularChains finds a two-node cycle', () => {
  const graph = new Map<string, string[]>([
    ['src/api.ts', ['src/middleware.ts']],
    ['src/middleware.ts', ['src/api.ts']]
  ])

  const cycles = detectCircularChains(graph)

  assert.equal(cycles.length, 1)
  assert.deepEqual(cycles[0]?.chain, ['src/api.ts', 'src/middleware.ts', 'src/api.ts'])
  assert.equal(cycles[0]?.nodeCount, 2)
})
