import { Grid, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ContributionTrend as ContributionTrendType } from '../api/types';
import React from 'react';

type ContributionTrendProps = {
  trend: ContributionTrendType;
};

export const ContributionTrend = ({ trend }: ContributionTrendProps) => {
  const months = trend.global.series.map(point => point.month);
  const currentMonth = months.at(-1);
  const previousMonth = months.at(-2);

  const directoryBars = trend.perDirectory
    .map(entry => ({
      dir: entry.dir,
      current: currentMonth
        ? entry.series.find(point => point.month === currentMonth)?.commits ?? 0
        : 0,
      previous: previousMonth
        ? entry.series.find(point => point.month === previousMonth)?.commits ??
          0
        : 0,
    }))
    .filter(item => item.current > 0 || item.previous > 0)
    .sort((a, b) => b.current - a.current)
    .slice(0, 8);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard
          title="Global contribution trend"
          subheader="Commits per month"
        >
          {trend.global.series.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={trend.global.series}
                aria-label="Global contribution trend"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="commits"
                  stroke="#1976d2"
                  strokeWidth={2}
                  dot={false}
                  name="Commits"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2">
              No commits available for this window.
            </Typography>
          )}
        </InfoCard>
      </Grid>
      <Grid item xs={12}>
        <InfoCard
          title="Per-directory comparison"
          subheader={
            currentMonth && previousMonth
              ? `${currentMonth} vs ${previousMonth}`
              : 'Latest two months'
          }
        >
          {directoryBars.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={directoryBars}
                barCategoryGap="20%"
                aria-label="Per-directory commit comparison"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dir" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="current"
                  fill="#1976d2"
                  name={currentMonth ? `Current (${currentMonth})` : 'Current'}
                />
                <Bar
                  dataKey="previous"
                  fill="#90caf9"
                  name={
                    previousMonth ? `Previous (${previousMonth})` : 'Previous'
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2">
              Waiting for per-directory activity in the latest months.
            </Typography>
          )}
        </InfoCard>
      </Grid>
    </Grid>
  );
};
