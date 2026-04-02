import { resolveVersion } from './resolver.js'
import type { PackageInfo } from './types.js'

export type { PackageInfo } from './types.js'

interface RegistryPackument {
  'dist-tags'?: Record<string, string>
  time?: Record<string, string>
  versions?: Record<
    string,
    {
      name?: string
      version?: string
      description?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      deprecated?: string
      license?: string
      dist?: {
        unpackedSize?: number
      }
    }
  >
}

function normalizeRegistryName(name: string): string {
  return name.startsWith('@') ? name.replace('/', '%2f') : encodeURIComponent(name)
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  iteratee: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0

  const worker = async (): Promise<void> => {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await iteratee(items[currentIndex] as T)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )

  return results
}

export class RegistryClient {
  private readonly cache = new Map<string, PackageInfo>()

  constructor(
    private readonly registryUrl = 'https://registry.npmjs.org',
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async getPackage(name: string, version?: string): Promise<PackageInfo> {
    const cacheKey = `${name}@${version ?? 'latest'}`
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const packument = await this.fetchPackument(name)
    const availableVersions = Object.keys(packument.versions ?? {})
    const resolvedVersion = version
      ? resolveVersion(version, availableVersions) ?? version
      : packument['dist-tags']?.latest

    if (!resolvedVersion) {
      throw new Error(`Unable to resolve version for ${name}`)
    }

    const versionData = packument.versions?.[resolvedVersion]
    if (!versionData) {
      throw new Error(`Package ${name}@${resolvedVersion} not found in registry`)
    }

    const packageInfo: PackageInfo = {
      name,
      version: resolvedVersion,
      description: versionData.description ?? '',
      dependencies: versionData.dependencies ?? {},
      devDependencies: versionData.devDependencies ?? {},
      lastPublish: packument.time?.[resolvedVersion] ?? new Date(0).toISOString(),
      ...(versionData.deprecated ? { deprecated: versionData.deprecated } : {}),
      ...(typeof versionData.dist?.unpackedSize === 'number'
        ? { unpackedSize: versionData.dist.unpackedSize }
        : {}),
      ...(versionData.license ? { license: versionData.license } : {})
    }

    this.cache.set(cacheKey, packageInfo)
    this.cache.set(`${name}@${resolvedVersion}`, packageInfo)
    return packageInfo
  }

  async getLatestVersion(name: string): Promise<string> {
    const packument = await this.fetchPackument(name)
    const latest = packument['dist-tags']?.latest
    if (!latest) {
      throw new Error(`No latest version found for ${name}`)
    }
    return latest
  }

  async getBulk(packages: Array<{ name: string; version: string }>): Promise<PackageInfo[]> {
    return mapConcurrent(packages, 5, async ({ name, version }) =>
      this.getPackage(name, version)
    )
  }

  private async fetchPackument(name: string): Promise<RegistryPackument> {
    const response = await this.fetchImpl(`${this.registryUrl}/${normalizeRegistryName(name)}`)
    if (!response.ok) {
      throw new Error(`Registry request failed for ${name}: ${response.status}`)
    }

    return (await response.json()) as RegistryPackument
  }
}
