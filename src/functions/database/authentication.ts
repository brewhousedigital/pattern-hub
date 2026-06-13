import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { AuthRecord, RecordAuthResponse } from 'pocketbase';
import { useMutation, useQuery } from '@tanstack/react-query';

// Base Permissions for the database:
// ["PATTERN_AR", "TAG_AR", "FAQ_AR", "USERS_AR", "COMPLAINTS_AR"]

// Normal Admin
// ["PATTERN_AC", "PATTERN_AR", "PATTERN_AU", "PATTERN_AD", "TAG_AC", "TAG_AR", "TAG_AU", "TAG_AD", "FAQ_AC", "FAQ_AR", "FAQ_AU", "FAQ_AD", "COMPLAINTS_AC", "COMPLAINTS_AR", "COMPLAINTS_AU", "COMPLAINTS_AD", "USERS_AC", "USERS_AR", "USERS_AU", "USERS_AD", "ADMINS_AC", "ADMINS_AR", "ADMINS_AU", "ADMINS_AD"]

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
  | 'COMPLAINTS_AC'
  | 'COMPLAINTS_AR'
  | 'COMPLAINTS_AU'
  | 'COMPLAINTS_AD'
  | 'CONTACT_AC'
  | 'CONTACT_AR'
  | 'CONTACT_AU'
  | 'CONTACT_AD'
  | 'USERS_AC'
  | 'USERS_AR'
  | 'USERS_AU'
  | 'USERS_AD'
  | 'ADMINS_AC'
  | 'ADMINS_AR'
  | 'ADMINS_AU'
  | 'ADMINS_AD'
  | 'STORE_LOC_AC'
  | 'STORE_LOC_AR'
  | 'STORE_LOC_AU'
  | 'STORE_LOC_AD'
  | 'KANBAN_AC'
  | 'KANBAN_AR'
  | 'KANBAN_AU'
  | 'KANBAN_AD'
  | 'SETS_AC'
  | 'SETS_AR'
  | 'SETS_AU'
  | 'SETS_AD';

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
  CONTACT_AC: 'CONTACT_AC',
  CONTACT_AR: 'CONTACT_AR',
  CONTACT_AU: 'CONTACT_AU',
  CONTACT_AD: 'CONTACT_AD',
  STORE_LOC_AC: 'STORE_LOC_AC',
  STORE_LOC_AR: 'STORE_LOC_AR',
  STORE_LOC_AU: 'STORE_LOC_AU',
  STORE_LOC_AD: 'STORE_LOC_AD',
  KANBAN_AC: 'KANBAN_AC',
  KANBAN_AR: 'KANBAN_AR',
  KANBAN_AU: 'KANBAN_AU',
  KANBAN_AD: 'KANBAN_AD',
  SETS_AC: 'SETS_AC',
  SETS_AR: 'SETS_AR',
  SETS_AU: 'SETS_AU',
  SETS_AD: 'SETS_AD',
} as const;

// This is the data from the pocketbase user and admin table
export type TypeAuthData = {
  collectionId?: string;
  created?: string;
  email?: string;
  id: string;
  name?: string;
  about?: string;
  interests?: string;
  is_artist?: boolean;
  avatar?: string; // PocketBase filename,  use generateUserFileUrl() to build the URL
  header_image?: string; // PocketBase filename,  use generateUserFileUrl() to build the URL
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
  name: string;
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

// Use this when saving includes file uploads (avatar / header_image).
// Build a FormData with all fields including the File objects.
export const useMutationUpdateUserWithFiles = () => {
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }): AuthUserDataType => {
      return pocketbase.collection('users').update(id, formData);
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
        name: payload.name,
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

export const useMutationRequestPasswordReset = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      return await pocketbase.collection('users').requestPasswordReset(email);
    },
  });
};

export const useMutationConfirmPasswordReset = () => {
  return useMutation({
    mutationFn: async ({
      token,
      password,
      passwordConfirm,
    }: {
      token: string;
      password: string;
      passwordConfirm: string;
    }) => {
      return await pocketbase.collection('users').confirmPasswordReset(token, password, passwordConfirm);
    },
  });
};
