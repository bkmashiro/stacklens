#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import chalk from 'chalk'
import { Command } from 'commander'

import { formatAudit, formatComparison, formatJson, formatSummary, formatTree } from './formatter.js'
import { detectCircularDependencies } from './circular.js'
import { analyzeProject, buildGraph } from './graph.js'
import { RegistryClient } from './registry.js'
import { formatTreemapBreakdown, generateTreemap } from './treemap.js'

const program = new Command()
const client = new RegistryClient()
const require = createRequire(import.meta.url)
const packageJson = require('../package.json') as { version: string }

program
  .name('stacklens')
  .description('Analyze npm package dependency graphs')
  .version(packageJson.version)
  .option('--circular <target>', 'Detect circular imports in a local source tree')
  .option('--treemap <output>', 'Generate a dependency treemap HTML file')
  .action(async (options) => {
    if (options.circular) {
      const cycles = await detectCircularDependencies(options.circular)
      const labelBase = path.resolve(options.circular)

      if (cycles.length === 0) {
        console.log('No circular dependency chains found.')
      } else {
        console.log('Circular dependency chains found:')
        console.log('')
        for (const cycle of cycles) {
          const icon = cycle.nodeCount >= 3 ? '🔴' : '🟡'
          const reason =
            cycle.nodeCount >= 3 ? 'breaks tree-shaking' : 'tight two-module coupling'
          const chain = cycle.chain
            .map((entry) => path.relative(process.cwd(), entry) || path.relative(labelBase, entry))
            .join(' → ')
          console.log(`  ${icon} ${chain}`)
          console.log(`     (${cycle.nodeCount}-node cycle, ${reason})`)
          console.log('')
        }
        console.log(`${cycles.length} circular chains found.`)
        console.log('Fix: extract shared code to a new module that neither imports.')
      }
    }

    if (options.treemap) {
      const nodes = await generateTreemap(options.treemap)
      console.log(chalk.cyan(`Analyzing ${nodes.length} dependencies...`))
      console.log(`Generated: ${options.treemap}`)
      console.log('')
      console.log('  Size breakdown:')
      console.log(formatTreemapBreakdown(nodes))
    }

    if (!options.circular && !options.treemap) {
      program.outputHelp()
    }
  })

program
  .command('analyze')
  .argument('<package>')
  .argument('[version]')
  .option('--depth <n>', 'Max dependency depth', '5')
  .option('--json', 'JSON output', false)
  .option('--no-dev', 'Skip devDependencies')
  .option('--show-size', 'Show package sizes')
  .option('--deprecated', 'Only show deprecated packages')
  .action(async (pkg: string, version: string | undefined, options) => {
    const resolvedVersion = version ?? (await client.getLatestVersion(pkg))
    const analysis = await buildGraph(pkg, resolvedVersion, client, Number(options.depth))

    if (options.json) {
      console.log(formatJson(analysis))
      return
    }

    console.log(chalk.cyan(`Analyzing ${pkg}@${resolvedVersion} dependency graph...`))
    if (options.deprecated) {
      console.log(
        analysis.deprecated.map((node) => `${node.name}@${node.resolvedVersion}`).join('\n') ||
          'No deprecated packages found.'
      )
      return
    }

    console.log('')
    console.log(formatSummary(analysis))
    if (options.showSize) {
      console.log('')
      console.log(formatTree(analysis, Number(options.depth)))
    }
  })

program
  .command('compare')
  .argument('<packages...>')
  .option('--depth <n>', 'Depth for comparison', '5')
  .action(async (packages: string[], options) => {
    const analyses = await Promise.all(
      packages.map(async (pkg) => {
        const version = await client.getLatestVersion(pkg)
        return buildGraph(pkg, version, client, Number(options.depth))
      })
    )

    console.log(chalk.cyan(`Comparing ${packages.join(' vs ')}:`))
    console.log(formatComparison(analyses))
  })

program
  .command('audit')
  .argument('<packageJson>')
  .option('--depth <n>', 'Max dependency depth', '5')
  .option('--json', 'JSON output', false)
  .action(async (packageJsonPath: string, options) => {
    await readFile(packageJsonPath, 'utf8')
    const analysis = await analyzeProject(packageJsonPath, client, Number(options.depth))

    if (options.json) {
      console.log(formatJson(analysis))
      return
    }

    console.log(formatAudit(analysis))
  })

program
  .command('tree')
  .argument('<package>')
  .option('--depth <n>', 'ASCII tree visualization depth', '5')
  .action(async (pkg: string, options) => {
    const version = await client.getLatestVersion(pkg)
    const analysis = await buildGraph(pkg, version, client, Number(options.depth))
    console.log(formatTree(analysis, Number(options.depth)))
  })

await program.parseAsync(process.argv)
