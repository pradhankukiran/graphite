'use client';

import { useState, useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import {
  Upload,
  FileText,
  FileType,
  FileCode,
  File as FileIcon,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ── helpers ──────────────────────────────────────

const ACCEPT: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
  ],
  'text/html': ['.html'],
  'text/markdown': ['.md'],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />;
    case 'txt':
      return <FileType className="h-5 w-5 text-blue-500" />;
    case 'docx':
    case 'doc':
      return <FileType className="h-5 w-5 text-blue-600" />;
    case 'html':
      return <FileCode className="h-5 w-5 text-orange-500" />;
    case 'md':
      return <FileCode className="h-5 w-5 text-purple-500" />;
    default:
      return <FileIcon className="h-5 w-5 text-muted" />;
  }
}

function rejectionMessage(rejection: FileRejection): string {
  const errors = rejection.errors.map((e) => {
    if (e.code === 'file-too-large')
      return `File exceeds ${formatFileSize(MAX_SIZE)} limit`;
    if (e.code === 'file-invalid-type') return 'Unsupported file type';
    return e.message;
  });
  return `${rejection.file.name}: ${errors.join(', ')}`;
}

// ── component ────────────────────────────────────

interface UploadDropzoneProps {
  onUpload: (files: File[]) => Promise<void>;
  uploading?: boolean;
  uploadProgress?: number; // 0-100
}

export function UploadDropzone({
  onUpload,
  uploading = false,
  uploadProgress = 0,
}: UploadDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setSelectedFiles((prev) => [...prev, ...accepted]);
      setErrors(rejected.map(rejectionMessage));
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_SIZE,
    multiple: true,
    disabled: uploading,
  });

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setErrors([]);
    await onUpload(selectedFiles);
    // Files are cleared by the parent after successful upload via re-render
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center border-2 border-dashed p-10 transition-colors',
          isDragActive
            ? 'border-charcoal bg-[#f3f2f1]'
            : 'border-charcoal/40 hover:border-charcoal hover:bg-[#f3f2f1]/50',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input {...getInputProps()} />
        <div className="mb-3 flex h-14 w-14 items-center justify-center bg-[#f3f2f1]">
          <Upload className="h-6 w-6 text-charcoal" />
        </div>
        {isDragActive ? (
          <p className="text-sm font-medium text-charcoal">
            Drop files here...
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-charcoal">
              Drag & drop files here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted">
              PDF, TXT, DOCX, HTML, MD &mdash; max {formatFileSize(MAX_SIZE)}
            </p>
          </>
        )}
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          ))}
        </div>
      )}

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-charcoal">
            {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}{' '}
            selected
          </p>
          <ul className="space-y-1">
            {selectedFiles.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 border border-border bg-surface px-3 py-2"
              >
                {fileIcon(file.name)}
                <span className="flex-1 truncate text-sm text-charcoal">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {formatFileSize(file.size)}
                </span>
                {!uploading && (
                  <button
                    type="button"
                    className="ml-1 p-0.5 text-muted hover:text-danger"
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} />
          <p className="text-center text-xs text-muted">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Upload button */}
      <Button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || uploading}
        loading={uploading}
        className="w-full"
      >
        <Upload className="mr-2 h-4 w-4" />
        Upload & Process
      </Button>
    </div>
  );
}
