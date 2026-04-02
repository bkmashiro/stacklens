import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { formatBytes } from './formatter.js'

export interface TreemapNode {
  name: string
  size: number
  dependents: string[]
  dependencies: string[]
}

interface PackageScan {
  node: TreemapNode
  packageDir: string
  packageJsonPath: string
}

async function dirSize(targetPath: string): Promise<number> {
  const stats = await stat(targetPath)
  if (!stats.isDirectory()) {
    return stats.size
  }

  let total = 0
  const entries = await readdir(targetPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      continue
    }

    total += await dirSize(path.join(targetPath, entry.name))
  }

  return total
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function resolveInstalledPackage(
  packageName: string,
  requesterDir: string,
  projectRoot: string
): Promise<string | null> {
  const candidates = [
    path.join(requesterDir, 'node_modules', packageName),
    path.join(projectRoot, 'node_modules', packageName)
  ]

  for (const candidate of candidates) {
    try {
      const packageJson = path.join(candidate, 'package.json')
      await stat(packageJson)
      return candidate
    } catch {
      continue
    }
  }

  return null
}

async function scanPackage(
  packageDir: string,
  projectRoot: string,
  seenByDir: Map<string, Promise<PackageScan | null>>,
  nodes: Map<string, TreemapNode>
): Promise<PackageScan | null> {
  if (seenByDir.has(packageDir)) {
    return seenByDir.get(packageDir) ?? null
  }

  const pending = (async () => {
    const packageJsonPath = path.join(packageDir, 'package.json')
    let manifest: {
      name: string
      dependencies?: Record<string, string>
    }

    try {
      manifest = await readJson(packageJsonPath)
    } catch {
      return null
    }

    const existingNode = nodes.get(manifest.name)
    const node =
      existingNode ??
      ({
        name: manifest.name,
        size: await dirSize(packageDir),
        dependents: [],
        dependencies: []
      } satisfies TreemapNode)

    nodes.set(manifest.name, node)

    const dependencyNames = Object.keys(manifest.dependencies ?? {})
    const resolvedDependencies = new Set<string>()

    for (const dependencyName of dependencyNames) {
      const dependencyDir = await resolveInstalledPackage(dependencyName, packageDir, projectRoot)
      if (!dependencyDir) {
        continue
      }

      const dependencyScan = await scanPackage(dependencyDir, projectRoot, seenByDir, nodes)
      if (!dependencyScan) {
        continue
      }

      resolvedDependencies.add(dependencyScan.node.name)
      if (!dependencyScan.node.dependents.includes(manifest.name)) {
        dependencyScan.node.dependents.push(manifest.name)
      }
    }

    node.dependencies = [...new Set([...node.dependencies, ...resolvedDependencies])].sort()
    node.dependents.sort()

    return { node, packageDir, packageJsonPath }
  })()

  seenByDir.set(packageDir, pending)
  return pending
}

export async function collectTreemapData(projectRoot = process.cwd()): Promise<TreemapNode[]> {
  const manifestPath = path.join(projectRoot, 'package.json')
  const manifest = await readJson<{
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }>(manifestPath)
  const dependencyNames = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {})
  ]

  const seenByDir = new Map<string, Promise<PackageScan | null>>()
  const nodes = new Map<string, TreemapNode>()

  for (const dependencyName of dependencyNames) {
    const dependencyDir = await resolveInstalledPackage(dependencyName, projectRoot, projectRoot)
    if (!dependencyDir) {
      continue
    }

    const scan = await scanPackage(dependencyDir, projectRoot, seenByDir, nodes)
    if (scan && !scan.node.dependents.includes('(root)')) {
      scan.node.dependents.push('(root)')
      scan.node.dependents.sort()
    }
  }

  return [...nodes.values()].sort((left, right) => right.size - left.size || left.name.localeCompare(right.name))
}

