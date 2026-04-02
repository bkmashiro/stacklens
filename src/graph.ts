import { readFile } from 'node:fs/promises'

import { detectDiamonds } from './resolver.js'
import type { DependencyNode, GraphAnalysis } from './types.js'
import type { PackageInfo } from './types.js'
import { RegistryClient } from './registry.js'

export type { DependencyNode, GraphAnalysis, DiamondDependency } from './types.js'

const TWO_YEARS_IN_DAYS = 365 * 2

function daysSince(dateString: string): number {
  const diff = Date.now() - new Date(dateString).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function createNode(pkg: PackageInfo, depth: number): DependencyNode {
  return {
    name: pkg.name,
    version: pkg.version,
    resolvedVersion: pkg.version,
    depth,
    dependencies: [],
    isDeprecated: Boolean(pkg.deprecated),
    daysSinceRelease: daysSince(pkg.lastPublish),
    unpackedSize: pkg.unpackedSize ?? 0
  }
}

async function buildDependencyTree(
  pkg: PackageInfo,
  client: RegistryClient,
  maxDepth: number,
  allPackages: Map<string, DependencyNode>,
  depth = 0,
  activePath = new Set<string>()
): Promise<DependencyNode> {
  const nodeKey = `${pkg.name}@${pkg.version}`
  const existing = allPackages.get(nodeKey)
  if (existing && depth > 0) {
    return existing
  }

  const node = createNode(pkg, depth)
  allPackages.set(nodeKey, node)

  if (depth >= maxDepth || activePath.has(nodeKey)) {
    return node
  }

  const nextPath = new Set(activePath)
  nextPath.add(nodeKey)
  const childEntries = Object.entries(pkg.dependencies)

  const dependencies = await Promise.all(
    childEntries.map(async ([dependencyName, range]) => {
      try {
        const dependencyPackage = await client.getPackage(dependencyName, range)
        return await buildDependencyTree(
          dependencyPackage,
          client,
          maxDepth,
          allPackages,
          depth + 1,
          nextPath
        )
      } catch {
        return null
      }
    })
  )

  node.dependencies = dependencies.filter(
    (dependency): dependency is DependencyNode => dependency !== null
  )
  return node
}

function collectAnalysis(root: DependencyNode, allPackages: Map<string, DependencyNode>): GraphAnalysis {
  const nodes = [...allPackages.values()]
  const deprecated = nodes.filter((node) => node.isDeprecated)
  const unmaintained = nodes.filter((node) => node.daysSinceRelease >= TWO_YEARS_IN_DAYS)
  const totalSize = nodes.reduce((sum, node) => sum + node.unpackedSize, 0)
  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0)

  return {
    root,
    allPackages,
    diamondDeps: detectDiamonds(allPackages),
    deprecated,
    unmaintained,
    totalSize,
    uniquePackageCount: allPackages.size,
    maxDepth
  }
}

export async function buildGraph(
  name: string,
  version: string,
  client: RegistryClient,
  maxDepth = 5
): Promise<GraphAnalysis> {
  const pkg = await client.getPackage(name, version)
  const allPackages = new Map<string, DependencyNode>()
  const root = await buildDependencyTree(pkg, client, maxDepth, allPackages)
  return collectAnalysis(root, allPackages)
}

export async function analyzeProject(
  packageJsonPath: string,
  client: RegistryClient,
  maxDepth = 5
): Promise<GraphAnalysis> {
  const raw = await readFile(packageJsonPath, 'utf8')
  const manifest = JSON.parse(raw) as {
    name?: string
    version?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  const syntheticPackage: PackageInfo = {
    name: manifest.name ?? 'local-project',
    version: manifest.version ?? '0.0.0',
    description: '',
    dependencies: {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {})
    },
    devDependencies: {},
    lastPublish: new Date().toISOString(),
    unpackedSize: 0
  }

  const allPackages = new Map<string, DependencyNode>()
  const root = await buildDependencyTree(syntheticPackage, client, maxDepth, allPackages)
  return collectAnalysis(root, allPackages)
}
