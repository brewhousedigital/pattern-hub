import * as React from 'react';
import { type TypeLevelsAdmin, EnumLevelsAdmin, type TypeAuthData } from '@/functions/database/authentication';
import { useRefreshAdminAuth } from '@/data/auth-data';
import { useQueryAdminUsersByPagination, useMutationUpdateAdminUser } from '@/functions/database/users_admin';

import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import SaveIcon from '@mui/icons-material/Save';

import {
  IconButton,
  Grid,
  List,
  Card,
  CardHeader,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Button,
  Divider,
  Box,
  Chip,
  Typography,
  Stack,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useAdminLogger } from '@/functions/database/admin-logs';

const ALL_PERMISSIONS = Object.values(EnumLevelsAdmin);

// Change the suffix to an easier to read label
const ACTION_LABELS: Record<string, { label: string; color: 'success' | 'info' | 'warning' | 'error' }> = {
  AC: { label: 'Create', color: 'success' },
  AR: { label: 'Read', color: 'info' },
  AU: { label: 'Update', color: 'warning' },
  AD: { label: 'Delete', color: 'error' },
};

function not<T>(a: T[], b: T[]): T[] {
  return a.filter((v) => !b.includes(v));
}

function intersection<T>(a: T[], b: T[]): T[] {
  return a.filter((v) => b.includes(v));
}

function union<T>(a: T[], b: T[]): T[] {
  return [...a, ...not(b, a)];
}

/** Split "COMPLAINTS_AC" → { resource: "COMPLAINTS", action: "AC" } */
function parsePermission(p: TypeLevelsAdmin) {
  const lastUnderscore = p.lastIndexOf('_');
  return {
    resource: p.slice(0, lastUnderscore)?.toLowerCase(),
    action: p.slice(lastUnderscore + 1),
  };
}

/** Friendly display for a permission string */
function PermissionLabel({ perm }: { perm: TypeLevelsAdmin }) {
  const { resource, action } = parsePermission(perm);
  const meta = ACTION_LABELS[action];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 100 }}>
        {resource}
      </Typography>

      {meta && (
        <Chip label={meta.label} color={meta.color} size="small" sx={{ fontSize: '0.65rem', height: 20, ml: 'auto' }} />
      )}
    </Box>
  );
}

interface PermissionsTransferListProps {
  /** Permissions already assigned to the user (from `level` column) */
  userData: TypeAuthData;
  handleCloseModal: () => void;
}

