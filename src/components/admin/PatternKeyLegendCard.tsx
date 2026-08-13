import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { generatePbImagePatternKeyRef } from '@/functions/utilities/generate-pb-image';
import { useMutationSavePatternKeyMeta, type TypePatternKeyTableResponse } from '@/functions/database/patterns';
import { useQueryAdminTagStatsPaginated } from '@/functions/database/tags';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger, diffAdminChanges } from '@/functions/database/admin-logs';
import { FancyAutocomplete } from '@/components/FancyAutocomplete';
import { BorderedCard } from '@/components/cards/BorderedCard';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';

import { Box, IconButton, TextField } from '@mui/material';

type PatternKeyLegendCardProps = {
  legend: TypePatternKeyTableResponse;
  /** Gates editing the name/tags below - matches PATTERN_KEY_MGMT_AU. */
  canEdit: boolean;
  onDelete: (id: string) => void;
  isDeleting: boolean;
};

// Extracted from pattern-key-mgmt.tsx's Legends grid so the debounced tag
// search and name draft can each own their own hooks per card - calling
// hooks from inside the parent's .map() body isn't valid.
export const PatternKeyLegendCard = (props: PatternKeyLegendCardProps) => {
  const { legend } = props;
  const url = generatePbImagePatternKeyRef(legend);
  const tags = legend.tags ?? [];

  const queryClient = useQueryClient();
  const { log } = useAdminLogger();
  const saveMeta = useMutationSavePatternKeyMeta();

  const [nameDraft, setNameDraft] = React.useState(legend.display_name ?? '');
  const [tagInput, setTagInput] = React.useState('');
  const debouncedTagSearch = useDebounce(tagInput, 400);
  const { data: tagSearchData, isFetching: tagSearchFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: debouncedTagSearch,
    sortField: 'count',
    sortDir: 'desc',
  });

  const persistMeta = async (patch: { display_name?: string; tags?: string[] }) => {
    try {
      await saveMeta.mutateAsync({ id: legend.id, ...patch });
      log({
        action: 'Pattern Key Updated',
        entity_type: 'Pattern Key',
        entity_id: legend.id,
        entity_name: patch.display_name ?? legend.display_name ?? legend.name,
        changes: diffAdminChanges(
          { display_name: legend.display_name ?? '', tags: tags.join(', ') } as Record<string, unknown>,
          {
            display_name: patch.display_name ?? legend.display_name ?? '',
            tags: (patch.tags ?? tags).join(', '),
          } as Record<string, unknown>,
          ['display_name', 'tags'],
        ),
        metadata: {},
      });
      await queryClient.invalidateQueries({ queryKey: ['GetAllPatternKeys'] });
    } catch (error: any) {
      enqueueSnackbar(`Couldn't save that pattern key. Try again in a few minutes. Error: ${error?.message}`, {
        variant: 'error',
      });
    }
  };

  const handleNameBlur = () => {
    const trimmed = nameDraft.trim();
    if (trimmed === (legend.display_name ?? '')) return;
    persistMeta({ display_name: trimmed });
  };

  const handleTagsChange = (newTags: string[]) => {
    persistMeta({ tags: newTags });
  };

  return (
    <BorderedCard>
      <Box
        sx={{
          position: 'relative',
          minHeight: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          component="img"
          loading="lazy"
          src={url}
          alt={nameDraft || legend.name}
          sx={{
            width: '100%',
            height: 'auto',
            maxHeight: 100,
            borderRadius: 1,
          }}
        />

        <IconButton
          size="small"
          onClick={() => props.onDelete(legend.id)}
          disabled={props.isDeleting}
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            zIndex: 6,
            backgroundColor: '#eee',
            '&:hover': { color: 'error.main', backgroundColor: '#eee' },
          }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>

      <TextField
        fullWidth
        size="small"
        variant="outlined"
        label="Name"
        placeholder="Unnamed key"
        disabled={!props.canEdit}
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={handleNameBlur}
        sx={{ mt: 1.5 }}
      />

      <Box sx={{ mt: 1 }}>
        <FancyAutocomplete
          label="Tags"
          freeSolo
          serverSide
          disabled={!props.canEdit}
          data={tagSearchData?.items ?? []}
          value={tags}
          onChange={handleTagsChange}
          inputValue={tagInput}
          onInputChange={setTagInput}
          loading={tagSearchFetching}
        />
      </Box>
    </BorderedCard>
  );
};
