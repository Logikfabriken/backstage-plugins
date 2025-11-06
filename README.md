# [Backstage](https://backstage.io)

This repo now includes a production-ready **Repo Insights** plugin that surfaces
repository activity metrics (volatility, bus factor, and contribution trends)
for any public GitHub project configured in `app-config.yaml`.

## Getting started

```sh
yarn install
yarn start
```

Once both the frontend (`localhost:3000`) and backend (`localhost:7007`) are
running you will see a **Repo Insights** entry in the sidebar that links to
`/repo-insights`.

## Configuring Repo Insights

Add the following block to your configuration (already present in
`app-config.yaml` and `app-config.local.yaml`):

```yaml
repoInsights:
  repoUrl: https://github.com/backstage/backstage   # required
  defaultLookbackDays: 90                           # optional, default 90
  githubTokenEnv: GITHUB_TOKEN                      # optional, default GITHUB_TOKEN
```

- `repoUrl` must point to a public GitHub repository in the form
  `https://github.com/owner/name`.
- `defaultLookbackDays` controls the initial window the UI uses (30/60/90/180
  selectors are provided, but the backend accepts any value up to 365).
- `githubTokenEnv` lets you point at an environment variable containing a
  Personal Access Token to increase GitHub rate limits. The plugin also works
  without a token (with lower limits).

## Backend behavior

- Fetches commit metadata and file-level changes via Octokit with up to 10
  concurrent detail requests and an upper bound of 2,500 commits per window.
- Caches each `(repo, lookback)` response in-memory for 15 minutes (configurable
  via code) to keep response times under ~5 seconds once warmed.
- Returns a `partial: true` flag when GitHub throttles the plugin before
  reaching the commit cap; the frontend shows a warning banner in that case.
- Emits structured logs through `@backstage/backend-common` so you can trace
  cache hits/misses and API failures.

## Frontend behavior

- Global page under `/repo-insights` with a lookback selector, refresh button,
  partial data banner, empty-state guidance, and accessible tables/charts.
- Volatility and bus factor tables are sortable and link directly to the GitHub
  file on the default branch.
- Contribution trends include a monthly global line chart plus a per-directory
  bar chart comparing the most recent month to the previous month, powered by
  Recharts.

## Limitations

- Only supports repositories hosted on `github.com`.
- Very large repositories may still hit the 2,500 commit cap per window; the
  `partial` flag communicates when truncation happens.
- Data is cached in-memory inside the backend process. If you run multiple
  backend replicas they maintain independent caches.
