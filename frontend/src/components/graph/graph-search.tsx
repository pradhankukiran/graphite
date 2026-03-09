'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { useGraphStore, type ForceNode } from '@/stores/graph';
import type { GraphNode } from '@/types';
import { entityColors } from '@/styles/theme';
import { cn } from '@/lib/utils';

export function GraphSearch() {
  const {
    searchQuery,
    setSearchQuery,
    searchEntities,
    setSelectedNode,
    fetchNeighborhood,
    getFilteredData,
  } =
    useGraphStore();
  const [results, setResults] = React.useState<GraphNode[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFetching, setIsFetching] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearch = React.useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsFetching(true);
      try {
        const entities = await searchEntities(query);
        setResults(entities);
        setIsOpen(entities.length > 0);
        setActiveIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setIsFetching(false);
      }
    },
    [searchEntities],
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => handleSearch(value), 300);
    },
    [setSearchQuery, handleSearch],
  );

  const handleSelectResult = React.useCallback(
    async (entity: GraphNode) => {
      // Find this node in the graph data and select it
      const graphData = getFilteredData();
      const forceNode = graphData?.nodes.find((n) => n.id === entity.id);
      if (forceNode) {
        setSelectedNode(forceNode);
      } else {
        // Build a ForceNode from the search result
        const node: ForceNode = {
          id: entity.id,
          name: entity.label,
          type: entity.entity_type,
          val: 3,
          color: entityColors[entity.entity_type] || '#6C757D',
          description: (entity.properties?.description as string) || '',
          properties: entity.properties || {},
          documentIds: entity.document_ids || [],
        };
        setSelectedNode(node);
        await fetchNeighborhood(entity.id);
      }
      setIsOpen(false);
      setSearchQuery(entity.label);
    },
    [fetchNeighborhood, getFilteredData, setSelectedNode, setSearchQuery],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < results.length) {
            handleSelectResult(results[activeIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, results, activeIndex, handleSelectResult],
  );

  // Scroll active item into view
  React.useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!inputRef.current?.parentElement?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setSearchQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search entities…"
          className={cn(
            'flex h-10 w-full border-2 border-charcoal bg-background pl-8 pr-7 text-sm text-charcoal',
            'placeholder:text-muted-light',
            'focus:outline focus:outline-3 focus:outline-[#ffdd00]',
            'transition-all duration-150',
          )}
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-charcoal"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {isFetching && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal border-t-transparent" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto border border-border bg-surface"
          role="listbox"
        >
          {results.map((entity, index) => (
            <li
              key={entity.id}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-2.5 py-2 transition-colors',
                index === activeIndex
                  ? 'bg-background'
                  : 'hover:bg-background/60',
              )}
              onClick={() => handleSelectResult(entity)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entityColors[entity.entity_type] || '#8B919A' }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-charcoal">{entity.label}</p>
                <span className="text-xs text-muted">{entity.entity_type}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
