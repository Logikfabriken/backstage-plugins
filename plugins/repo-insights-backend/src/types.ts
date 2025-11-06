export interface RepoRef {
  owner: string;
  name: string;
  defaultBranch: string;
  url: string;
}

export interface FileCommitChange {
  sha: string;
  committedAt: string;
  author: string;
}

export interface FileChange {
  path: string;
  commits: FileCommitChange[];
}

export interface VolatilityEntry {
  path: string;
  commitCount: number;
  lastCommitAt: string;
}

export interface BusFactorEntry {
  path: string;
  distinctAuthors: number;
  topAuthor: string;
  topAuthorShare: number;
}

export interface TrendPoint {
  month: string;
  commits: number;
}

export interface DirectoryTrend {
  dir: string;
  series: TrendPoint[];
}

export interface ContributionTrend {
  global: { series: TrendPoint[] };
  perDirectory: DirectoryTrend[];
}

export interface RepoInsightsMetrics {
  generatedAt: string;
  repo: RepoRef;
  lookbackDays: number;
  volatility: VolatilityEntry[];
  busFactor: BusFactorEntry[];
  contributionTrend: ContributionTrend;
  partial: boolean;
}

export interface CommitSummary {
  sha: string;
  committedAt: string;
  author: string;
  files: string[];
}

export type ChangesByFile = Map<string, FileCommitChange[]>;
