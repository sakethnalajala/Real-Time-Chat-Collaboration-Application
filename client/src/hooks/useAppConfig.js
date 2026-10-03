import { useQuery } from '@tanstack/react-query';
import { configService } from '../services/index.js';

const FALLBACK = {
  appName: 'Nebula Chat',
  demo: { enabled: false, accounts: [] },
  uploads: { enabled: true, maxFileSizeMB: 10, maxAvatarSizeMB: 5, maxFilesPerMessage: 5, accept: [] },
  email: { configured: false, devResetLinks: false },
  limits: { messageMaxLength: 4000, groupMaxMembers: 100, bioMaxLength: 160 },
};

/** Public server configuration (upload limits, demo accounts, email availability). */
export function useAppConfig() {
  const query = useQuery({
    queryKey: ['app-config'],
    queryFn: configService.get,
    staleTime: 5 * 60_000,
    gcTime: Infinity,
    retry: 2,
  });
  return {
    config: query.data ?? FALLBACK,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
