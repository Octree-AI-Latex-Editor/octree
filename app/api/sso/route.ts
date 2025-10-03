import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const allowedOrigin = process.env.ALLOWED_TOOLS_ORIGIN || 'https://tools.useoctree.com';

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return res;
}

export async function OPTIONS() {
  return withCors(NextResponse.json({}, { status: 204 }));
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let access_token: string | null = null;
    let refresh_token: string | null = null;
    let next: string = '/';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      access_token = body.access_token || null;
      refresh_token = body.refresh_token || null;
      next = typeof body.next === 'string' && body.next.startsWith('/') ? body.next : '/';
    } else {
      const form = await req.formData();
      access_token = (form.get('access_token') as string) || null;
      refresh_token = (form.get('refresh_token') as string) || null;
      const rawNext = (form.get('next') as string) || '/';
      next = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : '/';
    }

    if (!access_token || !refresh_token) {
      return withCors(NextResponse.json({ error: 'Missing tokens' }, { status: 400 }));
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      return withCors(NextResponse.json({ error: 'Failed to set session' }, { status: 401 }));
    }

    const url = new URL(req.url);
    const redirectUrl = new URL(next, url.origin);
    const res = NextResponse.redirect(redirectUrl, { status: 303 });
    return withCors(res);
  } catch (err) {
    console.error('SSO error:', err);
    return withCors(NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }));
  }
}


