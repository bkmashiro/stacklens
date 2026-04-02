export const MOCK_REGISTRY: Record<string, any> = {
  express: {
    'dist-tags': { latest: '4.18.2' },
    time: { '4.18.2': '2023-06-01T00:00:00.000Z' },
    versions: {
      '4.18.2': {
        name: 'express',
        version: '4.18.2',
        dependencies: { accepts: '~1.3.8', 'body-parser': '1.20.1' },
        dist: { unpackedSize: 220000 }
      }
    }
  },
  accepts: {
    'dist-tags': { latest: '1.3.8' },
    time: {
      '1.3.8': '2022-01-01T00:00:00.000Z',
      '2.0.0': '2024-01-01T00:00:00.000Z'
    },
    versions: {
      '1.3.8': {
        name: 'accepts',
        version: '1.3.8',
        dependencies: { 'mime-types': '~2.1.34' },
        dist: { unpackedSize: 15000 }
      },
      '2.0.0': {
        name: 'accepts',
        version: '2.0.0',
        dependencies: {},
        dist: { unpackedSize: 16000 }
      }
    }
  },
  'mime-types': {
    'dist-tags': { latest: '2.1.35' },
    time: { '2.1.35': '2023-01-01T00:00:00.000Z' },
    versions: {
      '2.1.35': {
        name: 'mime-types',
        version: '2.1.35',
        dependencies: {},
        dist: { unpackedSize: 40000 }
      }
    }
  },
  'deprecated-pkg': {
    'dist-tags': { latest: '1.0.0' },
    time: { '1.0.0': '2020-01-01T00:00:00.000Z' },
    versions: {
      '1.0.0': {
        name: 'deprecated-pkg',
        version: '1.0.0',
        deprecated: 'Use better-pkg instead',
        dependencies: {},
        dist: { unpackedSize: 5000 }
      }
    }
  },
  'diamond-root': {
    'dist-tags': { latest: '1.0.0' },
    time: { '1.0.0': '2024-01-01T00:00:00.000Z' },
    versions: {
      '1.0.0': {
        name: 'diamond-root',
        version: '1.0.0',
        dependencies: { alpha: '1.0.0', beta: '1.0.0' },
        dist: { unpackedSize: 1000 }
      }
    }
  },
  alpha: {
    'dist-tags': { latest: '1.0.0' },
    time: { '1.0.0': '2024-01-01T00:00:00.000Z' },
    versions: {
      '1.0.0': {
        name: 'alpha',
        version: '1.0.0',
        dependencies: { accepts: '1.3.8' },
        dist: { unpackedSize: 1000 }
      }
    }
  },
  beta: {
    'dist-tags': { latest: '1.0.0' },
    time: { '1.0.0': '2024-01-01T00:00:00.000Z' },
    versions: {
      '1.0.0': {
        name: 'beta',
        version: '1.0.0',
        dependencies: { accepts: '2.0.0' },
        dist: { unpackedSize: 1000 }
      }
    }
  }
}
