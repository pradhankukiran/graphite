'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatsCards, DocumentList } from '@/components/documents';
import { useDocumentsStore } from '@/stores/documents';
import { usePolling } from '@/hooks/use-polling';

export default function DocumentsPage() {
  const router = useRouter();
  const {
    documents,
    isLoading,
    stats,
    fetchDocuments,
    fetchStats,
    deleteDocument,
  } = useDocumentsStore();

  useEffect(() => {
    fetchDocuments();
    fetchStats();
  }, [fetchDocuments, fetchStats]);

  const hasProcessing = documents.some(
    (d) => d.status === 'processing' || d.status === 'pending',
  );

  const pollCallback = useCallback(async () => {
    await fetchDocuments();
    await fetchStats();
  }, [fetchDocuments, fetchStats]);

  usePolling(pollCallback, 10_000, hasProcessing);

  const totalDocuments = stats?.total ?? documents.length;
  const processing = stats?.processing ?? documents.filter((d) => d.status === 'processing' || d.status === 'pending').length;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count ?? 0), 0);
  const totalEntities = documents.reduce((sum, d) => sum + (d.entity_count ?? 0), 0);

  return (
    <div className="px-10 py-10 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-charcoal">Documents</h1>
          <p className="text-base text-muted mt-1">
            Upload and manage documents for knowledge graph construction.
          </p>
        </div>
        <Button onClick={() => router.push('/documents/upload')} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Upload
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <StatsCards
          totalDocuments={totalDocuments}
          totalChunks={totalChunks}
          totalEntities={totalEntities}
          processing={processing}
        />
      </div>

      {/* Document list */}
      <DocumentList
        documents={documents}
        isLoading={isLoading}
        onDelete={deleteDocument}
        onUpload={() => router.push('/documents/upload')}
      />
    </div>
  );
}
