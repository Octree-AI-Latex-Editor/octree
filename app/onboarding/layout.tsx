import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

interface OnboardingLayoutProps {
  children: React.ReactNode;
}

export default async function OnboardingLayout({
  children,
}: OnboardingLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  type UsageRecord = {
    onboarding_completed: boolean | null;
  };

  const { data: usage, error } = await supabase
    .from('user_usage')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .maybeSingle<UsageRecord>();

  if (!error && usage?.onboarding_completed) {
    redirect('/');
  }

  return <>{children}</>;
}

