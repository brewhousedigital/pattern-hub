import React from 'react';
import type { TypeViewData } from '@/functions/types/types';
import { useGlobalAuthData } from '@/data/auth-data';
import { useMutationCreateComplaint } from '@/functions/database/complaints';
import { enqueueSnackbar } from 'notistack';

import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';

import { Alert, Box, Button, Collapse, Stack, TextField } from '@mui/material';

export const PatternReportIssue = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [email, setEmail] = React.useState('');

  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (authData && authData?.email) {
      setEmail(authData?.email);
    }
  }, [authData]);

  React.useEffect(() => {
    setIsOpen(false);
    setIsDone(false);
  }, [viewData]);

  const createComplaint = useMutationCreateComplaint();

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (reason.length < 25) {
      enqueueSnackbar('Please make your report more descriptive.', { variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      await createComplaint.mutateAsync({
        pattern_id: viewData?.id || '',
        owner_id: authData?.id || '',
        email: email,
        reason: reason,
      });

      setIsOpen(false);
      setIsDone(true);

      setTimeout(() => {
        setReason('');
      }, 1000);
    } catch (error: any) {
      enqueueSnackbar("Couldn't submit your report right now. Try again in a few minutes.", { variant: 'error' });
    }

    setIsLoading(false);
  };

  return (
    <>
      <Collapse in={!isDone}>
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<ReportProblemOutlinedIcon fontSize="small" />}
            size="small"
            onClick={() => {
              setIsOpen(true);
            }}
            color="warning"
          >
            Report an issue
          </Button>
        </Box>
      </Collapse>

      <Collapse in={isOpen}>
        <Stack onSubmit={handleSubmit} gap={2} component="form">
          <TextField
            variant="filled"
            type="email"
            label="Contact Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            multiline
            variant="filled"
            label="Reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <Box>
            <Button variant="outlined" type="submit" loading={isLoading}>
              Submit
            </Button>
          </Box>
        </Stack>
      </Collapse>

      <Collapse in={isDone}>
        <Alert severity="info">
          Your issue has been logged. <br />
          We will review it as quickly as possible.
        </Alert>
      </Collapse>
    </>
  );
};
