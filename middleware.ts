import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Allow CORS preflight to reach route handlers
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Do not force auth redirects for API routes; route will return 401 JSON
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  if (isApiRoute) {
    // Still refresh session cookies via updateSession (no redirect on missing user)
    return await updateSession(request);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything under app, including API
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
