import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { AuthRecord, RecordAuthResponse } from 'pocketbase';
import { useMutation, useQuery } from '@tanstack/react-query';

export type TypeAuthData = {
  created: string;
  email: string;
  id: string;
  name: string;
  level: number;
  admin?: boolean;
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

export const authRefreshAdminSession = async (): AuthCreationType => {
  return await pocketbase.collection('admins').authRefresh();
};

export const useMutationAuthGetUser = () => {
  return useMutation({
    mutationFn: (payload: { userId: string }): AuthUserDataType => {
      return pocketbase.collection('users').getOne(payload.userId);
    },
  });
};

export const useMutationAuthGetAdmin = () => {
  return useMutation({
    mutationFn: (payload: { userId: string }): AuthUserDataType => {
      return pocketbase.collection('admins').getOne(payload.userId);
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

type SignInPayload = {
  email: string;
  password: string;
};

export const useMutationAuthSignIn = () => {
  return useMutation({
    mutationFn: (payload: SignInPayload): AuthCreationType => {
      return pocketbase.collection('users').authWithPassword(payload.email, payload.password);
    },
  });
};

export const useMutationAuthAdminSignIn = () => {
  return useMutation({
    mutationFn: (payload: SignInPayload): AuthCreationType => {
      return pocketbase.collection('admins').authWithPassword(payload.email, payload.password);
    },
  });
};
