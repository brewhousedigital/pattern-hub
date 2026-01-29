import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { AuthRecord, RecordAuthResponse } from 'pocketbase';
import { useMutation, useQuery } from '@tanstack/react-query';

export type TypeAuthData = {
  created: string;
  email: string;
  id: string;
  level: number;
};

type AuthCreationType = Promise<RecordAuthResponse<TypeAuthData>>;
type AuthUserDataType = Promise<TypeAuthData>;

type CreateUserPayload = {
  email: string;
  password: string;
};

export const authSignOut = () => {
  pocketbase.authStore.clear();
  window.location.href = '/';
};

export const authRefreshSession = async (): AuthCreationType => {
  return await pocketbase.collection('users').authRefresh();
};

export const useMutationAuthGetUser = () => {
  return useMutation({
    mutationFn: (payload: { userId: string }): AuthUserDataType => {
      return pocketbase.collection('users').getOne(payload.userId, {
        expand: 'avatar,background,bias,captain_decor,topThree,title',
      });
    },
  });
};

export const useMutationAuthCreateUser = () => {
  return useMutation({
    mutationFn: (payload: CreateUserPayload): AuthCreationType => {
      return pocketbase.collection('users').create({
        email: payload.email,
        password: payload.password,
        passwordConfirm: payload.password,
      });
    },
  });
};
