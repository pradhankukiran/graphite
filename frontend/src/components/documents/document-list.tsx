'use client';

import { useState, useMemo } from 'react';
import { Search, FileText, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { DocumentCard } from './document-card';
import type { Document } from '@/types';

function Skeleton() {
  return (
    <div className="border border-border bg-surface p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-background animate-shimmer" />
          <div className="h-4 w-32 bg-background animate-shimmer" />
        </div>
        <div className="h-5 w-14 bg-background animate-shimmer" />
      </div>
      <div className="flex gap-3 mb-3">
        <div className="h-3 w-12 bg-background animate-shimmer" />
        <div className="h-3 w-16 bg-background animate-shimmer" />
      </div>
      <div className="h-3 w-20 bg-background animate-shimmer" />
    </div>
  );
}

type SortOption = 'newest' | 'oldest' | 'name';

interface DocumentListProps {
  documents: Document[];
  isLoading: boolean;
  onDelete: (id: string) => Promise<void>;
  onUpload: () => void;
}

export function DocumentList({
  documents,
  isLoading,
  onDelete,
  onUpload,
}: DocumentListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = [...documents];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.filename.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }
    switch (sort) {
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'oldest': result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'name': result.sort((a, b) => a.filename.localeCompare(b.filename)); break;
    }
    return result;
  }, [documents, search, statusFilter, sort]);

  if (isLoading && documents.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-8 pr-3 text-sm border-2 border-charcoal bg-surface
                       text-charcoal placeholder:text-muted-light
                       focus:outline focus:outline-3 focus:outline-[#ffdd00]
                       transition-all duration-150"
          />
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? 'text-teal bg-teal/[0.06]' : 'text-muted'}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>

        {showFilters && (
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[120px] text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="h-10 w-[110px] text-sm">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {/* Count */}
        <span className="text-sm text-muted ml-auto tabular-nums">
          {filtered.length} document{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={documents.length === 0 ? 'No documents yet' : 'No matches'}
          description={
            documents.length === 0
              ? 'Upload your first document to get started with GraphRAG.'
              : 'Try a different search or filter.'
          }
          action={
            documents.length === 0 ? (
              <Button onClick={onUpload} size="sm">Upload document</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 stagger-children">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
