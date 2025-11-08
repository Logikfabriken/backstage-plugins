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

export function aggregateVolatility(
  changesByFile: ChangesByFile,
): VolatilityEntry[] {
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

export function aggregateBusFactor(
  changesByFile: ChangesByFile,
): BusFactorEntry[] {
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
