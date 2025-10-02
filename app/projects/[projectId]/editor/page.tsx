import { ClientFileEditor } from '@/components/client-file-editor';

export default async function ProjectEditorPage({ 
  params 
}: { 
  params: Promise<{ projectId: string }> 
}) {
  const { projectId } = await params;
  
  return <ClientFileEditor projectId={projectId} />;
}
