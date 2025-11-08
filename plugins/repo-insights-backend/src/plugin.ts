import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';

export const repoInsightsBackendPlugin = createBackendPlugin({
  pluginId: 'repo-insights',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        httpRouter.use(await createRouter({ logger, config }));
      },
    });
  },
});

export default repoInsightsBackendPlugin;
