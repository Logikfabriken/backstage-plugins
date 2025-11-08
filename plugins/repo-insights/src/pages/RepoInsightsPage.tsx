import { useMemo } from 'react';
import { Grid, Typography, makeStyles } from '@material-ui/core';
import {
  Content,
  ContentHeader,
  EmptyState,
  Header,
  HeaderLabel,
  InfoCard,
  Page,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { ContributionTrend } from '../components/ContributionTrend';
import { VolatilityTable } from '../components/VolatilityTable';
import { BusFactorTable } from '../components/BusFactorTable';
import { useRepoInsightsMetrics } from '../hooks/useRepoInsightsMetrics';
import React from 'react';

const useStyles = makeStyles(theme => ({
  section: {
    marginBottom: theme.spacing(3),
  },
}));

export const RepoInsightsPage = () => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const repoUrl = config.getOptionalString('repoInsights.repoUrl');
  const { data, loading, error } = useRepoInsightsMetrics();

  const hasData = useMemo(() => {
    if (!data) {
      return false;
    }
    const trendHasCommits = data.contributionTrend.global.series.some(
      point => point.commits > 0,
    );
    return (
      data.volatility.length > 0 || data.busFactor.length > 0 || trendHasCommits
    );
  }, [data]);

  if (!repoUrl) {
    return (
      <Page themeId="tool">
        <Content>
          <EmptyState
            title="Configure repoInsights.repoUrl"
            description="Add a repoInsights block to app-config.yaml pointing at a public GitHub repository to enable this page."
            missing="content"
          />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="Repo Insights" subtitle={repoUrl}>
        {data?.repo?.defaultBranch && (
          <HeaderLabel label="Default branch" value={data.repo.defaultBranch} />
        )}
        {data?.generatedAt && (
          <HeaderLabel
            label="Generated"
            value={new Date(data.generatedAt).toLocaleString()}
          />
        )}
      </Header>
      <Content>
        <ContentHeader title="Repository health"></ContentHeader>
        {loading && !data && <Progress />}
        {error && <ResponseErrorPanel error={error} />}
        {!loading && !error && data && !hasData && (
          <EmptyState
            title="No activity in this window"
            description="Try a longer lookback window or verify that the configured repository has recent commits."
            missing="content"
          />
        )}
        {!error && data && hasData && (
          <Grid container spacing={3}>
            <Grid item xs={12} className={classes.section}>
              <InfoCard title="Volatility" subheader="Commits per file">
                <VolatilityTable
                  rows={data.volatility}
                  repoUrl={data.repo.url}
                  defaultBranch={data.repo.defaultBranch}
                />
              </InfoCard>
            </Grid>
            <Grid item xs={12} className={classes.section}>
              <InfoCard
                title="Bus factor"
                subheader="Distinct authors per file"
              >
                <BusFactorTable rows={data.busFactor} />
              </InfoCard>
            </Grid>
            <Grid item xs={12} className={classes.section}>
              <ContributionTrend trend={data.contributionTrend} />
            </Grid>
          </Grid>
        )}
        {!loading && !error && !data && (
          <Typography variant="body1">
            Metrics will appear after the first successful backend run.
          </Typography>
        )}
      </Content>
    </Page>
  );
};
