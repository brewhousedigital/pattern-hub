import React, { useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { Box, Chip, InputBase, IconButton, Paper, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import LabelIcon from '@mui/icons-material/Label';
import { type Token } from '@/functions/utilities/search-v2';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';

type TypColorEnum = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const TOKEN_STYLES: Record<Token['type'], { color: TypColorEnum; icon: React.ReactElement }> = {
  text: { color: 'default', icon: <SearchIcon fontSize="small" /> },
  tag: { color: 'success', icon: <LabelIcon fontSize="small" /> },
  author: { color: 'info', icon: <PersonIcon fontSize="small" /> },
  id: { color: 'info', icon: <PersonIcon fontSize="small" /> },
  title: { color: 'secondary', icon: <PersonIcon fontSize="small" /> },
  description: { color: 'secondary', icon: <PersonIcon fontSize="small" /> },
};

function getTokenStyle(token: Token) {
  // Excluded tokens always render as error/red regardless of type
  if (token.exclude) return { color: 'error' as const, icon: TOKEN_STYLES[token.type].icon };
  return TOKEN_STYLES[token.type];
}

function getTokenLabel(token: Token): string {
  if (token.type === 'author') return `author:${token.value}`;
  if (token.type === 'id') return `id:${token.value}`;
  if (token.type === 'title') return `title:${token.value}`;
  if (token.type === 'description') return `description:${token.value}`;
  if (token.exclude) return `-${token.value}`;
  return token.value;
}

type TokenizedSearchBarProps = {
  /** Optional placeholder override */
  placeholder?: string;
  /** Optional sx passthrough for the outer Paper */
  sx?: object;
};

export const HomepageSearchV2 = ({
  placeholder = 'Search by tags like "animal", and "dog" and press enter, or try clicking on a tag in the sidebar',
  sx,
}: TokenizedSearchBarProps) => {
  const { tokens, addRawInput, removeToken, removeLastToken, clearTokens } = usePatternSearch();

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitInput = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    addRawInput(trimmed);
    setInputValue('');
  }, [inputValue, addRawInput]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Enter':
        case ',': {
          // Commit on Enter or comma
          e.preventDefault();
          commitInput();
          break;
        }

        /*case ' ': {
          // Commit on space UNLESS the input starts with "author:" since
          const trimmed = inputValue.trim();
          if (!trimmed) break;
          // Don't commit mid-prefix — let the user finish typing "author:"
          if (/^-?author:$/i.test(trimmed)) break;
          e.preventDefault();
          commitInput();
          break;
        }*/

        case 'Backspace': {
          // Only remove last token if the input field is already empty
          if (inputValue === '') {
            e.preventDefault();
            removeLastToken();
          }
          break;
        }

        case 'Escape': {
          setInputValue('');
          inputRef.current?.blur();
          break;
        }
      }
    },
    [inputValue, commitInput, removeLastToken],
  );

  const handleBarClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const hasContent = tokens.length > 0 || inputValue.length > 0;

  return (
    <Paper
      elevation={0}
      variant="outlined"
      onClick={handleBarClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        px: 1.5,
        py: 0.75,
        cursor: 'text',
        borderRadius: 2,
        // Highlight border on focus-within so it feels like one input
        '&:focus-within': {
          borderColor: 'primary.main',
        },
        ...sx,
      }}
    >
      {/* Leading search icon */}
      <SearchIcon fontSize="small" sx={{ color: 'text.disabled', mr: 0.5, flexShrink: 0 }} />

      {/* Token chips */}
      {tokens.map((token, index) => {
        const { color, icon } = getTokenStyle(token);
        return (
          <Tooltip
            key={index}
            title={
              token.exclude
                ? `Excluding "${token.value}"`
                : token.type === 'author'
                  ? `Filtering by author "${token.value}"`
                  : token.type === 'tag'
                    ? `Filtering by tag "${token.value}"`
                    : `Searching for "${token.value}"`
            }
            arrow
          >
            <Chip
              size="small"
              label={getTokenLabel(token)}
              color={color}
              //icon={icon}
              onDelete={() => removeToken(index)}
              // Prevent the chip delete click from bubbling to the bar
              onClick={(e) => e.stopPropagation()}
              sx={{ maxWidth: 200 }}
            />
          </Tooltip>
        );
      })}

      {/* Text input */}
      <InputBase
        inputRef={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        // Commit on blur so clicking away finalizes a half-typed token
        onBlur={commitInput}
        placeholder={tokens.length === 0 ? placeholder : ''}
        inputProps={{ 'aria-label': 'Search patterns' }}
        sx={{
          minHeight: 30,
          flex: 1,
          minWidth: 120,
          fontSize: '0.875rem',
          // Prevent the input from shrinking below its min on small screens
          '& input': { p: 0, fontSize: '0.875rem' },
        }}
      />

      {/* Clear all button — only visible when there is content */}
      {hasContent && (
        <Tooltip title="Clear search" arrow>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              clearTokens();
              setInputValue('');
              inputRef.current?.focus();
            }}
            sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }}
            aria-label="Clear search"
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Paper>
  );
};
