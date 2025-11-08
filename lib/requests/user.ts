type UsageRecord = {
  onboarding_completed: boolean | null;
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
