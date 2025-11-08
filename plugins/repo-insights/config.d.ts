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
  };
}
