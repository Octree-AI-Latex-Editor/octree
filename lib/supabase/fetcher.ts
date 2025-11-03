import { createClient } from './client';

export const supabaseFetcher = async <T>(
  queryFn: (supabase: ReturnType<typeof createClient>) => Promise<T>
) => {
  const supabase = createClient();
  return queryFn(supabase);
};
