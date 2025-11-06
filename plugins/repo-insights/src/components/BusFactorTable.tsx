import { Chip } from '@material-ui/core';
import { Table, TableColumn } from '@backstage/core-components';
import { BusFactorEntry } from '../api/types';
import React from 'react';

type BusFactorTableProps = {
  rows: BusFactorEntry[];
};

const columns: TableColumn<
  BusFactorEntry & { riskLabel: string; riskColor: string }
>[] = [
  {
    title: 'File',
    field: 'path',
    highlight: true,
  },
  {
    title: 'Distinct Authors',
    field: 'distinctAuthors',
    type: 'numeric',
    width: '10%',
  },
  {
    title: 'Top Author',
    field: 'topAuthor',
    width: '15%',
  },
  {
    title: 'Top Author Share',
    field: 'topAuthorShare',
    render: row => `${Math.round(row.topAuthorShare * 100)}%`,
    width: '12%',
  },
  {
    title: 'Risk',
    field: 'riskLabel',
    width: '15%',
    render: row => (
      <Chip
        label={row.riskLabel}
        style={{ backgroundColor: row.riskColor, color: '#fff' }}
        size="small"
        role="status"
      />
    ),
  },
];

export const BusFactorTable = ({ rows }: BusFactorTableProps) => {
  const enriched = rows.slice(0, 50).map(row => ({
    ...row,
    ...busFactorRisk(row.topAuthorShare),
  }));

  return (
    <Table
      options={{ paging: false, search: false, padding: 'dense' }}
      data={enriched}
      columns={columns}
      aria-label="Bus factor risk table"
    />
  );
};

function busFactorRisk(share: number) {
  if (share >= 0.75) {
    return { riskLabel: 'High silo risk', riskColor: '#d32f2f' };
  }
  if (share >= 0.5) {
    return { riskLabel: 'Moderate', riskColor: '#fbc02d' };
  }
  return { riskLabel: 'Low', riskColor: '#388e3c' };
}
