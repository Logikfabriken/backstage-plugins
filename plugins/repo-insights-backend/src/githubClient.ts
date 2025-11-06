import { LoggerService } from '@backstage/backend-plugin-api';
import { Octokit } from 'octokit';

export type GithubClient = Octokit;

export function resolveGithubToken(envName: string): string | undefined {
  const token = process.env[envName];
  if (!token) {
    return undefined;
  }
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function createGithubClient(options: {
  token?: string;
  logger: LoggerService;
}): GithubClient {
  const { token, logger } = options;
  if (!token) {
    logger.info(
      'repo-insights-backend: proceeding without GitHub token; rate limits may be lower',
    );
  }

  return new Octokit({
    auth: token,
    userAgent: 'backstage-repo-insights-plugin',
  });
}
