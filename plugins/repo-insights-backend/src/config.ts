import { Config } from '@backstage/config';
import { InputError } from '@backstage/errors';
import { z } from 'zod';

export interface RepoCoordinates {
  owner: string;
  repo: string;
}

const schema = z.object({
  repoUrl: z.string().url(),
  defaultLookbackDays: z.number().int().positive().max(365).default(90),
  githubTokenEnv: z.string().min(1).default('GITHUB_TOKEN'),
  useMockData: z.boolean().default(false),
});

export type RepoInsightsConfig = z.infer<typeof schema>;

export function readRepoInsightsConfig(config: Config): RepoInsightsConfig {
  const raw = {
    repoUrl: config.getOptionalString('repoInsights.repoUrl'),
    defaultLookbackDays: config.getOptionalNumber('repoInsights.defaultLookbackDays'),
    githubTokenEnv: config.getOptionalString('repoInsights.githubTokenEnv'),
    useMockData: config.getOptionalBoolean('repoInsights.useMockData'),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map(issue => `${issue.path.join('.') || 'repoInsights'}: ${issue.message}`)
      .join('; ');
    throw new InputError(`Invalid repoInsights config: ${message}`);
  }

  return parsed.data;
}

export function parseRepoUrl(repoUrl: string): RepoCoordinates {
  let parsed: URL;
  try {
    parsed = new URL(repoUrl);
  } catch {
    throw new InputError(`repoInsights.repoUrl must be a valid URL, got "${repoUrl}"`);
  }

  if (parsed.hostname !== 'github.com') {
    throw new InputError(
      `repoInsights.repoUrl must point to github.com, got "${parsed.hostname}"`,
    );
  }

  const [owner, repo] = parsed.pathname.replace(/^\/+/, '').replace(/\.git$/, '').split('/');

  if (!owner || !repo) {
    throw new InputError(
      `repoInsights.repoUrl must include both owner and repo segments, got "${parsed.pathname}"`,
    );
  }

  return { owner, repo };
}
