import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { AuthRecord, RecordAuthResponse } from 'pocketbase';
import { useMutation, useQuery } from '@tanstack/react-query';

// Base Permissions for the database:
// ["PATTERN_AR", "TAG_AR", "FAQ_AR", "MAP_AR", "USERS_AR", "COMPLAINTS_AR"]

// Normal Admin
// ["PATTERN_AC", "PATTERN_AR", "PATTERN_AU", "PATTERN_AD", "TAG_AC", "TAG_AR", "TAG_AU", "TAG_AD", "FAQ_AC", "FAQ_AR", "FAQ_AU", "FAQ_AD", "MAP_AC", "MAP_AR", "MAP_AU", "MAP_AD", "COMPLAINTS_AC", "COMPLAINTS_AR", "COMPLAINTS_AU", "COMPLAINTS_AD", "USERS_AC", "USERS_AR", "USERS_AU", "USERS_AD", "ADMINS_AC", "ADMINS_AR", "ADMINS_AU", "ADMINS_AD"]

// Super Admin
// ["ADMINS_AC", "ADMINS_AR", "ADMINS_AU", "ADMINS_AD"]

export type TypeLevelsAdmin =
  | 'PATTERN_AC'
  | 'PATTERN_AR'
  | 'PATTERN_AU'
  | 'PATTERN_AD'
  | 'PATTERN_KEY_MGMT_AC'
  | 'PATTERN_KEY_MGMT_AR'
  | 'PATTERN_KEY_MGMT_AU'
  | 'PATTERN_KEY_MGMT_AD'
  | 'TAG_AC'
  | 'TAG_AR'
  | 'TAG_AU'
  | 'TAG_AD'
  | 'FAQ_AC'
  | 'FAQ_AR'
  | 'FAQ_AU'
  | 'FAQ_AD'
  | 'WIKI_AC'
  | 'WIKI_AR'
  | 'WIKI_AU'
  | 'WIKI_AD'
  | 'MAP_AC'
  | 'MAP_AR'
  | 'MAP_AU'
  | 'MAP_AD'
  | 'COMPLAINTS_AC'
  | 'COMPLAINTS_AR'
  | 'COMPLAINTS_AU'
  | 'COMPLAINTS_AD'
  | 'USERS_AC'
  | 'USERS_AR'
  | 'USERS_AU'
  | 'USERS_AD'
  | 'ADMINS_AC'
  | 'ADMINS_AR'
  | 'ADMINS_AU'
  | 'ADMINS_AD';

// NAME_TYPE_CRUD
// A - Admin
// U - User
// Create Read Update Delete
export const EnumLevelsAdmin = {
  PATTERN_AC: 'PATTERN_AC',
  PATTERN_AR: 'PATTERN_AR',
  PATTERN_AU: 'PATTERN_AU',
  PATTERN_AD: 'PATTERN_AD',
  PATTERN_KEY_MGMT_AC: 'PATTERN_KEY_MGMT_AC',
  PATTERN_KEY_MGMT_AR: 'PATTERN_KEY_MGMT_AR',
  PATTERN_KEY_MGMT_AU: 'PATTERN_KEY_MGMT_AU',
  PATTERN_KEY_MGMT_AD: 'PATTERN_KEY_MGMT_AD',
  TAG_AC: 'TAG_AC',
  TAG_AR: 'TAG_AR',
  TAG_AU: 'TAG_AU',
  TAG_AD: 'TAG_AD',
  FAQ_AC: 'FAQ_AC',
  FAQ_AR: 'FAQ_AR',
  FAQ_AU: 'FAQ_AU',
  FAQ_AD: 'FAQ_AD',
  WIKI_AC: 'WIKI_AC',
  WIKI_AR: 'WIKI_AR',
  WIKI_AU: 'WIKI_AU',
  WIKI_AD: 'WIKI_AD',
  MAP_AC: 'MAP_AC',
  MAP_AR: 'MAP_AR',
  MAP_AU: 'MAP_AU',
  MAP_AD: 'MAP_AD',
  USERS_AC: 'USERS_AC',
  USERS_AR: 'USERS_AR',
  USERS_AU: 'USERS_AU',
  USERS_AD: 'USERS_AD',
  ADMINS_AC: 'ADMINS_AC',
  ADMINS_AR: 'ADMINS_AR',
  ADMINS_AU: 'ADMINS_AU',
  ADMINS_AD: 'ADMINS_AD',
  COMPLAINTS_AC: 'COMPLAINTS_AC',
  COMPLAINTS_AR: 'COMPLAINTS_AR',
  COMPLAINTS_AU: 'COMPLAINTS_AU',
  COMPLAINTS_AD: 'COMPLAINTS_AD',
} as const;

// This is the data from the pocketbase user and admin table
export type TypeAuthData = {
  created?: string;
  email?: string;
  id: string;
  name?: string;
  about?: string;
  interests?: string;
  level?: TypeLevelsAdmin[];
  site_color?: string;
  site_color_secondary?: string;
  verified?: boolean;
  admin?: boolean;
  showAdminBanner?: boolean;
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

export const useMutationAuthUpdateUser = () => {
  return useMutation({
    mutationFn: (payload: TypeAuthData): AuthUserDataType => {
      return pocketbase.collection('users').update(payload.id, payload);
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

export const useMutationResendVerificationCode = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      return await pocketbase.collection('users').requestVerification(email);
    },
  });
};
