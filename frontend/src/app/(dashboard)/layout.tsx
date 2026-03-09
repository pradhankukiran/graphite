'use client';

import * as React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { SkipLink } from '@/components/ui/skip-link';
import { Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, fetchUser } = useAuthStore();

  React.useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SkipLink />
      <Sidebar />
      <main id="main-content" className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
