import test from 'node:test'
import assert from 'node:assert/strict'

import { detectDiamonds, isMajorConflict, resolveVersion } from '../src/resolver.js'
import type { DependencyNode } from '../src/graph.js'

test('resolveVersion selects highest matching caret version', () => {
  assert.equal(resolveVersion('^4.0.0', ['3.9.9', '4.0.0', '4.18.2', '5.0.0']), '4.18.2')
})

test('resolveVersion selects highest matching tilde version', () => {
  assert.equal(resolveVersion('~1.3.8', ['1.3.7', '1.3.8', '1.3.9', '1.4.0']), '1.3.9')
})

test('resolveVersion handles wildcard ranges', () => {
  assert.equal(resolveVersion('*', ['1.0.0', '2.0.0']), '2.0.0')
})

test('resolveVersion prefers exact matches', () => {
  assert.equal(resolveVersion('1.2.3', ['1.2.3', '1.2.4']), '1.2.3')
})

test('isMajorConflict detects differing majors', () => {
  assert.equal(isMajorConflict('1.0.0', '2.0.0'), true)
  assert.equal(isMajorConflict('1.0.0', '1.9.9'), false)
})

test('detectDiamonds reports a package with multiple resolved versions', () => {
  const root: DependencyNode = {
    name: 'root',
    version: '1.0.0',
    resolvedVersion: '1.0.0',
    depth: 0,
    dependencies: [],
    isDeprecated: false,
    daysSinceRelease: 0,
    unpackedSize: 0
  }
  const acceptsA: DependencyNode = {
    name: 'accepts',
    version: '1.3.8',
    resolvedVersion: '1.3.8',
    depth: 1,
    dependencies: [],
    isDeprecated: false,
    daysSinceRelease: 0,
    unpackedSize: 0
  }
  const acceptsB: DependencyNode = {
    name: 'accepts',
    version: '2.0.0',
    resolvedVersion: '2.0.0',
    depth: 1,
    dependencies: [],
    isDeprecated: false,
    daysSinceRelease: 0,
    unpackedSize: 0
  }

  root.dependencies = [acceptsA, acceptsB]

  const nodes = new Map<string, DependencyNode>([
    ['root@1.0.0', root],
    ['accepts@1.3.8', acceptsA],
    ['accepts@2.0.0', acceptsB]
  ])

  const diamonds = detectDiamonds(nodes)
  assert.equal(diamonds.length, 1)
  assert.equal(diamonds[0]?.packageName, 'accepts')
  assert.deepEqual(diamonds[0]?.versions, ['1.3.8', '2.0.0'])
})
