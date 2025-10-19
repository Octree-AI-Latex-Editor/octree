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

  const { data: usage, error } = await supabase
    .from('user_usage')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Failed to fetch onboarding status', error);
  }

  if (usage?.onboarding_completed) {
    redirect('/');
  }

  return <>{children}</>;
}

