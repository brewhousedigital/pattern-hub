import { BORDER_CSS } from '@/data/constants';
import type { TypeTagObject } from '@/functions/types/types';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';

import {
  Box,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  Typography,
  Stack,
  IconButton,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';

type SidebarListProps = {
  isPending: boolean;
  isError: boolean;
  data?: TypeTagObject[];
  handleClickAdd: (value: string) => void;
  handleClickRemove: (value: string) => void;
};

export const SidebarList = (props: SidebarListProps) => {
  const theme = useTheme();
  const isMediumSizeAndUp = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <List
      disablePadding
      sx={{
        minWidth: 250,
        maxWidth: isMediumSizeAndUp ? '100%' : 250,
        maxHeight: isMediumSizeAndUp ? '70svh' : 'calc(100svh - 50px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: (theme) => `${theme.palette.primary.main} #222222`,
      }}
    >
      {props.isPending && <SkeletonLink />}
      {props.isError && <Alert severity="error">Unable to load this category</Alert>}
      {props.data &&
        props.data.map((thisTag) => {
          // Removing secondaryAction={thisTag.count}
          return (
            <ListItem
              key={`sidebar-link-${thisTag.tag}`}
              sx={{ textTransform: 'capitalize', paddingRight: '94px' }}
              secondaryAction={
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <Box>
                    <IconButton size="small" onClick={() => props.handleClickAdd(thisTag.tag)}>
                      <AddRoundedIcon />
                    </IconButton>
                  </Box>
                  <Box>
                    <IconButton size="small" onClick={() => props.handleClickRemove(thisTag.tag)}>
                      <RemoveRoundedIcon />
                    </IconButton>
                  </Box>
                </Stack>
              }
            >
              <ListItemText primary={`${thisTag.tag} (${thisTag.count})`} />
            </ListItem>
          );
        })}
    </List>
  );
};

const SkeletonLink = () => {
  return (
    <Stack sx={{ spacing: 2, px: 2 }}>
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
      <Skeleton width="100%" height={40} />
    </Stack>
  );
};

type SidebarCategoryTitleProps = {
  title: string;
};

export const SidebarCategoryTitle = (props: SidebarCategoryTitleProps) => {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#15252B',
        padding: '12px 16px',
        borderBottom: BORDER_CSS,
      }}
    >
      <Typography color="primary" sx={{ fontWeight: 600 }}>
        {props.title}
      </Typography>
    </Stack>
  );
};
