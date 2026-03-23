import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import { useMutationResendVerificationCode } from '@/functions/database/authentication';

import { Alert, Box, Button } from '@mui/material';
import { enqueueSnackbar } from 'notistack';

export const AccountVerificationBox = () => {
  const { authData } = useGlobalAuthData();

  if (authData?.id && !authData?.verified) {
    return (
      <Box sx={{ p: 2, position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 100 }}>
        <Alert
          severity="warning"
          variant="filled"
          sx={{ justifyContent: 'center', '& .MuiAlert-action': { padding: '0 0 0 16px', marginLeft: 0 } }}
          action={<CountdownTimer />}
        >
          Please verify your account by checking your email and clicking the link we sent
        </Alert>
      </Box>
    );
  }

  return <></>;
};

const CountdownTimer = () => {
  const { authData } = useGlobalAuthData();

  const resendCode = useMutationResendVerificationCode();

  const [timeLeft, setTimeLeft] = React.useState(0);
  const countdown = React.useRef<NodeJS.Timeout | null>(null);

  const handleClick = async () => {
    // Prevent multiple intervals
    if (countdown.current) return;

    try {
      await resendCode.mutateAsync(authData?.email || '');

      setTimeLeft(60);

      countdown.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (countdown.current) {
              clearInterval(countdown.current);
            }
            countdown.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      enqueueSnackbar('Something went wrong trying to resend your code. Try again in a few minutes.', {
        variant: 'error',
      });
    }
  };

  return (
    <Button disabled={timeLeft > 0} variant="contained" disableElevation onClick={handleClick}>
      {timeLeft > 0 ? `Time Left: ${timeLeft}s` : 'Resend Code'}
    </Button>
  );
};
