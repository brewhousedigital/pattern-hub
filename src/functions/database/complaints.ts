import { useMutation } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup.ts';

type TypeComplaintPayload = {
  pattern_id: string;
  reason: string;
  owner_id?: string;
};

export const useMutationCreateComplaint = () => {
  return useMutation({
    mutationFn: async (payload: TypeComplaintPayload) => {
      await pocketbase.collection('complaints').create(payload);
    },
  });
};
