import type { DependencyNode, GraphAnalysis } from './types.js'

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatBytes(bytes: number): string {
  return formatSize(bytes)
}

function renderTree(
  node: DependencyNode,
  ancestry = '',
  isLast = true,
  maxDepth = Number.POSITIVE_INFINITY,
  isRoot = true
): string[] {
  const connector = isRoot ? '' : isLast ? '└── ' : '├── '
  const line = `${ancestry}${connector}${node.name}@${node.resolvedVersion}`
  if (node.depth >= maxDepth) {
    return [line]
  }

  const childPrefix = isRoot ? '' : `${ancestry}${isLast ? '    ' : '│   '}`
  const lines = [line]
  node.dependencies.forEach((dependency, index) => {
    lines.push(
      ...renderTree(
        dependency,
        childPrefix,
        index === node.dependencies.length - 1,
        maxDepth,
        false
      )
    )
  })
  return lines
}

export function formatTree(analysis: GraphAnalysis, maxDepth = Number.POSITIVE_INFINITY): string {
  return renderTree(analysis.root, '', true, maxDepth).join('\n')
}

export function formatSummary(analysis: GraphAnalysis): string {
  return [
    `Total unique packages: ${analysis.uniquePackageCount}`,
    `Estimated install size: ${formatSize(analysis.totalSize)}`,
    `Maximum depth: ${analysis.maxDepth}`,
    `Deprecated packages: ${analysis.deprecated.length}`,
    `Unmaintained packages: ${analysis.unmaintained.length}`,
    `Diamond dependencies: ${analysis.diamondDeps.length}`
  ].join('\n')
}

export function formatComparison(analyses: GraphAnalysis[]): string {
  return analyses
    .map(
      (analysis) =>
        `${analysis.root.name}: ${analysis.root.dependencies.length} direct dependencies, ${formatSize(analysis.totalSize)}`
    )
    .join('\n')
}

export function formatJson(analysis: GraphAnalysis): string {
  return JSON.stringify(
    {
      root: analysis.root,
      allPackages: [...analysis.allPackages.entries()],
      diamondDeps: analysis.diamondDeps,
      deprecated: analysis.deprecated,
      unmaintained: analysis.unmaintained,
      totalSize: analysis.totalSize,
      uniquePackageCount: analysis.uniquePackageCount,
      maxDepth: analysis.maxDepth
    },
    null,
    2
  )
}

export function formatAudit(analysis: GraphAnalysis): string {
  const lines = [
    `Auditing ${analysis.root.dependencies.length} dependencies...`,
    `${analysis.deprecated.length} deprecated packages found`,
    `${analysis.unmaintained.length} unmaintained packages found`,
    `${analysis.diamondDeps.length} diamond dependency conflicts found`
  ]

  if (analysis.deprecated.length > 0) {
    lines.push('')
    lines.push('Deprecated packages:')
    for (const node of analysis.deprecated) {
      lines.push(`- ${node.name}@${node.resolvedVersion}`)
    }
  }

  return lines.join('\n')
}
