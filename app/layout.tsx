import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import { ProjectProvider } from '@/app/context/project';
import { Toaster } from '@/components/ui/sonner';
import localFont from 'next/font/local';
import { PostHogProvider } from '@/components/providers/posthog';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

const satoshi = localFont({
  src: [
    {
      path: './fonts/Satoshi-Variable.woff2',
      style: 'normal',
    },
    {
      path: './fonts/Satoshi-VariableItalic.woff2',
      style: 'italic',
    },
  ],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Octree',
  description: 'A latex editor that uses AI to help you write latex',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={satoshi.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ProjectProvider>
            <PostHogProvider>{children}</PostHogProvider>
          </ProjectProvider>
          <Toaster position="top-center" />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
