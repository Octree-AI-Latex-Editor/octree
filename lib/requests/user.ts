import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

type UsageRecord = {
  onboarding_completed: boolean | null;
};

export const getCurrentUser = async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
};

export const getUserUsage = async (
  supabase: Awaited<
    ReturnType<typeof import('@/lib/supabase/server').createClient>
  >,
  userId: string
): Promise<UsageRecord | null> => {
  const { data } = await supabase
    .from('user_usage')
    .select('onboarding_completed')
    .eq('user_id', userId)
    .maybeSingle<UsageRecord>();

  return data;
};
