import { Button, ButtonGroup, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import React from 'react';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
}));

type LookbackControlsProps = {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
};

export const LookbackControls = ({
  value,
  onChange,
  options = [30, 60, 90, 180],
}: LookbackControlsProps) => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <Typography component="span" variant="body1">
        Lookback window
      </Typography>
      <ButtonGroup
        variant="outlined"
        color="primary"
        aria-label="Select lookback window in days"
      >
        {options.map(option => (
          <Button
            key={option}
            onClick={() => onChange(option)}
            variant={value === option ? 'contained' : 'outlined'}
            aria-pressed={value === option}
          >
            {option}d
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
};