export function renderTreemapHtml(nodes: TreemapNode[]): string {
  const payload = JSON.stringify({
    name: 'dependencies',
    children: nodes.map((node) => ({
      name: node.name,
      value: node.size,
      dependents: node.dependents,
      dependencies: node.dependencies
    }))
  })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>stacklens treemap</title>
    <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1ea;
        --panel: #fffaf1;
        --ink: #1c1917;
        --muted: #57534e;
        --stroke: rgba(28, 25, 23, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 30%),
          radial-gradient(circle at bottom right, rgba(14, 116, 144, 0.18), transparent 35%),
          var(--bg);
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 20px;
        padding: 24px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 18px;
        box-shadow: 0 10px 30px rgba(28, 25, 23, 0.08);
      }
      .chart {
        min-height: 720px;
        overflow: hidden;
      }
      .sidebar {
        padding: 20px;
      }
      h1, h2, p { margin: 0; }
      h1 {
        padding: 20px 24px 0;
        font-size: 1.5rem;
      }
      .subhead {
        padding: 8px 24px 20px;
        color: var(--muted);
      }
      svg {
        display: block;
        width: 100%;
        height: 720px;
      }
      .tile rect {
        stroke: rgba(255, 255, 255, 0.9);
        stroke-width: 2;
        cursor: pointer;
      }
      .tile text {
        pointer-events: none;
        fill: rgba(28, 25, 23, 0.92);
        font-size: 12px;
        font-weight: 600;
      }
      .sidebar h2 {
        font-size: 1rem;
        margin-bottom: 12px;
      }
      .sidebar p, .sidebar li {
        color: var(--muted);
        line-height: 1.45;
      }
      ul {
        padding-left: 18px;
      }
      @media (max-width: 960px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .chart, svg {
          min-height: 520px;
          height: 520px;
        }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <section class="panel chart">
        <h1>stacklens bundle treemap</h1>
        <p class="subhead">Estimated installed size by dependency. Click a box to inspect dependents.</p>
        <svg id="treemap" viewBox="0 0 960 720" preserveAspectRatio="none"></svg>
      </section>
      <aside class="panel sidebar">
        <h2 id="details-title">Select a dependency</h2>
        <p id="details-size">Click a tile to view size and dependents.</p>
        <h2>Dependents</h2>
        <ul id="details-dependents"><li>None selected</li></ul>
        <h2>Dependencies</h2>
        <ul id="details-dependencies"><li>None selected</li></ul>
      </aside>
    </div>
    <script>
      const data = ${payload};
      const width = 960;
      const height = 720;
      const root = d3.hierarchy(data).sum((d) => d.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      d3.treemap().size([width, height]).paddingInner(6).round(true)(root);

      const color = d3.scaleSequential([0, d3.max(root.leaves(), (d) => d.value ?? 0) || 1], d3.interpolateYlOrBr);
      const svg = d3.select('#treemap');
      const tiles = svg.selectAll('g')
        .data(root.leaves())
        .join('g')
        .attr('class', 'tile')
        .attr('transform', (d) => 'translate(' + d.x0 + ',' + d.y0 + ')');

      tiles.append('rect')
        .attr('width', (d) => Math.max(0, d.x1 - d.x0))
        .attr('height', (d) => Math.max(0, d.y1 - d.y0))
        .attr('fill', (d) => color(d.value ?? 0))
        .on('click', (_, d) => {
          const payload = d.data;
          document.getElementById('details-title').textContent = payload.name;
          document.getElementById('details-size').textContent = 'Estimated size: ' + new Intl.NumberFormat().format(payload.value) + ' bytes';

          const dependents = document.getElementById('details-dependents');
          dependents.innerHTML = '';
          for (const dependent of payload.dependents.length ? payload.dependents : ['No dependents found']) {
            const item = document.createElement('li');
            item.textContent = dependent;
            dependents.appendChild(item);
          }

          const dependencies = document.getElementById('details-dependencies');
          dependencies.innerHTML = '';
          for (const dependency of payload.dependencies.length ? payload.dependencies : ['No dependencies found']) {
            const item = document.createElement('li');
            item.textContent = dependency;
            dependencies.appendChild(item);
          }
        });

      tiles.append('text')
        .attr('x', 10)
        .attr('y', 20)
        .text((d) => d.data.name);

      tiles.append('text')
        .attr('x', 10)
        .attr('y', 38)
        .attr('fill-opacity', 0.74)
        .text((d) => {
          const value = d.value ?? 0;
          if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB';
          if (value >= 1024) return (value / 1024).toFixed(1) + ' KB';
          return value + ' B';
        });
    </script>
  </body>
</html>`
}

export async function generateTreemap(outputPath: string, projectRoot = process.cwd()): Promise<TreemapNode[]> {
  const nodes = await collectTreemapData(projectRoot)
  const html = renderTreemapHtml(nodes)
  await writeFile(outputPath, html, 'utf8')
  return nodes
}

export function formatTreemapBreakdown(nodes: TreemapNode[]): string {
  const maxSize = Math.max(...nodes.map((node) => node.size), 1)
  return nodes
    .slice(0, 10)
    .map((node) => {
      const blocks = Math.max(1, Math.round((node.size / maxSize) * 24))
      return `  ${node.name.padEnd(12)} ${formatBytes(node.size).padEnd(8)} ${'█'.repeat(blocks)}`
    })
    .join('\n')
}
