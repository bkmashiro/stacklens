#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

import chalk from 'chalk'
import { Command } from 'commander'

import { formatAudit, formatComparison, formatJson, formatSummary, formatTree } from './formatter.js'
import { analyzeProject, buildGraph } from './graph.js'
import { RegistryClient } from './registry.js'

const program = new Command()
const client = new RegistryClient()

program
  .name('stacklens')
  .description('Analyze npm package dependency graphs')
  .version('0.1.0')

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
