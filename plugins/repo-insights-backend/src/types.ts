import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

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

export interface RepoInsightsMetrics {
  generatedAt: string;
  repo: RepoRef;
  volatility: VolatilityEntry[];
  busFactor: BusFactorEntry[];
}

export interface CommitSummary {
  sha: string;
  committedAt: string;
  author: string;
  files: string[];
}

export type ChangesByFile = Map<string, FileCommitChange[]>;

export type RouterDeps = {
  logger: LoggerService;
  config: Config;
};

export type CommitListItem = {
  sha: string;
  committedAt: string;
  author: string;
};

export type WindowResult = {
  commits: CommitListItem[];
  truncated: boolean;
};
