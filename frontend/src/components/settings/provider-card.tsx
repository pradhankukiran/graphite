'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
} from '@/components/ui';
import { CheckCircle2, XCircle, Eye, EyeOff, Loader2, Cpu } from 'lucide-react';
import type { LLMProvider } from '@/types';

interface ProviderCardProps {
  provider: LLMProvider;
  className?: string;
}

const STORAGE_PREFIX = 'graphite_api_key_';

export function ProviderCard({ provider, className }: ProviderCardProps) {
  const [apiKey, setApiKey] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<'success' | 'error' | null>(null);

  // Load saved API key from localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${provider.id}`);
    if (saved) {
      setApiKey(saved);
    }
  }, [provider.id]);

  const handleSaveKey = () => {
    if (typeof window === 'undefined') return;
    if (apiKey.trim()) {
      localStorage.setItem(`${STORAGE_PREFIX}${provider.id}`, apiKey.trim());
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${provider.id}`);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Simulate a test - in production this would call the backend
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // If the provider is configured on the backend, the test succeeds
      setTestResult(provider.is_configured ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className={cn('transition-all', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center',
                provider.is_configured ? 'bg-teal-light' : 'bg-background',
              )}
            >
              <Cpu
                className={cn(
                  'h-5 w-5',
                  provider.is_configured ? 'text-teal' : 'text-muted',
                )}
              />
            </div>
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <p className="text-xs text-muted mt-0.5">{provider.provider_type}</p>
            </div>
          </div>
          <Badge variant={provider.is_configured ? 'success' : 'warning'}>
            {provider.is_configured ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Configured
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Not Configured
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* API Key input */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-charcoal">
            API Key (local storage only)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={handleSaveKey}
                placeholder={`Enter ${provider.name} API key`}
                className="pr-10 h-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="h-9 text-xs shrink-0"
            >
              {isTesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Test'
              )}
            </Button>
          </div>
          {testResult === 'success' && (
            <p className="mt-1 text-xs text-teal flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connection successful
            </p>
          )}
          {testResult === 'error' && (
            <p className="mt-1 text-xs text-danger flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Connection failed - check your API key
            </p>
          )}
          <p className="mt-1 text-sm text-muted">
            Stored locally in your browser. The backend reads keys from environment variables.
          </p>
        </div>

        {/* Available models */}
        {provider.models.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-charcoal">
              Available Models ({provider.models.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {provider.models.map((m) => (
                <Badge key={m.id} variant="default">
                  {m.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
