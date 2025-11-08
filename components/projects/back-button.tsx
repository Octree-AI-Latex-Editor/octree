'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export function BackButton() {
  const t = useTranslations('projects');
  
  return (
    <Button variant="ghost" size="sm" asChild className="h-7 has-[>svg]:px-1">
      <Link href="/" className="flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" />
        <span className="hidden text-sm sm:inline">{t('backToProjects')}</span>
        <span className="text-sm sm:hidden">{t('back')}</span>
      </Link>
    </Button>
  );
}
