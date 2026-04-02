# stacklens

`stacklens` is a TypeScript CLI for inspecting npm dependency graphs. It resolves transitive dependencies, flags deprecated and stale packages, detects diamond dependency version splits, and reports simple size metrics from npm registry metadata.

## Install

```bash
pnpm add -g stacklens
```

## Usage

```bash
stacklens analyze react
stacklens analyze express 4.18.2 --depth 3 --json
stacklens compare lodash date-fns
stacklens audit ./package.json
stacklens tree express --depth 2
```

## Commands

### `analyze`

Analyze a published package and print summary data or JSON.

```bash
stacklens analyze react
stacklens analyze express --depth 3 --json > express-graph.json
stacklens analyze deprecated-pkg --deprecated
```

Options:

- `--depth <n>` limit graph traversal depth, default `5`
- `--json` emit structured JSON
- `--no-dev` accepted for CLI compatibility
- `--show-size` include the ASCII tree in the terminal output
- `--deprecated` print only deprecated packages in the graph

### `compare`

Compare top-level graph size and direct dependency counts across packages.

```bash
stacklens compare lodash date-fns
stacklens compare react vue svelte --depth 2
```

### `audit`

Audit a local `package.json` by resolving its dependencies from the npm registry.

```bash
stacklens audit ./package.json
stacklens audit ./package.json --json
```

### `tree`

Render the dependency graph as an ASCII tree.

```bash
stacklens tree react
stacklens tree express --depth 2
```

## Diamond Dependencies

A diamond dependency happens when multiple branches of a dependency graph require the same package name at different resolved versions. `stacklens` reports these splits so you can spot potential duplication or major-version conflicts such as `accepts@1.3.8` and `accepts@2.0.0`.

## Compared With `npm ls`

`npm ls` shows the installed tree from a local project. `stacklens` works from npm registry metadata, can compare published packages without installing them, and produces structured JSON focused on transitive counts, diamonds, deprecations, stale releases, and unpacked size estimates.
