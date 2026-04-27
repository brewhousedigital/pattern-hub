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
Use the search to filter the returned patterns list. For example:
\`name = 'Vulva'\` will return an exact match of the name. The value you're searching for must contain quote signs around it

If you want to do a partial match, you can use the \`~\` operator. For example:
\`name ~ 'Vul'\` will return any pattern with "Vul" in the name, such as "Vulva" or "Vulture"

You can also combine multiple conditions using logical operators. For example:
\`(title ~ 'abc' && created > '2022-01-01')\`
This will return patterns with "abc" in the title that were created after January 1, 2022.

You can use parentheses to group conditions and control the order of evaluation. For example:
\`(name ~ 'Clock' || name ~ 'Sun') && created > '2022-01-01'\`
This will return patterns with "Clock" or "Sun" in the name that were created after January 1, 2022.

You can also use the \`!\` operator to negate conditions. For example:
\`name !~ 'Clock'\`
This will return patterns that do not have "Clock" in any part of the name. This can be tricky if you do a partial match search for \`lock\` because \`lock\` will be a partial match for \`Clock\`.

You can combine this with other conditions as well. For example:
\`name !~ 'clock' && created > '2022-01-01'\`
This will return patterns that do not have "clock" in the name and were created after January 1, 2022.
          `}
              </MarkdownWrapper>
            </AccordionDetails>
          </Accordion>
        </Box>

        <MarkdownWrapper>
          {`
# Filter expressions to filter/search:

\`\`\`
title ~ 'abc' && created > '2022-01-01'
\`\`\`

## Supported record filter fields:

String / Number:

\`\`\`
id,
name,
description,
instructions,
pieces,
design_width,
design_height,
line_width,
design_date,
updated,
created
\`\`\`

The columns below require the \`contains\` search to be able to look through the array of tags for a match:

\`\`\`
tags ?~ '2026'
author_manual ?~ 'cline glass co.'
pattern_key_reference_list ?~ 'Wire Overlay'

// Or search by a pattern key reference image name like so:
pattern_key_reference_list ?~ 'dashed_line_8thab5zref.svg'
\`\`\`

Authors with linked accounts can be searched like so:

\`\`\`
authors.name = 'Claycorp'
\`\`\`

---

The syntax follows the format \`OPERAND OPERATOR OPERAND\`, where:

\`OPERAND\` - could be any field literal, string (single or double-quoted), number, null, true, false

\`OPERATOR\` - is one of:
- \`=\` Equal
- \`!=\` NOT equal
- \`>\` Greater than
- \`>=\` Greater than or equal
- \`<\` Less than
- \`<=\` Less than or equal
- \`~\` Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)
- \`!~\` NOT Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)
- \`?=\` Any/At least one of Equal
- \`?!=\` Any/At least one of NOT equal
- \`?>\` Any/At least one of Greater than
- \`?>=\` Any/At least one of Greater than or equal
- \`?<\` Any/At least one of Less than
- \`?<=\` Any/At least one of Less than or equal
- \`?~\` Any/At least one of Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)
- \`?!~\` Any/At least one of NOT Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)

To group and combine several expressions you can use parenthesis \`(...)\`, \`&&\` (AND) and \`||\` (OR) tokens.

Field expressions with array-like value or nested fields that originate from a source with multiple records will apply a match-all constraint by default. If you want any/at-least-one-of type of constraint for such fields you'll have to prefix your operator with ? (e.g. multiRelation.title ?= "test").
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
      Open Search/Filter Info Box
    </Button>
  );
};
