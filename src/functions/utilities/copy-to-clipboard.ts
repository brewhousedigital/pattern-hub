import { enqueueSnackbar } from 'notistack';

export const copyToURLClipboard = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url);
    enqueueSnackbar(`Copied '${url}' to your clipboard!`, { variant: 'success' });
  } catch (err) {
    console.error('Failed to copy: ', err);
    enqueueSnackbar(`Couldn't copy the link for some reason. Maybe try refreshing or checking your device settings?`, {
      variant: 'error',
    });
  }
};

export const copyToClipboard = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    enqueueSnackbar(`Copied to your clipboard!`, { variant: 'success' });
  } catch (err) {
    console.error('Failed to copy: ', err);
    enqueueSnackbar(`Couldn't copy this for some reason. Maybe try refreshing or checking your device settings?`, {
      variant: 'error',
    });
  }
};
