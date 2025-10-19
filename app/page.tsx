import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { ProjectsTable } from '@/components/projects/projects-table';
import Navbar from '@/components/navbar';

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: usage } = await supabase
    .from('user_usage')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!usage?.onboarding_completed) {
    redirect('/onboarding');
  }

  const userName = user?.user_metadata?.name ?? user?.email ?? null;

  const { data } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (!data) {
    return <div>No data</div>;
  }

  return (
    <>
      <Navbar userName={userName} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Projects</h1>
            <p className="text-sm text-neutral-500">
              Manage and edit your projects
            </p>
          </div>

          <CreateProjectDialog />
        </div>

        <ProjectsTable data={data} />
      </main>
    </>
  );
}
