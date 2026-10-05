import { useClerk as useClerkOriginal, useUser as useUserOriginal } from '@clerk/react';

const rawClerkPubKey =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined) ||
  '';

export const hasValidClerkKey =
  typeof rawClerkPubKey === 'string' &&
  rawClerkPubKey.startsWith('pk_') &&
  !rawClerkPubKey.includes('replace_me');

export function useUser() {
  if (!hasValidClerkKey) {
    return { isLoaded: true, isSignedIn: false, user: null };
  }
  try {
    return useUserOriginal();
  } catch {
    return { isLoaded: true, isSignedIn: false, user: null };
  }
}

export function useClerk() {
  if (!hasValidClerkKey) {
    return { signOut: async () => {}, addListener: () => () => {} } as any;
  }
  try {
    return useClerkOriginal();
  } catch {
    return { signOut: async () => {}, addListener: () => () => {} } as any;
  }
}
