import { pocketbase } from './authentication-setup.ts';

type TypeMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

type TypeAuthHeaders = {
  method: TypeMethods;
  headers: {
    'Content-Type': string;
    Authorization: string;
  };
  body?: string;
};

export const useAuthorizationHeaders = (type: TypeMethods): TypeAuthHeaders => {
  const idToken = pocketbase.authStore.token;

  return {
    method: type,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  };
};
