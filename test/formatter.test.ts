import test from 'node:test'
import assert from 'node:assert/strict'

import { formatAudit, formatComparison, formatJson, formatSummary, formatTree } from '../src/formatter.js'
import { buildGraph } from '../src/graph.js'
import { RegistryClient } from '../src/registry.js'
import { createMockFetch } from './helpers/mock-registry.js'

test('formatTree contains package names and tree connectors', async () => {
  const client = new RegistryClient('https://registry.npmjs.org', createMockFetch())
  const analysis = await buildGraph('express', '4.18.2', client)
  const output = formatTree(analysis)

  assert.match(output, /express@4\.18\.2/)
  assert.match(output, /├──|└──/)
  assert.match(output, /mime-types@2\.1\.35/)
})

test('formatSummary includes total unique packages', async () => {
  const client = new RegistryClient('https://registry.npmjs.org', createMockFetch())
  const analysis = await buildGraph('express', '4.18.2', client)

  assert.match(formatSummary(analysis), /Total unique packages/)
})

test('formatComparison shows both package names', async () => {
  const client = new RegistryClient('https://registry.npmjs.org', createMockFetch())
  const expressAnalysis = await buildGraph('express', '4.18.2', client)
  const deprecatedAnalysis = await buildGraph('deprecated-pkg', '1.0.0', client)
  const output = formatComparison([expressAnalysis, deprecatedAnalysis])

  assert.match(output, /express:/)
  assert.match(output, /deprecated-pkg:/)
})

test('formatJson returns valid JSON', async () => {
  const client = new RegistryClient('https://registry.npmjs.org', createMockFetch())
  const analysis = await buildGraph('express', '4.18.2', client)

  const parsed = JSON.parse(formatJson(analysis)) as { uniquePackageCount: number }
  assert.equal(parsed.uniquePackageCount, 3)
})

test('formatAudit shows deprecated packages section', async () => {
  const client = new RegistryClient('https://registry.npmjs.org', createMockFetch())
  const analysis = await buildGraph('deprecated-pkg', '1.0.0', client)
  const output = formatAudit(analysis)

  assert.match(output, /Deprecated packages:/)
  assert.match(output, /deprecated-pkg@1\.0\.0/)
})
