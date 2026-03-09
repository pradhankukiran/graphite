'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  FileType,
  FileCode,
  File,
  Trash2,
  Layers,
  Network,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Document } from '@/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const s = Math.round((now - then) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FILE_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  pdf: { icon: FileText, color: 'text-danger' },
  txt: { icon: FileType, color: 'text-blue-500' },
  docx: { icon: FileType, color: 'text-blue-600' },
  html: { icon: FileCode, color: 'text-warning' },
  md: { icon: FileCode, color: 'text-purple-500' },
};

const PROCESSING = new Set(['parsing', 'chunking', 'embedding', 'extracting', 'building_graph', 'processing']);

function getStatus(status: string): { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string; pulse: boolean } {
  if (status === 'completed') return { variant: 'success', label: 'Ready', pulse: false };
  if (status === 'failed') return { variant: 'danger', label: 'Failed', pulse: false };
  if (status === 'pending') return { variant: 'default', label: 'Pending', pulse: false };
  if (PROCESSING.has(status)) return { variant: 'warning', label: status.replace(/_/g, ' '), pulse: true };
  return { variant: 'default', label: status, pulse: false };
}

interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => Promise<void>;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ft = document.file_type.toLowerCase().replace('.', '');
  const { icon: FileIcon, color: iconColor } = FILE_ICONS[ft] || { icon: File, color: 'text-muted' };
  const { variant, label, pulse } = getStatus(document.status);

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(document.id); }
    finally { setDeleting(false); setConfirmOpen(false); }
  };

  return (
    <>
      <div
        onClick={() => router.push(`/documents/${document.id}`)}
        className={cn(
          'group relative border border-border bg-surface p-5 cursor-pointer',
          'transition-all duration-200 hover:border-charcoal',
        )}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon className={cn('h-4 w-4 shrink-0', iconColor)} strokeWidth={1.8} />
            <span className="text-base font-medium text-charcoal truncate">
              {document.filename}
            </span>
          </div>
          <Badge variant={variant} size="sm" className={cn(pulse && 'animate-pulse-soft', 'shrink-0 capitalize')}>
            {label}
          </Badge>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-muted mb-3">
          <span className="font-mono tabular-nums">{formatFileSize(document.file_size)}</span>
          {document.chunk_count != null && document.chunk_count > 0 && (
            <span className="flex items-center gap-1">
              <Layers className="h-4 w-4" /> {document.chunk_count}
            </span>
          )}
          {document.entity_count != null && document.entity_count > 0 && (
            <span className="flex items-center gap-1">
              <Network className="h-4 w-4" /> {document.entity_count}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-light">{relativeTime(document.created_at)}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="danger-ghost"
              size="icon-sm"
              onClick={() => setConfirmOpen(true)}
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <ArrowRight className="h-3.5 w-3.5 text-muted-light ml-1" />
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{document.filename}&rdquo; and all associated chunks, embeddings, and graph entities? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
