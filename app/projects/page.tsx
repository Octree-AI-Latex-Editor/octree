import { redirect } from 'next/navigation';
import { DataTable } from '@/components/projects/data-table';
import { columns } from '@/components/projects/columns';
import { createClient } from '@/lib/supabase/server';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { ProjectsTable } from '@/components/projects/projects-table';
import { OctreeLogo } from '@/components/icons/octree-logo';
import { FileText } from 'lucide-react';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { DM_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
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
    {/* Custom Navbar */}
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-5 w-5 bg-blue-500 rounded flex items-center justify-center">
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

    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            Projects
          </h1>
          <p className="text-sm text-neutral-500">
            Manage and edit your projects
          </p>
        </div>

        <CreateProjectDialog />

      </div>

      <ProjectsTable
       data={data}
      />
    </main>

   
  </>
    // <>
    //    <nav className="bg-white border-b border-gray-200">
    //     <div className="max-w-7xl mx-auto px-6">
    //       <div className="flex h-14 items-center justify-between">
    //         <div className="flex items-center">
    //           <Link href="/" className="flex items-center space-x-2">
    //             <div className="h-5 w-5 bg-blue-500 rounded flex items-center justify-center">
    //               <FileText className="h-3 w-3 text-white" />
    //             </div>
    //             <span
    //               className={cn(
    //                 'text-lg font-medium tracking-tight text-neutral-900',
    //                 dmSans.className
    //               )}
    //             >
    //               Octree
    //             </span>
    //           </Link>
    //         </div>
    //         <div className="flex items-center">
    //           <UserProfileDropdown userName={userName} />
    //         </div>
    //       </div>
    //     </div>
    //   </nav>
    //   <main className="container mx-auto px-4 py-8">
    //   <div className="mb-8 flex items-center justify-between">
    //         <h1 className="text-lg font-semibold text-neutral-900">Projects</h1>
    //         <p className="text-sm text-neutral-500">
    //           Manage and edit your projects
    //         </p>
    //       </div>

    //       <CreateProjectDialog />
    //     </main>

    //     <ProjectsTable data={data} />
    //     </>
  );
}
