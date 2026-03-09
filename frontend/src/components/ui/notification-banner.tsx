'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface NotificationBannerProps {
  type: 'success' | 'info' | 'warning';
  title: string;
  children: React.ReactNode;
  className?: string;
}

const bannerStyles = {
  success: 'border-teal bg-teal-light',
  info: 'border-[#1d70b8] bg-blue-50',
  warning: 'border-warning bg-warning-light',
} as const;

export function NotificationBanner({ type, title, children, className }: NotificationBannerProps) {
  const titleId = React.useId();

  return (
    <div
      role={type === 'success' ? 'alert' : 'region'}
      aria-labelledby={titleId}
      className={cn(
        'border-l-4 p-5',
        bannerStyles[type],
        className,
      )}
    >
      <h2 id={titleId} className="text-lg font-bold text-charcoal">
        {title}
      </h2>
      <div className="mt-2 text-base text-charcoal">{children}</div>
    </div>
  );
}
