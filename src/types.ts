export interface PackageInfo {
  name: string
  version: string
  description: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  deprecated?: string
  lastPublish: string
  unpackedSize?: number
  license?: string
}

export interface DependencyNode {
  name: string
  version: string
  resolvedVersion: string
  depth: number
  dependencies: DependencyNode[]
  isDeprecated: boolean
  daysSinceRelease: number
  unpackedSize: number
}

export interface DiamondDependency {
  packageName: string
  versions: string[]
  requiredBy: string[][]
}

export interface GraphAnalysis {
  root: DependencyNode
  allPackages: Map<string, DependencyNode>
  diamondDeps: DiamondDependency[]
  deprecated: DependencyNode[]
  unmaintained: DependencyNode[]
  totalSize: number
  uniquePackageCount: number
  maxDepth: number
}
