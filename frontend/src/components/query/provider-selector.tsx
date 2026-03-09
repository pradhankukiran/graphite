'use client';

import * as React from 'react';
import { useQueryStore } from '@/stores/query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { Badge } from '@/components/ui';

export function ProviderSelector() {
  const {
    provider,
    model,
    availableProviders,
    setProvider,
    setModel,
    fetchProviders,
  } = useQueryStore();

  React.useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const currentProvider = availableProviders.find((item) => item.id === provider);
  const models = currentProvider?.models || [];

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const nextProvider = availableProviders.find((item) => item.id === value);
    if (nextProvider && nextProvider.models.length > 0) {
      setModel(nextProvider.models[0].model_id);
    } else {
      setModel('');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={provider} onValueChange={handleProviderChange}>
        <SelectTrigger className="h-9 w-auto min-w-[100px] gap-1 border-border/40 bg-transparent px-2 text-sm shadow-none">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          {availableProviders.map((item) => (
            <SelectItem key={item.id} value={item.id} disabled={!item.is_configured}>
              <div className="flex items-center gap-2">
                <span>{item.name}</span>
                {!item.is_configured && (
                  <Badge variant="warning" size="sm">
                    no key
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
          {availableProviders.length === 0 && (
            <SelectItem value="_none" disabled>
              No providers
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <span className="text-border">/</span>

      <Select value={model} onValueChange={setModel}>
        <SelectTrigger className="h-9 w-auto min-w-[120px] gap-1 border-border/40 bg-transparent px-2 text-sm shadow-none">
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((item) => (
            <SelectItem key={item.id} value={item.model_id}>
              {item.name}
            </SelectItem>
          ))}
          {models.length === 0 && (
            <SelectItem value="_none" disabled>
              No models
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
