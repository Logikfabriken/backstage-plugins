import {
  aggregateBusFactor,
  aggregateContributionTrend,
  aggregateVolatility,
  createChangesByFile,
} from './aggregate';
import { ChangesByFile, CommitSummary } from './types';

const baseChanges: ChangesByFile = new Map([
  [
    'src/a.ts',
    [
      { sha: '1', committedAt: '2024-01-01T00:00:00Z', author: 'alice' },
      { sha: '2', committedAt: '2024-01-05T00:00:00Z', author: 'bob' },
      { sha: '3', committedAt: '2024-01-07T00:00:00Z', author: 'alice' },
    ],
  ],
  [
    'src/b.ts',
    [
      { sha: '4', committedAt: '2024-01-02T00:00:00Z', author: 'alice' },
      { sha: '5', committedAt: '2024-01-03T00:00:00Z', author: 'alice' },
    ],
  ],
  [
    'README.md',
    [{ sha: '6', committedAt: '2024-01-04T00:00:00Z', author: 'carol' }],
  ],
]);

describe('aggregateVolatility', () => {
  it('sorts files by commit count and reports the last commit timestamp', () => {
    const result = aggregateVolatility(baseChanges);
    expect(result[0]).toEqual({
      path: 'src/a.ts',
      commitCount: 3,
      lastCommitAt: '2024-01-07T00:00:00Z',
    });
    expect(result[1].path).toBe('src/b.ts');
    expect(result[2].path).toBe('README.md');
  });
});

describe('aggregateBusFactor', () => {
  it('captures author distribution and risk ordering', () => {
    const result = aggregateBusFactor(baseChanges);

    expect(result[0]).toMatchObject({
      path: 'README.md',
      distinctAuthors: 1,
      topAuthor: 'carol',
      topAuthorShare: 1,
    });

    const srcA = result.find(entry => entry.path === 'src/a.ts');
    expect(srcA).toMatchObject({
      distinctAuthors: 2,
      topAuthorShare: 2 / 3,
    });
  });
});

describe('aggregateContributionTrend', () => {
  it('builds monthly series for global and per-directory data', () => {
    const previous: CommitSummary[] = [
      {
        sha: 'p1',
        author: 'alice',
        committedAt: '2024-01-15T00:00:00Z',
        files: ['src/index.ts'],
      },
      {
        sha: 'p2',
        author: 'bob',
        committedAt: '2024-02-10T00:00:00Z',
        files: ['docs/readme.md'],
      },
    ];

    const current: CommitSummary[] = [
      {
        sha: 'c1',
        author: 'carol',
        committedAt: '2024-03-05T00:00:00Z',
        files: ['src/api.ts', 'src/ui.ts'],
      },
      {
        sha: 'c2',
        author: 'dave',
        committedAt: '2024-03-25T00:00:00Z',
        files: ['src/ui.ts', 'package.json'],
      },
      {
        sha: 'c3',
        author: 'erin',
        committedAt: '2024-04-05T00:00:00Z',
        files: ['docs/contrib.md'],
      },
    ];

    const result = aggregateContributionTrend({
      current,
      previous,
      lookbackDays: 60,
      now: new Date('2024-04-15T00:00:00Z'),
    });

    expect(result.global.series).toEqual([
      { month: '2023-12', commits: 0 },
      { month: '2024-01', commits: 1 },
      { month: '2024-02', commits: 1 },
      { month: '2024-03', commits: 2 },
      { month: '2024-04', commits: 1 },
    ]);

    const srcDir = result.perDirectory.find(entry => entry.dir === 'src');
    expect(srcDir?.series.map(point => point.commits)).toEqual([
      0, 1, 0, 2, 0,
    ]);

    const docsDir = result.perDirectory.find(entry => entry.dir === 'docs');
    expect(docsDir?.series.map(point => point.commits)).toEqual([
      0, 0, 1, 0, 1,
    ]);

    const rootDir = result.perDirectory.find(entry => entry.dir === '[root]');
    expect(rootDir?.series.map(point => point.commits)).toEqual([
      0, 0, 0, 1, 0,
    ]);
  });
});

describe('createChangesByFile', () => {
  it('explodes commits into individual file change buckets', () => {
    const commits: CommitSummary[] = [
      {
        sha: 'x1',
        author: 'alice',
        committedAt: '2024-03-01T00:00:00Z',
        files: ['src/a.ts', 'src/b.ts'],
      },
    ];

    const changes = createChangesByFile(commits);
    expect(changes.get('src/a.ts')).toHaveLength(1);
    expect(changes.get('src/b.ts')).toHaveLength(1);
  });
});
