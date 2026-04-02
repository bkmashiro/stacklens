import test from 'node:test'
import assert from 'node:assert/strict'

import { RegistryClient } from '../src/registry.js'
import { createMockFetch } from './helpers/mock-registry.js'

test('getPackage fetches the correct registry URL', async () => {
  const calls: string[] = []
  const fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push(url)
    return createMockFetch()(input)
  }) as typeof globalThis.fetch

  const client = new RegistryClient('https://registry.npmjs.org', fetch)
  const pkg = await client.getPackage('express', '4.18.2')

  assert.equal(pkg.name, 'express')
  assert.equal(calls[0], 'https://registry.npmjs.org/express')
})

test('RegistryClient caches repeated package requests', async () => {
  let callCount = 0
  const fetch = (async (input: string | URL | Request) => {
    callCount += 1
    return createMockFetch()(input)
  }) as typeof globalThis.fetch

  const client = new RegistryClient('https://registry.npmjs.org', fetch)
  await client.getPackage('express', '4.18.2')
  await client.getPackage('express', '4.18.2')

  assert.equal(callCount, 1)
})

test('getBulk limits concurrency to five requests', async () => {
  let inFlight = 0
  let maxInFlight = 0
  const fetch = createMockFetch(undefined, {
    delayMs: 20,
    onStart: () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
    },
    onFinish: () => {
      inFlight -= 1
    }
  })

  const client = new RegistryClient('https://registry.npmjs.org', fetch)
  await client.getBulk([
    { name: 'express', version: '4.18.2' },
    { name: 'accepts', version: '1.3.8' },
    { name: 'mime-types', version: '2.1.35' },
    { name: 'deprecated-pkg', version: '1.0.0' },
    { name: 'diamond-root', version: '1.0.0' },
    { name: 'alpha', version: '1.0.0' },
    { name: 'beta', version: '1.0.0' }
  ])

  assert.equal(maxInFlight <= 5, true)
})
