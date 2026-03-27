import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { alpha, styled } from '@mui/material/styles';
import { Box } from '@mui/material';

type MarkdownWrapperProps = {
  children: string;
};

export const MarkdownWrapper = (props: MarkdownWrapperProps) => {
  return (
    <StyledMarkdownWrapper>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{props.children}</ReactMarkdown>
    </StyledMarkdownWrapper>
  );
};

const StyledMarkdownWrapper = styled(Box)(({ theme }) => ({
  color: theme.palette.text.secondary,
  lineHeight: 1.8,
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    color: theme.palette.text.primary,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontWeight: 600,
  },
  '& h1': { fontSize: '1.5rem' },
  '& h2': { fontSize: '1.25rem' },
  '& h3': { fontSize: '1.1rem' },
  '& p': {
    marginTop: 0,
    marginBottom: theme.spacing(1.5),
  },
  '& ul, & ol': {
    paddingLeft: theme.spacing(3),
    marginBottom: theme.spacing(1.5),
  },
  '& li': {
    marginBottom: theme.spacing(0.5),
  },
  '& code': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: '0.875em',
    fontFamily: 'monospace',
  },
  '& pre': {
    backgroundColor: theme.palette.action.hover,
    borderRadius: 8,
    padding: theme.spacing(2),
    overflowX: 'auto',
    '& code': {
      backgroundColor: 'transparent',
      padding: 0,
      color: theme.palette.text.primary,
    },
  },
  '& blockquote': {
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    margin: 0,
    paddingLeft: theme.spacing(2),
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  },
  '& hr': {
    border: 'none',
    borderTop: `1px solid ${theme.palette.divider}`,
    margin: theme.spacing(2, 0),
  },
  '& img': {
    maxWidth: '100%',
    height: 'auto',
    p: 2,
  },
}));