export const PermissionsTransferList = (props: PermissionsTransferListProps) => {
  const [checked, setChecked] = React.useState<TypeLevelsAdmin[]>([]);

  const [isLoading, setIsLoading] = React.useState(false);

  const { refetch } = useQueryAdminUsersByPagination(1);

  const saveAdminUser = useMutationUpdateAdminUser();
  const { handleRefresh } = useRefreshAdminAuth();
  const { log } = useAdminLogger();

  const assignedPermissions = props.userData?.level || [];

  // Left = all permissions NOT yet assigned; Right = currently assigned
  const [left, setLeft] = React.useState<TypeLevelsAdmin[]>(not(ALL_PERMISSIONS, assignedPermissions));
  const [right, setRight] = React.useState<TypeLevelsAdmin[]>(
    ALL_PERMISSIONS.filter((p) => assignedPermissions.includes(p)),
  );

  const leftChecked = intersection(checked, left);
  const rightChecked = intersection(checked, right);

  const handleToggle = (value: TypeLevelsAdmin) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];
    if (currentIndex === -1) newChecked.push(value);
    else newChecked.splice(currentIndex, 1);
    setChecked(newChecked);
  };

  const numberOfChecked = (items: TypeLevelsAdmin[]) => intersection(checked, items).length;

  const handleToggleAll = (items: TypeLevelsAdmin[]) => () => {
    if (numberOfChecked(items) === items.length) {
      setChecked(not(checked, items));
    } else {
      setChecked(union(checked, items));
    }
  };

  const handleMoveRight = () => {
    setRight(right.concat(leftChecked));
    setLeft(not(left, leftChecked));
    setChecked(not(checked, leftChecked));
  };

  const handleMoveLeft = () => {
    setLeft(left.concat(rightChecked));
    setRight(not(right, rightChecked));
    setChecked(not(checked, rightChecked));
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const id = props.userData.id;

      await saveAdminUser.mutateAsync({ id: id, level: right });

      log({
        action: 'Admin Permissions Updated',
        entity_type: 'Admin User',
        entity_id: id,
        entity_name: props.userData.name || props.userData.email || id,
        changes: { permissions: { from: assignedPermissions, to: right } },
        metadata: {},
      });

      await refetch();

      await handleRefresh();

      props.handleCloseModal();

      enqueueSnackbar(`Permissions saved. Have the user refresh and they'll be good to go.`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Unable to save the permissions. Give it a few minutes and try again.', { variant: 'error' });
    }

    setIsLoading(false);
  };

  const customList = (title: string, items: TypeLevelsAdmin[]) => (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardHeader
        sx={{ px: 2, py: 1, backgroundColor: 'grey.50' }}
        avatar={
          <Checkbox
            onClick={handleToggleAll(items)}
            checked={numberOfChecked(items) === items.length && items.length !== 0}
            indeterminate={numberOfChecked(items) !== items.length && numberOfChecked(items) !== 0}
            disabled={items.length === 0}
            color="primary"
          />
        }
        title={
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        }
        subheader={
          <Typography variant="caption" color="text.secondary">
            {numberOfChecked(items)}/{items.length} selected
          </Typography>
        }
      />

      <Divider />

      <List
        sx={{ width: '100%', height: 380, backgroundColor: 'background.paper', overflow: 'auto' }}
        dense
        component="div"
        role="list"
      >
        {items.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.disabled">
              No permissions
            </Typography>
          </Box>
        )}

        {items.map((perm) => (
          <ListItemButton
            key={perm}
            role="listitem"
            onClick={handleToggle(perm)}
            sx={{
              borderRadius: 1,
              mx: 0.5,
              '&.Mui-selected': { backgroundColor: 'primary.50' },
            }}
            selected={checked.includes(perm)}
          >
            <ListItemIcon>
              <Checkbox checked={checked.includes(perm)} tabIndex={-1} disableRipple color="primary" size="small" />
            </ListItemIcon>

            <ListItemText
              primary={<PermissionLabel perm={perm} />}
              sx={{ '& .MuiTypography-root': { textTransform: 'capitalize' } }}
              disableTypography
            />
          </ListItemButton>
        ))}
      </List>
    </Card>
  );

  return (
    <Box>
      <Grid container spacing={2} sx={{ justifyContent: 'center', alignItems: 'center' }}>
        {/* Left: Available permissions */}
        <Grid size="grow">{customList('Available Permissions', left)}</Grid>

        {/* Move buttons */}
        <Grid>
          <Stack sx={{ alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={handleMoveRight}
              disabled={leftChecked.length === 0}
              aria-label="move selected to assigned"
            >
              <ArrowForwardIosIcon />
            </IconButton>

            <IconButton
              onClick={handleMoveLeft}
              disabled={rightChecked.length === 0}
              aria-label="move selected to available"
            >
              <ArrowBackIosNewIcon />
            </IconButton>
          </Stack>
        </Grid>

        {/* Right: Assigned permissions */}
        <Grid size="grow">{customList('Assigned Permissions', right)}</Grid>
      </Grid>

      <Box sx={{ py: 3 }}>
        <Divider />
      </Box>

      {/* Save */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          loading={isLoading}
          sx={{ px: 4, borderRadius: 2, fontWeight: 600 }}
        >
          Save Permissions
        </Button>
      </Box>
    </Box>
  );
};
