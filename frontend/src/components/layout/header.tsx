'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/documents': 'Documents',
  '/query': 'Query',
  '/graph': 'Graph Explorer',
  '/history': 'History',
  '/settings': 'Settings',
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = pageTitles[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}

export function Header() {
  const pathname = usePathname();

  const breadcrumbs = getBreadcrumbs(pathname);
  const pageTitle = pageTitles[pathname] || 'Dashboard';

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <div>
        {breadcrumbs.length > 1 && (
          <nav aria-label="Breadcrumb" className="mb-0.5 text-xs text-muted">
            <ol className="flex items-center gap-1 list-none m-0 p-0">
              {breadcrumbs.map((crumb, i) => (
                <li key={crumb.href} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-charcoal" aria-current="page">{crumb.label}</span>
                  ) : (
                    <a href={crumb.href} className="hover:text-charcoal">{crumb.label}</a>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-xl font-semibold text-charcoal">{pageTitle}</h1>
      </div>
    </header>
  );
}
