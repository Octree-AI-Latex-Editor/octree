import { NextResponse } from 'next/server';
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Prefer next from query, else fallback to cookie we set prior to OAuth
  let next = searchParams.get('next') ?? '/';
  if (!next || next === '/') {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|; )octree_oauth_next=([^;]+)/);
    if (match) {
      try {
        next = decodeURIComponent(match[1]);
      } catch {
        next = '/';
      }
    }
  }
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/';
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        const res = NextResponse.redirect(`${origin}${next}`);
        res.headers.append('Set-Cookie', 'octree_oauth_next=; Path=/; Max-Age=0; SameSite=Lax; Secure');
        return res;
      } else if (forwardedHost) {
        const res = NextResponse.redirect(`https://${forwardedHost}${next}`);
        res.headers.append('Set-Cookie', 'octree_oauth_next=; Path=/; Max-Age=0; SameSite=Lax; Secure');
        return res;
      } else {
        const res = NextResponse.redirect(`${origin}${next}`);
        res.headers.append('Set-Cookie', 'octree_oauth_next=; Path=/; Max-Age=0; SameSite=Lax; Secure');
        return res;
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
