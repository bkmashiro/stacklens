import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
const IMPORT_PATTERN =
  /\bimport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g

export interface CircularChain {
  chain: string[]
  nodeCount: number
}

async function walkSourceFiles(targetPath: string): Promise<string[]> {
  const stat = await readdir(targetPath, { withFileTypes: true }).catch(() => null)
  if (stat === null) {
    return SOURCE_EXTENSIONS.includes(path.extname(targetPath)) ? [targetPath] : []
  }

  const files: string[] = []
  for (const entry of stat) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue
    }

    const absolutePath = path.join(targetPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkSourceFiles(absolutePath)))
      continue
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(absolutePath)
    }
  }

  return files
}

async function resolveImport(fromFile: string, specifier: string): Promise<string | null> {
  if (!specifier.startsWith('.')) {
    return null
  }

  const basePath = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(basePath, `index${extension}`))
  ]

  for (const candidate of candidates) {
    try {
      const stats = await readFile(candidate)
      if (stats) {
        return candidate
      }
    } catch {
      continue
    }
  }

  return null
}

function normalizeCycle(cycle: string[]): string {
  const core = cycle.slice(0, -1)
  const rotations = core.map((_, index) => {
    const rotated = [...core.slice(index), ...core.slice(0, index)]
    return rotated.join('>')
  })
  const reversed = [...core].reverse()
  const reverseRotations = reversed.map((_, index) => {
    const rotated = [...reversed.slice(index), ...reversed.slice(0, index)]
    return rotated.join('>')
  })

  return [...rotations, ...reverseRotations].sort()[0] ?? core.join('>')
}

export function detectCircularChains(graph: ReadonlyMap<string, readonly string[]>): CircularChain[] {
  const visited = new Set<string>()
  const active = new Set<string>()
  const stack: string[] = []
  const chains = new Map<string, CircularChain>()

  const visit = (node: string) => {
    visited.add(node)
    active.add(node)
    stack.push(node)

    for (const dependency of graph.get(node) ?? []) {
      if (!graph.has(dependency)) {
        continue
      }

      if (!visited.has(dependency)) {
        visit(dependency)
        continue
      }

      if (!active.has(dependency)) {
        continue
      }

      const startIndex = stack.indexOf(dependency)
      if (startIndex === -1) {
        continue
      }

      const cycle = [...stack.slice(startIndex), dependency]
      const key = normalizeCycle(cycle)
      if (!chains.has(key)) {
        chains.set(key, { chain: cycle, nodeCount: cycle.length - 1 })
      }
    }

    stack.pop()
    active.delete(node)
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      visit(node)
    }
  }

  return [...chains.values()].sort((left, right) => right.nodeCount - left.nodeCount)
}

export async function buildImportGraph(targetPath: string): Promise<Map<string, string[]>> {
  const absoluteTarget = path.resolve(targetPath)
  const files = await walkSourceFiles(absoluteTarget)
  const graph = new Map<string, string[]>()

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const dependencies = new Set<string>()

    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (!specifier) {
        continue
      }

      const resolved = await resolveImport(file, specifier)
      if (resolved) {
        dependencies.add(resolved)
      }
    }

    graph.set(file, [...dependencies])
  }

  return graph
}

export async function detectCircularDependencies(targetPath: string): Promise<CircularChain[]> {
  const graph = await buildImportGraph(targetPath)
  return detectCircularChains(graph)
}
