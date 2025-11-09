import { redirect } from 'next/navigation';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { ProjectsTable } from '@/components/projects/projects-table';
import { FileText } from 'lucide-react';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { DM_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getAllProjects } from '@/actions/get-projects';
import { getCurrentUser } from '@/lib/requests/user';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export default async function Dashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const userName = user?.user_metadata?.name ?? user?.email ?? null;

  const data = await getAllProjects();

  if (!data) {
    return <div>No data</div>;
  }

  return (
    <>
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto w-full max-w-4xl px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500">
                  <FileText className="h-3 w-3 text-white" />
                </div>
                <span
                  className={cn(
                    'text-lg font-medium tracking-tight text-neutral-900',
                    dmSans.className
                  )}
                >
                  Octree
                </span>
              </Link>
              <Link
                href="/tools"
                className="ml-6 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Tools
              </Link>
            </div>
            <div className="flex items-center">
              <UserProfileDropdown userName={userName} />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-4xl px-6 py-8">
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
