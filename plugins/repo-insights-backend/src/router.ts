import { Router } from 'express';
import { Config } from '@backstage/config';
import { InputError } from '@backstage/errors';
import { loggerToWinstonLogger } from '@backstage/backend-common';
import { LoggerService } from '@backstage/backend-plugin-api';
import pLimit from 'p-limit';
import {
  aggregateBusFactor,
  aggregateContributionTrend,
  aggregateVolatility,
  createChangesByFile,
} from './aggregate';
import { TTLCache } from './cache';
import { parseRepoUrl, readRepoInsightsConfig } from './config';
import { createGithubClient, resolveGithubToken } from './githubClient';
import { CommitSummary, RepoInsightsMetrics, RepoRef } from './types';

const metricsCache = new TTLCache<RepoInsightsMetrics>(15 * 60 * 1000);
const MAX_COMMITS_PER_WINDOW = 2500;
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
  const repoKey = `${repoCoordinates.owner}/${repoCoordinates.repo}`;
  const githubToken = resolveGithubToken(pluginConfig.githubTokenEnv);
  const octokit = createGithubClient({ token: githubToken, logger });
  const winstonLogger = loggerToWinstonLogger(logger);

  router.get('/metrics', async (req, res, next) => {
    const lookbackDaysParam = req.query.lookbackDays as string | undefined;

    let lookbackDays: number;
    try {
      lookbackDays = parseLookbackDays(
        lookbackDaysParam,
        pluginConfig.defaultLookbackDays,
      );
    } catch (error) {
      const message =
        error instanceof InputError ? error.message : 'Invalid lookbackDays';
      res.status(400).json({ error: message });
      return;
    }

    const cacheKey = `${repoKey}:${lookbackDays}`;
    const cached = metricsCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
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

      const [previousWindow, currentWindow] = await Promise.all([
        fetchCommitsWindow(octokit, repoCoordinates, repo.defaultBranch, {
          since: previousSince.toISOString(),
          until: currentSince.toISOString(),
        }),
        fetchCommitsWindow(octokit, repoCoordinates, repo.defaultBranch, {
          since: currentSince.toISOString(),
          until: now.toISOString(),
        }),
      ]);

      const [previousCommits, currentCommits] = await Promise.all([
        hydrateCommits(octokit, repoCoordinates, previousWindow.commits),
        hydrateCommits(octokit, repoCoordinates, currentWindow.commits),
      ]);

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
        partial: previousWindow.truncated || currentWindow.truncated,
      };

      metricsCache.set(cacheKey, metrics);
      winstonLogger.info('repo-insights metrics generated', {
        repo: repoKey,
        lookbackDays,
        volatilityCount: volatility.length,
        busFactorCount: busFactor.length,
        currentCommits: currentCommits.length,
        previousCommits: previousCommits.length,
      });

      return res.json(metrics);
    } catch (error) {
      if (isRateLimitError(error)) {
        const cachedFallback = metricsCache.get(cacheKey);
        if (cachedFallback) {
          return res.json({ ...cachedFallback, partial: true });
        }
        res.status(429).json({
          error: 'GitHub API rate limit exceeded',
          message:
            'GitHub is rate-limiting requests and no cached metrics are available. Please retry later.',
        });
        return;
      }

      if (error instanceof InputError) {
        res.status(400).json({ error: error.message });
        return;
      }

      winstonLogger.error('repo-insights metrics failed', {
        repo: repoKey,
        lookbackDays,
        error,
      });
      next(error);
      return;
    }
  });

  return router;
}

function parseLookbackDays(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InputError('lookbackDays must be a positive integer');
  }

  return Math.min(Math.floor(parsed), 365);
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
  window: { since: string; until: string },
): Promise<WindowResult> {
  const commits: CommitListItem[] = [];
  let truncated = false;

  for await (const response of octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/commits',
    {
      owner: coords.owner,
      repo: coords.repo,
      sha: branch,
      since: window.since,
      until: window.until,
      per_page: 100,
    },
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

      if (commits.length >= MAX_COMMITS_PER_WINDOW) {
        truncated = true;
        break;
      }
    }

    if (truncated) {
      break;
    }
  }

  return { commits, truncated };
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

  return hydrated;
}

function isRateLimitError(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error &&
    'status' in error &&
    (error as { status?: number }).status === 403
  ) {
    const message =
      (error as { message?: string }).message?.toLowerCase() ?? '';
    const headers = (
      error as { response?: { headers?: Record<string, string> } }
    ).response?.headers;
    if (headers?.['x-ratelimit-remaining'] === '0') {
      return true;
    }
    if (message.includes('rate limit') || message.includes('api rate limit')) {
      return true;
    }
  }

  if (
    typeof error === 'object' &&
    error &&
    'status' in error &&
    (error as { status?: number }).status === 429
  ) {
    return true;
  }

  return false;
}
