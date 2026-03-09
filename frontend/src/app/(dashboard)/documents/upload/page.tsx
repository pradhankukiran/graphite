'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadDropzone, IngestionProgress } from '@/components/documents';
import { useDocumentsStore } from '@/stores/documents';
import { useIngestionProgress } from '@/lib/websocket/hooks';
import type { Document } from '@/types';

// Track progress for a single uploaded document
function UploadedDocumentProgress({
  document,
}: {
  document: Document;
}) {
  const progress = useIngestionProgress(document.id);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-charcoal">{document.filename}</p>
      <IngestionProgress progress={progress} />
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { uploadDocument } = useDocumentsStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState<Document[]>([]);

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadedDocs([]);

    const uploaded: Document[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      try {
        const doc = await uploadDocument(files[i]);
        uploaded.push(doc);
      } catch {
        // Individual file upload failure: continue with others
      }
      setUploadProgress(Math.round(((i + 1) / total) * 100));
    }

    setUploadedDocs(uploaded);
    setUploading(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/documents')}
          aria-label="Back to documents"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-charcoal">
            Upload Documents
          </h1>
          <p className="text-sm text-muted">
            Upload files to begin knowledge graph extraction.
          </p>
        </div>
      </div>

      {/* Upload dropzone */}
      {uploadedDocs.length === 0 && (
        <UploadDropzone
          onUpload={handleUpload}
          uploading={uploading}
          uploadProgress={uploadProgress}
        />
      )}

      {/* Ingestion progress for each uploaded document */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-charcoal">
              Processing {uploadedDocs.length} document
              {uploadedDocs.length > 1 ? 's' : ''}
            </h2>
            <Button variant="outline" onClick={() => setUploadedDocs([])}>
              Upload More
            </Button>
          </div>
          {uploadedDocs.map((doc) => (
            <UploadedDocumentProgress key={doc.id} document={doc} />
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/documents')}
          >
            Back to Documents
          </Button>
        </div>
      )}
    </div>
  );
}
