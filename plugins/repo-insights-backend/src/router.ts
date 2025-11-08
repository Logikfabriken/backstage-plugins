import { Router } from 'express';
import pLimit from 'p-limit';
import {
  aggregateBusFactor,
  aggregateVolatility,
  createChangesByFile,
} from './aggregate';
import { parseRepoUrl, readRepoInsightsConfig } from './config';
import { createGithubClient, resolveGithubToken } from './githubClient';
import { mockData } from './mockData';
import {
  CommitListItem,
  CommitSummary,
  RepoInsightsMetrics,
  RepoRef,
  RouterDeps,
  WindowResult,
} from './types';

const DETAIL_CONCURRENCY = 10;

export async function createRouter({ logger, config }: RouterDeps) {
  const router = Router();
  const pluginConfig = readRepoInsightsConfig(config);
  const repoCoordinates = parseRepoUrl(pluginConfig.repoUrl);
  const octokit = createGithubClient({
    token: resolveGithubToken(pluginConfig.githubTokenEnv),
    logger,
  });

  router.get('/metrics', async (_, res, next) => {
    try {
      const useMockData = config.getBoolean('repoInsights.useMockData');
      const repo: RepoRef = {
        owner: repoCoordinates.owner,
        name: repoCoordinates.repo,
        defaultBranch: 'main',
        url: pluginConfig.repoUrl,
      };
      const allHydrated = useMockData
        ? mockData
        : await hydrateCommits(
            octokit,
            repoCoordinates,
            (
              await fetchCommitsWindow(
                octokit,
                repoCoordinates,
                repo.defaultBranch,
              )
            ).commits,
          );

      const changesByFile = createChangesByFile(allHydrated);
      const volatility = aggregateVolatility(changesByFile);
      const busFactor = aggregateBusFactor(changesByFile);

      const metrics: RepoInsightsMetrics = {
        generatedAt: new Date().toISOString(),
        repo,
        volatility,
        busFactor,
      };
      return res.json(metrics);
    } catch (error) {
      next(error);
      return;
    }
  });

  return router;
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

  return hydrated;
}
