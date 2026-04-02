import test from 'node:test'
import assert from 'node:assert/strict'

import { formatTreemapBreakdown, renderTreemapHtml } from '../src/treemap.js'

test('renderTreemapHtml includes D3, data payload, and details panel', () => {
  const html = renderTreemapHtml([
    { name: 'lodash', size: 45 * 1024, dependents: ['(root)', 'app-shell'], dependencies: ['once'] },
    { name: 'react', size: 8 * 1024, dependents: ['(root)'], dependencies: [] }
  ])

  assert.match(html, /cdn\.jsdelivr\.net\/npm\/d3@7\/dist\/d3\.min\.js/)
  assert.match(html, /stacklens bundle treemap/)
  assert.match(html, /lodash/)
  assert.match(html, /details-dependents/)
  assert.match(html, /Click a box to inspect dependents/)
})

test('formatTreemapBreakdown renders package sizes and bars', () => {
  const breakdown = formatTreemapBreakdown([
    { name: 'moment', size: 67 * 1024, dependents: ['(root)'], dependencies: [] },
    { name: 'react', size: 8 * 1024, dependents: ['(root)'], dependencies: [] }
  ])

  assert.match(breakdown, /moment/)
  assert.match(breakdown, /67\.0 KB/)
  assert.match(breakdown, /█/)
})
