import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import { DOMAIN_URL } from '@/data/constants';
import { PatternFavoriteButton } from '@/components/PatternUtilities/PatternFavoriteButton';
import { PatternCompletedButton } from './PatternCompletedButton';
import { PatternAddToCollectionButton } from '@/components/PatternUtilities/PatternAddToCollectionButton';
import { copyToURLClipboard } from '@/functions/utilities/copy-to-clipboard';
import type { TypeViewData } from '@/functions/types/types';

import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

import { IconButton, Stack, Tooltip } from '@mui/material';

export const PatternSaveContainer = (props: TypeViewData) => {
  const viewData = props.viewData;

  const { authData } = useGlobalAuthData();

  const patternId = viewData?.id;
  const patternUrl = patternId ? `${DOMAIN_URL}/pattern/${patternId}` : '';

  const handleCopyLink = async () => {
    if (!patternUrl) return;
    await copyToURLClipboard(patternUrl);
  };

  const handleOpenNewTab = () => {
    if (!patternUrl) return;
    window.open(patternUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Stack direction="row" sx={{ gap: 1 }}>
      <Tooltip title="Copy pattern link" arrow>
        <IconButton onClick={handleCopyLink} disabled={!patternUrl}>
          <LinkRoundedIcon color="primary" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Open in new tab" arrow>
        <IconButton onClick={handleOpenNewTab} disabled={!patternUrl}>
          <OpenInNewRoundedIcon color="primary" />
        </IconButton>
      </Tooltip>

      {authData && (
        <>
          <PatternFavoriteButton viewData={viewData} />

          <PatternCompletedButton viewData={viewData} />

          <PatternAddToCollectionButton viewData={viewData} />
        </>
      )}
    </Stack>
  );
};
