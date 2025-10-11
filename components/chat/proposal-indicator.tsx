import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  ProposalIndicator as ProposalIndicatorType,
  ProposalStepState,
} from './use-edit-proposals';

interface ProposalIndicatorProps {
  indicator: ProposalIndicatorType;
}

export function ProposalIndicator({ indicator }: ProposalIndicatorProps) {
  if (indicator.state === 'pending') {
    const totalSteps = indicator.count ?? indicator.stepStates?.length ?? 1;
    const steps: ProposalStepState[] = indicator.stepStates ?? [];
    return (
      <div className="mb-2 flex items-center gap-2 text-xs">
        <div className="inline-flex items-center gap-3 rounded-full bg-blue-100/80 px-3 py-1 text-blue-700">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Proposing edits</span>
            {totalSteps > 1 && indicator.progressCount !== undefined && (
              <span className="text-[0.7rem] text-blue-600">
              {Math.min(indicator.progressCount, totalSteps)}/{totalSteps}
              </span>
            )}
          </div>
          {totalSteps > 1 && (
            <span className="flex items-center gap-1">
              {Array.from({ length: totalSteps }, (_, idx) => {
                const state = steps[idx] ?? 'queued';
                const baseClass =
                  'h-1.5 w-1.5 rounded-full transition-all duration-200';
                const stateClass =
                  state === 'success'
                    ? 'bg-emerald-600'
                    : state === 'pending'
                      ? 'bg-blue-600 animate-pulse'
                      : 'bg-blue-300/70';
                return (
                  <span
                    key={`step-${idx}`}
                    className={`${baseClass} ${stateClass}`}
                    aria-hidden
                  />
                );
              })}
            </span>
          )}
        </div>
        {indicator.violations ? (
          <span className="inline-flex items-center gap-1 text-[0.7rem] text-amber-600">
            <AlertCircle className="h-3 w-3" />
            {indicator.violations} blocked
          </span>
        ) : null}
      </div>
    );
  }

  if (indicator.state === 'success') {
    const total = indicator.count ?? indicator.progressCount ?? 0;
    return (
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Proposed {total || 1} edit{total === 1 ? '' : 's'}
        </span>
      </div>
    );
  }

  if (indicator.state === 'error') {
    return (
      <div className="mb-2 flex flex-col gap-1">
        <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
        {indicator.errorMessage && (
          <span className="text-xs text-rose-600">{indicator.errorMessage}</span>
        )}
      </div>
    );
  }

  return null;
}

