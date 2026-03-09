'use client';

import {
  FileText,
  Scissors,
  Binary,
  Brain,
  Network,
  Check,
  Loader2,
  Circle,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { IngestionProgress as IngestionProgressType } from '@/lib/websocket/hooks';
import type { LucideIcon } from 'lucide-react';

// ── pipeline stages ──────────────────────────────

interface StageInfo {
  key: string;
  label: string;
  icon: LucideIcon;
}

const STAGES: StageInfo[] = [
  { key: 'parsing', label: 'Parse', icon: FileText },
  { key: 'chunking', label: 'Chunk', icon: Scissors },
  { key: 'embedding', label: 'Embed', icon: Binary },
  { key: 'extracting', label: 'Extract', icon: Brain },
  { key: 'building_graph', label: 'Build Graph', icon: Network },
];

type StageStatus = 'pending' | 'running' | 'completed' | 'failed';

function getStageStatus(
  stageKey: string,
  currentStage: string,
  overallStatus: IngestionProgressType['status'],
): StageStatus {
  if (overallStatus === 'completed') return 'completed';

  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);
  const stageIdx = STAGES.findIndex((s) => s.key === stageKey);

  if (stageIdx < 0 || currentIdx < 0) {
    // If no match, treat everything as pending
    return 'pending';
  }

  if (overallStatus === 'failed' && stageIdx === currentIdx) return 'failed';
  if (stageIdx < currentIdx) return 'completed';
  if (stageIdx === currentIdx) return 'running';
  return 'pending';
}

function StageIndicator({ status }: { status: StageStatus }) {
  switch (status) {
    case 'completed':
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-light">
          <Check className="h-4 w-4 text-teal" />
        </div>
      );
    case 'running':
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-light">
          <Loader2 className="h-4 w-4 animate-spin text-teal" />
        </div>
      );
    case 'failed':
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-danger/15">
          <AlertCircle className="h-4 w-4 text-danger" />
        </div>
      );
    default:
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background">
          <Circle className="h-4 w-4 text-muted" />
        </div>
      );
  }
}

// ── component ────────────────────────────────────

interface IngestionProgressProps {
  progress: IngestionProgressType;
  onRetry?: () => void;
}

export function IngestionProgress({ progress, onRetry }: IngestionProgressProps) {
  const { stage, progress: percent, status, message } = progress;

  return (
    <div className="space-y-4 border border-border bg-surface p-5">
      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-charcoal">Ingestion Progress</span>
          <span className="text-muted">{Math.round(percent)}%</span>
        </div>
        <Progress value={percent} />
      </div>

      {/* Pipeline stages */}
      <div className="flex items-center justify-between gap-1">
        {STAGES.map((s, i) => {
          const stageStatus = getStageStatus(s.key, stage, status);
          const StageIcon = s.icon;
          return (
            <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                {i > 0 && (
                  <div
                    className={cn(
                      'hidden h-px w-4 sm:block',
                      stageStatus === 'completed' || stageStatus === 'running'
                        ? 'bg-teal'
                        : 'bg-border',
                    )}
                  />
                )}
                <StageIndicator status={stageStatus} />
              </div>
              <span
                className={cn(
                  'text-sm',
                  stageStatus === 'running'
                    ? 'font-medium text-teal'
                    : stageStatus === 'completed'
                      ? 'text-teal'
                      : stageStatus === 'failed'
                        ? 'text-danger'
                        : 'text-muted',
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current message */}
      {message && (
        <p
          className={cn(
            'text-center text-sm',
            status === 'failed' ? 'text-danger' : 'text-muted',
          )}
        >
          {message}
        </p>
      )}

      {/* Error + retry */}
      {status === 'failed' && onRetry && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
