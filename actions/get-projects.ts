'use server';

import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/database.types';

export async function getAllProjects(): Promise<Tables<'projects'>[] | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  return data;
}
