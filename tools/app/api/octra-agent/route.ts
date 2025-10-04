import { NextResponse } from 'next/server';

function createSSEHeaders() {
  return new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const remoteUrl = process.env.CLAUDE_AGENT_SERVICE_URL;
  if (!remoteUrl) {
    return NextResponse.json({ error: 'CLAUDE_AGENT_SERVICE_URL not set' }, { status: 500 });
  }
  try {
    const body = await request.json();
    const res = await fetch(remoteUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: 'Remote agent service failed' }, { status: 502 });
    }
    return new Response(res.body, { headers: createSSEHeaders() });
  } catch (e) {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}


