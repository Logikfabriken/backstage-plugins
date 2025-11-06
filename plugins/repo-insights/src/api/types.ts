export interface RepoSummary {
  owner: string;
  name: string;
  defaultBranch: string;
  url: string;
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

export interface RepoInsightsMetricsResponse {
  generatedAt: string;
  repo: RepoSummary;
  lookbackDays: number;
  partial: boolean;
  volatility: VolatilityEntry[];
  busFactor: BusFactorEntry[];
  contributionTrend: ContributionTrend;
}
