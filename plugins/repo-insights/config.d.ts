export interface Config {
  /**
   * Configuration for the Repo Insights frontend plugin.
   */
  repoInsights?: {
    /**
     * Repository URL that the plugin should visualize.
     * @visibility frontend
     */
    repoUrl?: string;
    /**
     * Default lookback window (in days) for metrics.
     * @visibility frontend
     */
    defaultLookbackDays?: number;
  };
}

