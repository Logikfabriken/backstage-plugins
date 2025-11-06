import { Table, TableColumn } from '@backstage/core-components';
import { VolatilityEntry } from '../api/types';
import React from 'react';

type VolatilityTableProps = {
  rows: VolatilityEntry[];
  repoUrl: string;
  defaultBranch: string;
};

const columns: TableColumn<VolatilityEntry & { githubUrl: string }>[] = [
  {
    title: 'File',
    field: 'path',
    highlight: true,
    render: row => (
      <a
        href={row.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${row.path} on GitHub`}
      >
        {row.path}
      </a>
    ),
  },
  {
    title: 'Commits',
    field: 'commitCount',
    type: 'numeric',
    defaultSort: 'desc',
    width: '10%',
  },
  {
    title: 'Last Commit',
    field: 'lastCommitAt',
    render: row => new Date(row.lastCommitAt).toLocaleString(),
  },
];

export const VolatilityTable = ({
  rows,
  repoUrl,
  defaultBranch,
}: VolatilityTableProps) => {
  const enriched = rows.slice(0, 50).map(row => ({
    ...row,
    githubUrl: buildFileUrl(repoUrl, defaultBranch, row.path),
  }));

  return (
    <Table
      options={{ paging: false, search: false, padding: 'dense' }}
      data={enriched}
      columns={columns}
      aria-label="Volatility metrics"
    />
  );
};

function buildFileUrl(repoUrl: string, branch: string, path: string) {
  return `${repoUrl.replace(/\/$/, '')}/blob/${branch}/${path}`;
}
