import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGraph } from '../src/graph.js'
import { RegistryClient } from '../src/registry.js'
import { createMockFetch } from './helpers/mock-registry.js'

test('buildGraph builds express dependency tree with accepts and mime-types', async () => {
  const client = new RegistryClient('https://registry.npmjs.org', createMockFetch())
  const analysis = await buildGraph('express', '4.18.2', client)

  assert.equal(analysis.root.name, 'express')
  assert.equal(analysis.root.dependencies[0]?.name, 'accepts')
  assert.equal(analysis.root.dependencies[0]?.dependencies[0]?.name, 'mime-types')
  assert.equal(analysis.uniquePackageCount, 3)
  assert.equal(analysis.totalSize, 220000 + 15000 + 40000)
  assert.equal(analysis.maxDepth, 2)
})

test('buildGraph marks deprecated packages', async () => {
  const client = new RegistryClient('https://registry.npmjs.org', createMockFetch())
  const analysis = await buildGraph('deprecated-pkg', '1.0.0', client)

  assert.equal(analysis.deprecated.length, 1)
  assert.equal(analysis.deprecated[0]?.name, 'deprecated-pkg')
})

test('buildGraph detects diamond dependencies', async () => {
  const client = new RegistryClient('https://registry.npmjs.org', createMockFetch())
  const analysis = await buildGraph('diamond-root', '1.0.0', client)

  assert.equal(analysis.diamondDeps.length, 1)
  assert.equal(analysis.diamondDeps[0]?.packageName, 'accepts')
  assert.deepEqual(analysis.diamondDeps[0]?.versions, ['1.3.8', '2.0.0'])
})
