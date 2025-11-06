import { RepoCoordinates } from './config';
import {
  BusFactorEntry,
  ContributionTrend,
  RepoInsightsMetrics,
  TrendPoint,
  VolatilityEntry,
} from './types';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const MONTH_SERIES_LENGTH = 6;

const VOLATILITY_TEMPLATE: Array<{
  path: string;
  commitCount: number;
  lastCommitOffsetDays: number;
}> = [
  { path: 'services/coffee/src/index.ts', commitCount: 18, lastCommitOffsetDays: 3 },
  { path: 'services/coffee/src/menu.ts', commitCount: 15, lastCommitOffsetDays: 8 },
  { path: 'packages/caffeine-core/index.ts', commitCount: 12, lastCommitOffsetDays: 11 },
  { path: 'apps/kiosk/src/components/Checkout.tsx', commitCount: 9, lastCommitOffsetDays: 14 },
  { path: 'infrastructure/terraform/service.tf', commitCount: 8, lastCommitOffsetDays: 16 },
];

const BUS_FACTOR_TEMPLATE: BusFactorEntry[] = [
  {
    path: 'services/coffee/src/index.ts',
    distinctAuthors: 4,
    topAuthor: 'ada.l',
    topAuthorShare: 0.44,
  },
  {
    path: 'services/coffee/src/menu.ts',
    distinctAuthors: 3,
    topAuthor: 'linus.p',
    topAuthorShare: 0.53,
  },
  {
    path: 'packages/caffeine-core/index.ts',
    distinctAuthors: 5,
    topAuthor: 'samira.k',
    topAuthorShare: 0.31,
  },
  {
    path: 'apps/kiosk/src/components/Checkout.tsx',
    distinctAuthors: 2,
    topAuthor: 'leo.h',
    topAuthorShare: 0.62,
  },
  {
    path: 'infrastructure/terraform/service.tf',
    distinctAuthors: 4,
    topAuthor: 'jules.r',
    topAuthorShare: 0.29,
  },
];

const GLOBAL_COMMITS_TEMPLATE = [28, 33, 41, 35, 24, 30];
const DIRECTORY_COMMITS_TEMPLATE: Array<{ dir: string; commits: number[] }> = [
  { dir: 'services', commits: [12, 15, 20, 17, 11, 14] },
  { dir: 'packages', commits: [9, 10, 12, 10, 7, 9] },
  { dir: 'apps', commits: [5, 6, 7, 6, 4, 5] },
  { dir: 'infrastructure', commits: [2, 2, 2, 2, 2, 2] },
];

export function buildMockMetrics(options: {
  repoCoordinates: RepoCoordinates;
  repoUrl: string;
  lookbackDays: number;
  now?: Date;
}): RepoInsightsMetrics {
  const now = options.now ?? new Date();
  const repo = {
    owner: options.repoCoordinates.owner,
    name: options.repoCoordinates.repo,
    defaultBranch: 'main',
    url: options.repoUrl,
  };

  const volatility = buildVolatilityEntries(now);
  const busFactor = BUS_FACTOR_TEMPLATE.map(entry => ({ ...entry }));
  const contributionTrend = buildContributionTrend(now);

  return {
    generatedAt: now.toISOString(),
    repo,
    lookbackDays: options.lookbackDays,
    volatility,
    busFactor,
    contributionTrend,
    partial: false,
  };
}

function buildVolatilityEntries(now: Date): VolatilityEntry[] {
  return VOLATILITY_TEMPLATE.map(entry => ({
    path: entry.path,
    commitCount: entry.commitCount,
    lastCommitAt: isoDaysAgo(now, entry.lastCommitOffsetDays),
  }));
}

function buildContributionTrend(now: Date): ContributionTrend {
  const months = collectMonths(now, MONTH_SERIES_LENGTH);
  const globalSeries: TrendPoint[] = months.map((month, index) => ({
    month,
    commits: GLOBAL_COMMITS_TEMPLATE[index] ?? GLOBAL_COMMITS_TEMPLATE.at(-1)!,
  }));

  const perDirectory = DIRECTORY_COMMITS_TEMPLATE.map(dirEntry => ({
    dir: dirEntry.dir,
    series: months.map((month, index) => ({
      month,
      commits: dirEntry.commits[index] ?? dirEntry.commits.at(-1)!,
    })),
  })).sort((a, b) => a.dir.localeCompare(b.dir));

  return {
    global: { series: globalSeries },
    perDirectory,
  };
}

function collectMonths(now: Date, count: number): string[] {
  const months: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    date.setUTCMonth(date.getUTCMonth() - offset);
    months.push(formatMonth(date));
  }
  return months;
}

function isoDaysAgo(now: Date, daysAgo: number): string {
  const date = new Date(now.getTime() - daysAgo * MS_IN_DAY);
  return date.toISOString();
}

function formatMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}
