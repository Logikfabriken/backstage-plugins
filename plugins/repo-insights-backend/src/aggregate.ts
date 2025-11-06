import {
  BusFactorEntry,
  ChangesByFile,
  CommitSummary,
  ContributionTrend,
  DirectoryTrend,
  FileCommitChange,
  TrendPoint,
  VolatilityEntry,
} from './types';

const ROOT_DIR = '[root]';

export function aggregateVolatility(changesByFile: ChangesByFile): VolatilityEntry[] {
  const entries: VolatilityEntry[] = [];

  for (const [path, commits] of changesByFile.entries()) {
    if (!commits.length) {
      continue;
    }
    const lastCommitAt = commits
      .map(commit => commit.committedAt)
      .sort()
      .at(-1) as string;
    entries.push({
      path,
      commitCount: commits.length,
      lastCommitAt,
    });
  }

  return entries.sort((a, b) => {
    if (b.commitCount !== a.commitCount) {
      return b.commitCount - a.commitCount;
    }
    return a.path.localeCompare(b.path);
  });
}

export function aggregateBusFactor(changesByFile: ChangesByFile): BusFactorEntry[] {
  const entries: BusFactorEntry[] = [];

  for (const [path, commits] of changesByFile.entries()) {
    if (!commits.length) {
      continue;
    }

    const counts = commits.reduce<Record<string, number>>((acc, commit) => {
      acc[commit.author] = (acc[commit.author] ?? 0) + 1;
      return acc;
    }, {});

    const authors = Object.entries(counts);
    const totalCommits = commits.length;
    const [topAuthor, topCount] =
      authors.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];

    entries.push({
      path,
      distinctAuthors: authors.length,
      topAuthor: topAuthor ?? 'unknown',
      topAuthorShare: totalCommits ? (topCount ?? 0) / totalCommits : 0,
    });
  }

  return entries.sort((a, b) => {
    if (b.topAuthorShare !== a.topAuthorShare) {
      return b.topAuthorShare - a.topAuthorShare;
    }
    if (b.distinctAuthors !== a.distinctAuthors) {
      return b.distinctAuthors - a.distinctAuthors;
    }
    return a.path.localeCompare(b.path);
  });
}

export function aggregateContributionTrend(options: {
  current: CommitSummary[];
  previous: CommitSummary[];
  lookbackDays: number;
  now?: Date;
}): ContributionTrend {
  const { current, previous, lookbackDays } = options;
  const now = options.now ?? new Date();
  const rangeStart = new Date(now.getTime() - lookbackDays * 2 * 24 * 60 * 60 * 1000);

  const months = buildMonthBuckets(rangeStart, now);
  const monthSet = new Set(months);

  const allCommits = [...previous, ...current];
  const globalCounts = new Map<string, number>(months.map(month => [month, 0]));
  const directoryCounts = new Map<string, Map<string, number>>();

  for (const commit of allCommits) {
    const month = formatMonth(commit.committedAt);
    if (!monthSet.has(month)) {
      continue;
    }
    globalCounts.set(month, (globalCounts.get(month) ?? 0) + 1);

    const directories = collectDirectories(commit);
    for (const dir of directories) {
      const dirCounts = directoryCounts.get(dir) ?? new Map<string, number>();
      directoryCounts.set(dir, dirCounts);
      dirCounts.set(month, (dirCounts.get(month) ?? 0) + 1);
    }
  }

  const globalSeries: TrendPoint[] = months.map(month => ({
    month,
    commits: globalCounts.get(month) ?? 0,
  }));

  const perDirectory: DirectoryTrend[] = Array.from(directoryCounts.entries())
    .map(([dir, counts]) => ({
      dir,
      series: months.map(month => ({
        month,
        commits: counts.get(month) ?? 0,
      })),
    }))
    .sort((a, b) => a.dir.localeCompare(b.dir));

  return {
    global: { series: globalSeries },
    perDirectory,
  };
}

function buildMonthBuckets(start: Date, end: Date): string[] {
  const buckets: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= endMonth) {
    buckets.push(formatMonth(cursor.toISOString()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return buckets;
}

function formatMonth(dateLike: string | Date): string {
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function collectDirectories(commit: CommitSummary): Set<string> {
  const dirs = new Set<string>();
  for (const filePath of commit.files) {
    const dir = filePath.includes('/') ? filePath.split('/', 1)[0] : ROOT_DIR;
    dirs.add(dir || ROOT_DIR);
  }

  if (!dirs.size) {
    dirs.add(ROOT_DIR);
  }

  return dirs;
}

export function createChangesByFile(commits: CommitSummary[]): ChangesByFile {
  const map: ChangesByFile = new Map();

  for (const commit of commits) {
    for (const path of commit.files) {
      const changes = map.get(path) ?? [];
      changes.push(extractCommitChange(commit));
      map.set(path, changes);
    }
  }

  return map;
}

function extractCommitChange(commit: CommitSummary): FileCommitChange {
  return {
    sha: commit.sha,
    committedAt: commit.committedAt,
    author: commit.author,
  };
}
