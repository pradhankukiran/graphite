'use client';

import * as React from 'react';
import { useQueryStore } from '@/stores/query';
import { ProviderCard } from '@/components/settings/provider-card';
import {
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Spinner,
} from '@/components/ui';
import { CheckCircle2, Cpu, Save, SlidersHorizontal } from 'lucide-react';
import type { QueryMode } from '@/types';

const PREFS_KEY = 'graphite_user_preferences';

interface UserPreferences {
  defaultMode: QueryMode;
  defaultProvider: string;
  defaultModel: string;
}

function normalizeMode(value: unknown): QueryMode {
  return value === 'graph' ? 'graph' : 'plain';
}

function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return { defaultMode: 'plain', defaultProvider: '', defaultModel: '' };
  }

  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (!saved) {
      return { defaultMode: 'plain', defaultProvider: '', defaultModel: '' };
    }

    const parsed = JSON.parse(saved) as Partial<{
      defaultMode: string;
      defaultProvider: string;
      defaultModel: string;
    }>;
    return {
      defaultMode: normalizeMode(parsed.defaultMode),
      defaultProvider: parsed.defaultProvider || '',
      defaultModel: parsed.defaultModel || '',
    };
  } catch {
    return { defaultMode: 'plain', defaultProvider: '', defaultModel: '' };
  }
}

function savePreferences(prefs: UserPreferences) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export default function SettingsPage() {
  const { availableProviders, fetchProviders } = useQueryStore();

  const [prefs, setPrefs] = React.useState<UserPreferences>(loadPreferences);
  const [saved, setSaved] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      setIsLoadingData(true);
      await fetchProviders();
      setIsLoadingData(false);
    };
    load();
  }, [fetchProviders]);

  const handleSavePreferences = () => {
    savePreferences(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updatePref = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const selectedProvider = availableProviders.find(
    (provider) => provider.id === prefs.defaultProvider,
  );
  const models = selectedProvider?.models || [];

  React.useEffect(() => {
    if (availableProviders.length === 0) return;

    const fallbackProvider =
      selectedProvider || availableProviders.find((provider) => provider.is_configured);

    if (!fallbackProvider) return;

    const nextModel = fallbackProvider.models[0]?.model_id || '';
    const modelStillValid = fallbackProvider.models.some(
      (model) => model.model_id === prefs.defaultModel,
    );

    if (prefs.defaultProvider !== fallbackProvider.id) {
      setPrefs((prev) => ({
        ...prev,
        defaultProvider: fallbackProvider.id,
        defaultModel: nextModel,
      }));
      return;
    }

    if (!modelStillValid && prefs.defaultModel !== nextModel) {
      setPrefs((prev) => ({
        ...prev,
        defaultModel: nextModel,
      }));
    }
  }, [availableProviders, prefs.defaultModel, prefs.defaultProvider, selectedProvider]);

  if (isLoadingData) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-charcoal">Settings</h1>
          <p className="mt-1 text-base text-muted">
            Configure providers and default query behavior.
          </p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-charcoal">Settings</h1>
        <p className="mt-1 text-base text-muted">
          Configure providers and default query behavior.
        </p>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-[#00703c]" />
          <h2 className="text-xl font-semibold text-charcoal">LLM Providers</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {availableProviders.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
          {availableProviders.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-8 text-center">
                <Cpu className="mx-auto mb-2 h-8 w-8 text-muted" />
                <p className="text-sm text-muted">
                  No providers available. Configure providers in your backend environment.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <Separator />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-[#00703c]" />
          <h2 className="text-xl font-semibold text-charcoal">Default Preferences</h2>
        </div>

        <Card>
          <CardContent className="space-y-5 py-6">
            <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
              <label className="text-base font-medium text-charcoal">Default Query Mode</label>
              <Select
                value={prefs.defaultMode}
                onValueChange={(value) => updatePref('defaultMode', normalizeMode(value))}
              >
                <SelectTrigger className="h-11 w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain RAG</SelectItem>
                  <SelectItem value="graph">GraphRAG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
              <label className="text-base font-medium text-charcoal">Default Provider</label>
              <Select
                value={prefs.defaultProvider}
                onValueChange={(value) => {
                  updatePref('defaultProvider', value);
                  const provider = availableProviders.find((item) => item.id === value);
                  updatePref('defaultModel', provider?.models[0]?.model_id || '');
                }}
              >
                <SelectTrigger className="h-11 w-[260px]">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
              <label className="text-base font-medium text-charcoal">Default Model</label>
              <Select
                value={prefs.defaultModel}
                onValueChange={(value) => updatePref('defaultModel', value)}
              >
                <SelectTrigger className="h-11 w-[260px]">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.model_id}>
                      {model.name}
                    </SelectItem>
                  ))}
                  {models.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Select a provider first
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Button onClick={handleSavePreferences} className="gap-2">
                {saved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Preferences
                  </>
                )}
              </Button>
              {saved && (
                <span className="text-xs text-[#00703c]">
                  Preferences saved to local storage
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
