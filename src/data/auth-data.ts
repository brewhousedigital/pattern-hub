import React from 'react';
import { atom, useAtom } from 'jotai';
import type { TypeAuthData } from '@/functions/database/authentication';
import { authRefreshSession, useMutationAuthGetUser } from '@/functions/database/authentication';

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
  const getUser = useMutationAuthGetUser();

  const handleRefresh = async () => {
    try {
      const refreshUserData = await authRefreshSession();
      const userData = await getUser.mutateAsync({ userId: refreshUserData.record.id });

      setAuthData(userData);
    } catch (error) {
      setAuthData(null);
    } finally {
      // Add a small delay to prevent flickering
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  React.useEffect(() => {
    handleRefresh().then();
  }, []);

  return { isLoading, handleRefresh };
};
