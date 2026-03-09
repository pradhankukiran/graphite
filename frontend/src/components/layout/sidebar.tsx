'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  MessageSquare,
  Network,
  Clock,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { href: '/query', label: 'Query', icon: MessageSquare, shortcut: '1' },
  { href: '/documents', label: 'Documents', icon: FileText, shortcut: '2' },
  { href: '/graph', label: 'Graph', icon: Network, shortcut: '3' },
  { href: '/history', label: 'History', icon: Clock, shortcut: '4' },
];

const bottomItems = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey) return;
      const item = navItems.find(n => n.shortcut === e.key);
      if (item) window.location.href = item.href;
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-[#0b0c0e] border-r border-[#505a5f]',
          'transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          collapsed ? 'w-[52px]' : 'w-[260px]',
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center shrink-0',
          collapsed ? 'justify-center px-0' : 'px-4',
        )}>
          <Link href="/query" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center bg-teal shrink-0
                          transition-[border-color] duration-200">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <polygon points="7.3,7 6.2,8.9 4,8.9 2.9,7 4,5.1 6.2,5.1" fill="white" fillOpacity="0.9"/>
                <polygon points="11.1,4.8 10,6.7 7.8,6.7 6.7,4.8 7.8,2.9 10,2.9" fill="white" fillOpacity="0.9"/>
                <polygon points="11.1,9.2 10,11.1 7.8,11.1 6.7,9.2 7.8,7.3 10,7.3" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            {!collapsed && (
              <span className="text-[17px] font-semibold tracking-tight text-white">
                Graphite
              </span>
            )}
          </Link>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-[#505a5f]" />

        {/* Main nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const content = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-2.5 px-3 py-2.5 text-[15px] font-medium',
                  'transition-all duration-150',
                  isActive
                    ? 'bg-white/[0.12] text-white border-l-[3px] border-white'
                    : 'text-[#b1b4b6] hover:text-white hover:bg-white/[0.08]',
                  collapsed && 'justify-center px-0',
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-white')} strokeWidth={1.8} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    <kbd className={cn(
                      'text-xs font-normal tracking-wide text-[#b1b4b6] opacity-0 group-hover:opacity-100',
                      'transition-opacity duration-150',
                      isActive && 'opacity-60',
                    )}>
                      {item.shortcut}
                    </kbd>
                  </>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="text-xs">
                    {item.label}
                    <span className="ml-2 text-[#b1b4b6]">{item.shortcut}</span>
                  </TooltipContent>
                </Tooltip>
              );
            }
            return content;
          })}
        </nav>

        {/* Bottom nav */}
        <div className="px-2 pb-1 space-y-0.5">
          {bottomItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const content = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 text-[15px] font-medium',
                  'transition-all duration-150',
                  isActive
                    ? 'text-white bg-white/[0.08]'
                    : 'text-[#b1b4b6] hover:text-white hover:bg-white/[0.08]',
                  collapsed && 'justify-center px-0',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="text-xs">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return content;
          })}
        </div>

        {/* Collapse toggle */}
        <div className="px-2 pb-2">
          <div className="h-px bg-[#505a5f] mx-1 mb-2" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-[15px] text-[#b1b4b6]',
                  'transition-all duration-150 hover:text-white hover:bg-white/[0.08]',
                  collapsed && 'justify-center px-0',
                )}
                aria-label={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? (
                  <PanelLeft className="h-5 w-5" strokeWidth={1.8} />
                ) : (
                  <>
                    <PanelLeftClose className="h-5 w-5" strokeWidth={1.8} />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" sideOffset={8} className="text-xs">Expand sidebar</TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
