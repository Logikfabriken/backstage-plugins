import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';
import { repoInsightsRouteRef } from './routes';

export const repoInsightsPlugin = createPlugin({
  id: 'repo-insights',
  routes: {
    root: repoInsightsRouteRef,
  },
});

export const RepoInsightsPage = repoInsightsPlugin.provide(
  createRoutableExtension({
    name: 'RepoInsightsPage',
    component: () =>
      import('./pages/RepoInsightsPage').then(m => m.RepoInsightsPage),
    mountPoint: repoInsightsRouteRef,
  }),
);
