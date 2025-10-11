import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/database.types';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const { name, email, subject, message } = body;

    // validate fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'all fields are required' },
        { status: 400 }
      );
    }

    // create submission payload
    const submissionPayload: TablesInsert<'contact_submissions'> = {
      user_id: user?.id || null,
      name,
      email,
      subject,
      message,
      status: 'unread',
    };

    // insert into database
    const { error: insertError } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('contact_submissions') as any
    ).insert(submissionPayload);

    if (insertError) {
      console.error('error inserting contact submission:', insertError);
      return NextResponse.json(
        { error: 'failed to submit contact form' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'contact form submitted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('error processing contact submission:', error);
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 }
    );
  }
}

