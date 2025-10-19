import { NextResponse } from 'next/server';
import { buildRedirectUrl } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') ? nextParam : '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Auto-complete onboarding for OAuth users (tools integration)
      await supabase
        .from('user_usage')
        // @ts-ignore - Supabase type generation issue
        .upsert({
          user_id: data.user.id,
          onboarding_completed: true,
          referral_source: 'oauth',
        }, {
          onConflict: 'user_id',
        });
      
      const destination = buildRedirectUrl(request.headers, origin, next);
      return NextResponse.redirect(destination, { status: 303 });
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
