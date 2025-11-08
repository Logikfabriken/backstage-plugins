import { Router } from 'express';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import pLimit from 'p-limit';
import {
  aggregateBusFactor,
  aggregateContributionTrend,
  aggregateVolatility,
  createChangesByFile,
} from './aggregate';
import { parseRepoUrl, readRepoInsightsConfig } from './config';
import { createGithubClient, resolveGithubToken } from './githubClient';
import { buildMockMetrics, mockData } from './mockData';
import { CommitSummary, RepoInsightsMetrics, RepoRef } from './types';

const DETAIL_CONCURRENCY = 10;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

type RouterDeps = {
  logger: LoggerService;
  config: Config;
};

type CommitListItem = {
  sha: string;
  committedAt: string;
  author: string;
};

type WindowResult = {
  commits: CommitListItem[];
  truncated: boolean;
};

export async function createRouter({ logger, config }: RouterDeps) {
  const router = Router();
  const pluginConfig = readRepoInsightsConfig(config);
  const repoCoordinates = parseRepoUrl(pluginConfig.repoUrl);
  const useMockData = pluginConfig.useMockData ?? false;
  const octokit = useMockData
    ? undefined
    : createGithubClient({
        token: resolveGithubToken(pluginConfig.githubTokenEnv),
        logger,
      });

  router.get('/metrics', async (_, res, next) => {
    const lookbackDays = pluginConfig.defaultLookbackDays;
    if (useMockData) {
      const metrics = buildMockMetrics({
        repoCoordinates,
        repoUrl: pluginConfig.repoUrl,
        lookbackDays,
      });
      return res.json(metrics);
    }

    try {
      const repo = await fetchRepoMetadata(
        octokit,
        repoCoordinates,
        pluginConfig.repoUrl,
      );
      const now = new Date();
      const currentSince = new Date(now.getTime() - lookbackDays * MS_IN_DAY);
      const previousSince = new Date(
        currentSince.getTime() - lookbackDays * MS_IN_DAY,
      );

      // Fetch all commits (no since/until) and split into previous/current by date
      const allWindow = await fetchCommitsWindow(
        octokit,
        repoCoordinates,
        repo.defaultBranch,
      );

      const allHydrated = await hydrateCommits(
        octokit,
        repoCoordinates,
        allWindow.commits,
      );

      const previousCommits = allHydrated.filter(c => {
        const d = new Date(c.committedAt);
        return d >= previousSince && d < currentSince;
      });

      const currentCommits = allHydrated.filter(c => {
        const d = new Date(c.committedAt);
        return d >= currentSince && d <= now;
      });

      const changesByFile = createChangesByFile(currentCommits);
      const volatility = aggregateVolatility(changesByFile);
      const busFactor = aggregateBusFactor(changesByFile);
      const contributionTrend = aggregateContributionTrend({
        current: currentCommits,
        previous: previousCommits,
        lookbackDays,
      });

      const metrics: RepoInsightsMetrics = {
        generatedAt: new Date().toISOString(),
        repo,
        lookbackDays,
        volatility,
        busFactor,
        contributionTrend,
        partial: allWindow.truncated,
      };
      return res.json(metrics);
    } catch (error) {
      next(error);
      return;
    }
  });

  return router;
}

async function fetchRepoMetadata(
  octokit: ReturnType<typeof createGithubClient>,
  coords: { owner: string; repo: string },
  url: string,
): Promise<RepoRef> {
  const response = await octokit.request('GET /repos/{owner}/{repo}', {
    owner: coords.owner,
    repo: coords.repo,
  });

  return {
    owner: response.data.owner?.login ?? coords.owner,
    name: response.data.name ?? coords.repo,
    defaultBranch: response.data.default_branch ?? 'main',
    url,
  };
}

async function fetchCommitsWindow(
  octokit: ReturnType<typeof createGithubClient>,
  coords: { owner: string; repo: string },
  branch: string,
): Promise<WindowResult> {
  const commits: CommitListItem[] = [];

  const params: Record<string, unknown> = {
    owner: coords.owner,
    repo: coords.repo,
    sha: branch,
    per_page: 100,
  };

  for await (const response of octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/commits',
    params,
  )) {
    for (const item of response.data) {
      if (!item.sha) {
        continue;
      }
      commits.push({
        sha: item.sha,
        committedAt:
          item.commit?.author?.date ??
          item.commit?.committer?.date ??
          new Date().toISOString(),
        author:
          item.author?.login ??
          item.commit?.author?.email ??
          item.commit?.author?.name ??
          'unknown',
      });
    }
  }

  return { commits, truncated: false };
}

async function hydrateCommits(
  octokit: ReturnType<typeof createGithubClient>,
  coords: { owner: string; repo: string },
  commits: CommitListItem[],
): Promise<CommitSummary[]> {
  if (!commits.length) {
    return [];
  }

  const limit = pLimit(DETAIL_CONCURRENCY);
  const hydrated = await Promise.all(
    commits.map(commit =>
      limit(async () => {
        const response = await octokit.request(
          'GET /repos/{owner}/{repo}/commits/{ref}',
          {
            owner: coords.owner,
            repo: coords.repo,
            ref: commit.sha,
          },
        );

        const files =
          response.data.files
            ?.map(
              (file: { filename?: string | null }) =>
                file.filename ?? undefined,
            )
            .filter((name: string | undefined): name is string =>
              Boolean(name),
            ) ?? [];

        return {
          ...commit,
          files,
        } as CommitSummary;
      }),
    ),
  );

  return mockData;
}
