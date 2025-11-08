'use client';

import { useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setUserLocale } from '@/lib/locale';
import { useLocale } from 'next-intl';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export function LanguageSelector() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();

  function onSelectChange(newLocale: string) {
    startTransition(() => {
      setUserLocale(newLocale);
    });
  }

  return (
    <Select
      value={locale}
      onValueChange={onSelectChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue>
          {languages.find((lang) => lang.code === locale)?.flag}{' '}
          {languages.find((lang) => lang.code === locale)?.name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {languages.map((language) => (
          <SelectItem key={language.code} value={language.code}>
            {language.flag} {language.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
