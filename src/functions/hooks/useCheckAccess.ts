import { useGlobalAuthData } from '@/data/auth-data';
import { type TypeLevelsAdmin } from '@/functions/database/authentication';

export const useCheckAdminAccess = () => {
  const { authData } = useGlobalAuthData();

  const checkAccess = (permission: TypeLevelsAdmin): boolean => {
    if (!permission) return false;

    return authData?.level?.includes(permission) || false;
  };

  return { checkAccess };
};
