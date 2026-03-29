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
  '& h4': { fontSize: '1rem' },
  '& h5': { fontSize: '0.95rem' },
  '& h6': { fontSize: '0.9rem', color: theme.palette.text.secondary },

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
  // Nested lists
  '& li > ul, & li > ol': {
    marginTop: theme.spacing(0.5),
    marginBottom: 0,
  },
  // Task lists (remark-gfm checkboxes)
  '& input[type="checkbox"]': {
    marginRight: theme.spacing(0.75),
    accentColor: theme.palette.primary.main,
    verticalAlign: 'middle',
    cursor: 'default',
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
    marginBottom: theme.spacing(1.5),
    '& code': {
      backgroundColor: 'transparent',
      padding: 0,
      color: theme.palette.text.primary,
      fontSize: '0.875rem',
    },
  },

  '& blockquote': {
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    margin: theme.spacing(0, 0, 1.5, 0),
    paddingLeft: theme.spacing(2),
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    // Nested blockquotes
    '& blockquote': {
      marginTop: theme.spacing(1),
      borderLeftColor: alpha(theme.palette.primary.main, 0.4),
    },
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
    borderRadius: 8,
    display: 'block',
    margin: theme.spacing(1.5, 0),
  },

  // Tables (GFM)
  '& table': {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: theme.spacing(2),
    fontSize: '0.9rem',
    display: 'block',
    overflowX: 'auto',
  },
  '& thead': {
    backgroundColor: theme.palette.action.hover,
  },
  '& th': {
    padding: theme.spacing(1, 1.5),
    textAlign: 'left',
    fontWeight: 600,
    color: theme.palette.text.primary,
    borderBottom: `2px solid ${theme.palette.divider}`,
    whiteSpace: 'nowrap',
  },
  '& td': {
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    verticalAlign: 'top',
  },
  '& tbody tr:last-child td': {
    borderBottom: 'none',
  },
  '& tbody tr:hover td': {
    backgroundColor: theme.palette.action.hover,
  },

  // Strikethrough (GFM)
  '& del': {
    color: theme.palette.text.disabled,
    textDecoration: 'line-through',
  },

  // Definition lists (if you add remark-definition-list later)
  '& dl': { marginBottom: theme.spacing(1.5) },
  '& dt': { fontWeight: 600, color: theme.palette.text.primary },
  '& dd': { marginLeft: theme.spacing(2), marginBottom: theme.spacing(0.5) },

  // Keyboard / abbr
  '& kbd': {
    display: 'inline-block',
    padding: '1px 6px',
    fontSize: '0.8em',
    fontFamily: 'monospace',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
    verticalAlign: 'middle',
  },
  '& abbr[title]': {
    textDecoration: 'underline dotted',
    cursor: 'help',
  },

  // Prevent margin bleed on first/last children
  '& > *:first-of-type': { marginTop: 0 },
  '& > *:last-child': { marginBottom: 0 },
}));
