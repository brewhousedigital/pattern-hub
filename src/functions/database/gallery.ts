import { useMutation } from '@tanstack/react-query';
import { useAuthorizationHeaders } from '@/functions/database/useAuthorizationHeaders';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';

export const useMutationGetGalleryUploadAuth = () => {
  const fetchOptions = useAuthorizationHeaders('GET');

  return useMutation({
    mutationFn: async () => {
      let domain = `${pocketbaseDomain}/api/images/auth`;

      const response = await fetch(domain, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.message;
        throw new Error(errorMessage);
      }

      return await response.json();
    },
  });
};
