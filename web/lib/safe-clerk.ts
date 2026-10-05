import { useClerk as useClerkOriginal, useUser as useUserOriginal } from '@clerk/react';

const rawClerkPubKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? '';
export const hasValidClerkKey = rawClerkPubKey.startsWith('pk_') && !rawClerkPubKey.includes('replace_me');

export function useUser() {
  if (!hasValidClerkKey) {
    return { isLoaded: true, isSignedIn: false, user: null };
  }
  return useUserOriginal();
}

export function useClerk() {
  if (!hasValidClerkKey) {
    return { signOut: async () => {}, addListener: () => () => {} } as any;
  }
  return useClerkOriginal();
}
