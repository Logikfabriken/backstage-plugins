import { useEffect, useState, useCallback } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { RepoInsightsMetricsResponse } from '../api/types';

export function useRepoInsightsMetrics(lookbackDays: number) {
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const [data, setData] = useState<RepoInsightsMetricsResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refresh = useCallback(() => {
    setRefreshIndex(prev => prev + 1);
  }, []);

  useEffect(() => {
    const fetchMetaData = async () => {
      let aborted = false;
      const controller = new AbortController();
      setLoading(true);
      setError(undefined);
      const baseUrl = await discoveryApi.getBaseUrl('repo-insights');
      fetchApi
        .fetch(`${baseUrl}/metrics?lookbackDays=${lookbackDays}`, {
          signal: controller.signal,
        })
        .then(async response => {
          if (!response.ok) {
            throw await ResponseError.fromResponse(response);
          }
          const payload =
            (await response.json()) as RepoInsightsMetricsResponse;
          if (!aborted) {
            setData(payload);
          }
        })
        .catch(err => {
          if (!aborted) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .finally(() => {
          if (!aborted) {
            setLoading(false);
          }
        });

      return () => {
        aborted = true;
        controller.abort();
      };
    };
    fetchMetaData();
  }, [fetchApi, lookbackDays, refreshIndex]);

  return { data, loading, error, refresh };
}
