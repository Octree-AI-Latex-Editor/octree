'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function BackButton() {
  return (
    <Button variant="ghost" size="sm" asChild className="h-7 has-[>svg]:px-1">
      <Link href="/" className="flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" />
        <span className="text-sm">Back</span>
      </Link>
    </Button>
  );
}
