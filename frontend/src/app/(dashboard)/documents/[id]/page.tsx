'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  FileType,
  FileCode,
  File as FileIcon,
  Trash2,
  Network,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SummaryList } from '@/components/ui/summary-list';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { IngestionProgress, ChunkViewer } from '@/components/documents';
import { useDocumentsStore } from '@/stores/documents';
import { useIngestionProgress } from '@/lib/websocket/hooks';
import { usePolling } from '@/hooks/use-polling';
import { documents as documentsApi } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import type { Document } from '@/types';

// ── helpers ──────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateStr));
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSeconds = Math.round((now - then) / 1000);

  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  for (const { unit, seconds } of units) {
    const value = Math.floor(diffSeconds / seconds);
    if (value >= 1) return rtf.format(-value, unit);
  }
  return 'just now';
}

function getFileIcon(fileType: string) {
  const ext = fileType.toLowerCase().replace('.', '');
  switch (ext) {
    case 'pdf':
      return <FileText className="h-6 w-6 text-red-500" />;
    case 'txt':
      return <FileType className="h-6 w-6 text-blue-500" />;
    case 'docx':
    case 'doc':
      return <FileType className="h-6 w-6 text-blue-600" />;
    case 'html':
      return <FileCode className="h-6 w-6 text-orange-500" />;
    case 'md':
      return <FileCode className="h-6 w-6 text-purple-500" />;
    default:
      return <FileIcon className="h-6 w-6 text-muted" />;
  }
}

type StatusVariant = 'info' | 'warning' | 'success' | 'danger';

function statusBadge(status: Document['status']): {
  variant: StatusVariant;
  label: string;
} {
  switch (status) {
    case 'pending':
      return { variant: 'info', label: 'Pending' };
    case 'processing':
      return { variant: 'warning', label: 'Processing' };
    case 'completed':
      return { variant: 'success', label: 'Completed' };
    case 'failed':
      return { variant: 'danger', label: 'Failed' };
    default:
      return { variant: 'info', label: status };
  }
}

// ── component ────────────────────────────────────

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { deleteDocument } = useDocumentsStore();

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const docId = params.id;

  // Fetch document
  const fetchDocument = useCallback(async () => {
    try {
      const doc = await documentsApi.get(docId);
      setDocument(doc);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Poll when document is in a processing state
  const isProcessing =
    document?.status === 'processing' || document?.status === 'pending';

  usePolling(fetchDocument, 5_000, isProcessing);

  // WebSocket-based ingestion progress for processing documents
  const ingestionProgress = useIngestionProgress(isProcessing ? docId : null);

  const handleDelete = async () => {
    if (!document) return;
    setDeleting(true);
    try {
      await deleteDocument(document.id);
      router.push('/documents');
    } catch {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#00703c]" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Document not found.</p>
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => router.push('/documents')}
        >
          Back to Documents
        </Button>
      </div>
    );
  }

  const { variant, label } = statusBadge(document.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/documents')}
            aria-label="Back to documents"
            className="mt-0.5"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              {getFileIcon(document.file_type)}
              <h1 className="text-2xl font-semibold text-charcoal">
                {document.filename}
              </h1>
              <Badge variant={variant}>{label}</Badge>
            </div>
            {document.title && document.title !== document.filename && (
              <p className="mt-1 text-base text-muted">{document.title}</p>
            )}
          </div>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Metadata */}
      <SummaryList
        items={[
          { key: 'Type', value: document.file_type.toUpperCase() },
          { key: 'Size', value: formatFileSize(document.file_size) },
          { key: 'Uploaded', value: relativeTime(document.created_at) },
          ...(document.chunk_count != null ? [{ key: 'Chunks', value: String(document.chunk_count) }] : []),
          ...(document.entity_count != null ? [{ key: 'Entities', value: String(document.entity_count) }] : []),
        ]}
      />

      {/* Ingestion progress (shown when processing) */}
      {isProcessing && <IngestionProgress progress={ingestionProgress} />}

      {/* Error message */}
      {document.status === 'failed' && document.error_message && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
          <p className="text-base font-medium text-danger">Ingestion Error</p>
          <p className="mt-1 text-base text-charcoal-light">
            {document.error_message}
          </p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="chunks">
        <TabsList>
          <TabsTrigger value="chunks">Chunks</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="chunks">
          {document.status === 'completed' ||
          (document.chunk_count != null && document.chunk_count > 0) ? (
            <ChunkViewer documentId={document.id} />
          ) : (
            <p className="py-8 text-center text-sm text-muted">
              {isProcessing
                ? 'Chunks will appear here once parsing is complete.'
                : 'No chunks available for this document.'}
            </p>
          )}
        </TabsContent>

        <TabsContent value="graph">
          <div className="flex flex-col items-center justify-center py-16">
            <Network className="mb-3 h-12 w-12 text-muted/50" />
            <p className="text-sm text-muted">
              Graph visualization will be available in Phase 3.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="metadata">
          <Card>
            <CardContent className="p-5">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-background p-4 text-sm text-charcoal-light">
                {JSON.stringify(
                  {
                    id: document.id,
                    title: document.title,
                    filename: document.filename,
                    file_type: document.file_type,
                    file_size: document.file_size,
                    status: document.status,
                    page_count: document.page_count,
                    chunk_count: document.chunk_count,
                    entity_count: document.entity_count,
                    uploaded_by: document.uploaded_by,
                    created_at: document.created_at,
                    updated_at: document.updated_at,
                    error_message: document.error_message,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{document.filename}
              &rdquo;? This action cannot be undone. All associated chunks,
              embeddings, and graph entities will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
