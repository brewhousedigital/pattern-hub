import React from 'react';
import { atom, useAtom } from 'jotai';
import { authRefreshAdminSession, type TypeAuthData } from '@/functions/database/authentication';
import { authRefreshSession } from '@/functions/database/authentication';
import { pocketbase } from '@/functions/database/authentication-setup.ts';

const globalAuthData = atom<TypeAuthData | null>(null);

export const useGlobalAuthData = () => {
  const [authData, setAuthData] = useAtom(globalAuthData);

  return {
    authData,
    setAuthData,
  };
};

export const useRefreshAuth = () => {
  // Show a loading screen while we refresh the auth data
  const [isLoading, setIsLoading] = React.useState(true);

  const { setAuthData } = useGlobalAuthData();

  // Stable identity (jotai setters never change) so callers can safely list
  // handleRefresh in effect dependency arrays.
  const handleRefresh = React.useCallback(async () => {
    try {
      await authRefreshSession();
      const userData = pocketbase.authStore.record;

      setAuthData(userData);
    } catch (error) {
      setAuthData(null);
    } finally {
      // Add a small delay to prevent flickering
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  }, [setAuthData]);

  return { isLoading, handleRefresh };
};

// Bootstraps the session exactly once at the app root. This used to live in
// useRefreshAuth's own effect, called from GeneralLayout - which is mounted
// per-route, so every client-side navigation re-hit PocketBase's authRefresh
// endpoint. The auth atom is global and survives navigation, so once is enough.
export const useBootstrapAuth = () => {
  const { handleRefresh } = useRefreshAuth();

  React.useEffect(() => {
    handleRefresh().then();
  }, [handleRefresh]);
};

export const useRefreshAdminAuth = () => {
  // Show a loading screen while we refresh the auth data
  const [isLoading, setIsLoading] = React.useState(true);

  const [isAdmin, setIsAdmin] = React.useState(false);

  const { setAuthData } = useGlobalAuthData();

  const handleRefresh = async () => {
    try {
      await authRefreshAdminSession();
      const userData = pocketbase.authStore.record;

      setIsAdmin(true);
      setAuthData(userData);
    } catch (error) {
      setIsAdmin(false);
      setAuthData(null);
    } finally {
      // Add a small delay to prevent flickering
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  return { isLoading, handleRefresh, isAdmin };
};
