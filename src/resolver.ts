import type { DependencyNode, DiamondDependency } from './types.js'

export type { DiamondDependency } from './types.js'

interface ParsedVersion {
  raw: string
  major: number
  minor: number
  patch: number
}

function parseVersion(version: string): ParsedVersion | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!match) {
    return null
  }

  return {
    raw: version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  }
}

function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) {
    return a.major - b.major
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor
  }

  return a.patch - b.patch
}

function sortVersionsDesc(versions: string[]): ParsedVersion[] {
  return versions
    .map(parseVersion)
    .filter((version): version is ParsedVersion => version !== null)
    .sort((a, b) => compareVersions(b, a))
}

function satisfies(version: ParsedVersion, range: string): boolean {
  const normalized = range.trim()
  if (!normalized || normalized === '*') {
    return true
  }

  if (normalized.startsWith('^')) {
    const base = parseVersion(normalized.slice(1))
    if (!base) {
      return false
    }

    return version.major === base.major && compareVersions(version, base) >= 0
  }

  if (normalized.startsWith('~')) {
    const base = parseVersion(normalized.slice(1))
    if (!base) {
      return false
    }

    return (
      version.major === base.major &&
      version.minor === base.minor &&
      compareVersions(version, base) >= 0
    )
  }

  const exact = parseVersion(normalized)
  if (!exact) {
    return false
  }

  return compareVersions(version, exact) === 0
}

export function resolveVersion(range: string, availableVersions: string[]): string | null {
  const sortedVersions = sortVersionsDesc(availableVersions)
  const match = sortedVersions.find((version) => satisfies(version, range))
  return match?.raw ?? null
}

export function isMajorConflict(v1: string, v2: string): boolean {
  const parsedV1 = parseVersion(v1)
  const parsedV2 = parseVersion(v2)

  if (!parsedV1 || !parsedV2) {
    return false
  }

  return parsedV1.major !== parsedV2.major
}

function findPathsToTarget(
  targetKey: string,
  nodes: Map<string, DependencyNode>,
  root: DependencyNode
): string[] {
  const visited = new Set<string>()
  const results = new Set<string>()

  const visit = (node: DependencyNode, trail: string[]): void => {
    const nodeKey = `${node.name}@${node.resolvedVersion}`
    const visitKey = `${trail.join('>')}->${nodeKey}`
    if (visited.has(visitKey)) {
      return
    }
    visited.add(visitKey)

    if (nodeKey === targetKey) {
      results.add(trail.join(' > ') || root.name)
      return
    }

    for (const dependency of node.dependencies) {
      visit(dependency, [...trail, `${node.name}@${node.resolvedVersion}`])
    }
  }

  visit(root, [])
  return [...results]
}

export function detectDiamonds(nodes: Map<string, DependencyNode>): DiamondDependency[] {
  const byName = new Map<string, DependencyNode[]>()

  for (const node of nodes.values()) {
    const existing = byName.get(node.name) ?? []
    existing.push(node)
    byName.set(node.name, existing)
  }

  const root = nodes.values().next().value as DependencyNode | undefined
  if (!root) {
    return []
  }

  const diamonds: DiamondDependency[] = []

  for (const [packageName, packageNodes] of byName.entries()) {
    const versions = [...new Set(packageNodes.map((node) => node.resolvedVersion))]
    if (versions.length < 2) {
      continue
    }

    diamonds.push({
      packageName,
      versions,
      requiredBy: versions.map((version) =>
        findPathsToTarget(`${packageName}@${version}`, nodes, root)
      )
    })
  }

  return diamonds.sort((a, b) => a.packageName.localeCompare(b.packageName))
}
