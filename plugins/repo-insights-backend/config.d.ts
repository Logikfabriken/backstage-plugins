export interface Config {
  repoInsights: {
    repoUrl: string;
    defaultLookbackDays?: number;
    githubTokenEnv?: string;
    useMockData?: boolean;
  };
}
