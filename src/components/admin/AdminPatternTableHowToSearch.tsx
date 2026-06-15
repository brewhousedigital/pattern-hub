import React from 'react';
import { BorderedCard } from '@/components/cards/BorderedCard';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { atom, useAtom } from 'jotai';

import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import QuestionMarkRoundedIcon from '@mui/icons-material/QuestionMarkRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { Box, Accordion, AccordionDetails, AccordionSummary, Typography, Button } from '@mui/material';

export const AdminPatternTableHowToSearch = () => {
  const { isOpen } = useIsOpenAdminPatternTableHowToSearch();

  if (!isOpen) return <></>;

  return (
    <Box sx={{ maxHeight: 'calc(100svh - 150px)', flex: 1, minWidth: 500, overflowY: 'auto' }}>
      <BorderedCard>
        <Box sx={{ mb: 4 }}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>Explanations & Examples</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <MarkdownWrapper>
                {`
Type a filter expression into the search bar to narrow the patterns list.

**Exact match** \`name = 'Toucan'\` string values must be wrapped in single quotes.

**Partial match** \`name ~ 'moon'\` returns anything containing "moon" (case-insensitive), e.g. "Moonrise", "Half Moon".

**Negation** \`name !~ 'clock'\` excludes any pattern whose name contains "clock". Watch out for partial matches: searching \`!~ 'lock'\` would also exclude "Clockwork".

**Numbers** no quotes needed. \`pieces > 100\` or \`size_width_in >= 8\`.

**Booleans**  use \`true\` or \`false\` without quotes. \`is_draft = true\` shows only draft patterns. \`has_layers = true\` shows only patterns with layer data.

**Dates** wrap in single quotes. \`created > '2024-01-01'\`.

**Arrays** use \`?~\` to search inside tags, author_manual, or pattern_key_reference_list. \`tags ?~ 'bird'\` returns any pattern that has "bird" as one of its tags.

**Combining** use \`&&\` (AND) and \`||\` (OR), and parentheses to group:
\`(name ~ 'Clock' || name ~ 'Sun') && has_layers = true\`
                `}
              </MarkdownWrapper>
            </AccordionDetails>
          </Accordion>
        </Box>

        <MarkdownWrapper>
          {`
# Filter expressions

\`\`\`
name ~ 'moon' && created > '2024-01-01'
\`\`\`

---

## String fields
Wrap values in single quotes. Use \`=\` for exact match, \`~\` for partial match.

\`\`\`
id,
name,
description,
instructions,
source_url,
design_width_unit,
design_height_unit,
line_width_unit
\`\`\`

\`\`\`
name = 'Toucan'
name ~ 'moon'
name !~ 'clock'
description ~ 'beginner'
source_url ~ 'etsy'
design_width_unit = 'in'
\`\`\`

---

## Number fields
No quotes needed.

\`\`\`
pieces,
design_width,
design_height,
line_width,
pattern_file_size,
size_width_in,
size_width_cm,
size_width_mm,
size_height_in,
size_height_cm,
size_height_mm,
avg_rating,
total_ratings,
avg_difficulty,
total_difficulty_ratings,
favorite_count,
tag_count
\`\`\`

\`\`\`
pieces > 100
pieces >= 50 && pieces <= 200
design_width > 10
size_width_in >= 8 && size_width_in <= 12
size_height_cm > 20
pattern_file_size > 500000
avg_rating > 4
total_ratings >= 10
favorite_count > 0
tag_count >= 5
\`\`\`

---

## Date fields
Wrap values in single quotes.

\`\`\`
design_date,
created,
updated
\`\`\`

\`\`\`
design_date > '2020-01-01'
created > '2024-06-01'
updated > '2025-01-01'
created > '2024-01-01' && created < '2025-01-01'
\`\`\`

---

## Boolean fields

\`\`\`
is_draft,
has_layers,
isDeleted
\`\`\`

\`\`\`
is_draft = true
is_draft = false
has_layers = true
isDeleted = true
\`\`\`

---

## Array / relation fields
These require the \`?~\` (any/at-least-one contains) operator to search inside the array.

\`\`\`
tags ?~ 'bird'
tags ?~ '2026'
author_manual ?~ 'cline glass co.'
pattern_key_reference_list ?~ 'Wire Overlay'
pattern_key_reference_list ?~ 'dashed_line_8thab5zref.svg'
\`\`\`

Authors with linked accounts:
\`\`\`
authors.name = 'Claycorp'
authors.name ~ 'clay'
\`\`\`

---

## Combining conditions

\`\`\`
name ~ 'moon' && created > '2024-01-01'
(name ~ 'Clock' || name ~ 'Sun') && pieces > 50
tags ?~ 'animal' && has_layers = true
is_draft = true && created > '2025-01-01'
avg_rating > 4 && total_ratings >= 5
size_width_in >= 8 && size_width_in <= 14 && size_height_in >= 8
\`\`\`

---

## Operator reference

| Operator | Meaning |
|----------|---------|
| \`=\` | Equal |
| \`!=\` | Not equal |
| \`>\` \`>=\` \`<\` \`<=\` | Comparison |
| \`~\` | Like / contains |
| \`!~\` | Not like / not contains |
| \`?=\` \`?~\` etc. | Any-of (use for array fields) |
| \`&&\` | AND |
| \`||\` | OR |
          `}
        </MarkdownWrapper>
      </BorderedCard>
    </Box>
  );
};

const isAdminPatternTableHowToSearchOpen = atom(false);

const useIsOpenAdminPatternTableHowToSearch = () => {
  const [isOpen, setIsOpen] = useAtom(isAdminPatternTableHowToSearchOpen);

  return { isOpen, setIsOpen };
};

export const OpenAdminPatternTableHowToSearchButton = () => {
  const { setIsOpen } = useIsOpenAdminPatternTableHowToSearch();

  const handleClick = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <Button size="small" startIcon={<QuizRoundedIcon fontSize="small" />} onClick={handleClick}>
      How to Search/Filter
    </Button>
  );
};
