import { MOCK_REGISTRY } from '../fixtures/registry.js'

export function createMockFetch(
  registry: Record<string, any> = MOCK_REGISTRY,
  hooks?: {
    onStart?: () => void
    onFinish?: () => void
    delayMs?: number
  }
): typeof fetch {
  return (async (input: string | URL | Request) => {
    hooks?.onStart?.()

    if (hooks?.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, hooks.delayMs))
    }

    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const packageName = decodeURIComponent(rawUrl.split('/').pop() ?? '')
    const body = registry[packageName]

    hooks?.onFinish?.()

    if (!body) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }) as typeof fetch
}
