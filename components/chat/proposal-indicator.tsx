import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProposalIndicator as ProposalIndicatorType } from './use-edit-proposals';

interface ProposalIndicatorProps {
  indicator: ProposalIndicatorType;
}

export function ProposalIndicator({ indicator }: ProposalIndicatorProps) {
  if (indicator.state === 'pending') {
    return (
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-2 py-1 text-blue-700">
          <Loader2 className="h-3 w-3 animate-spin" />
          Proposing edits
          {typeof indicator.count === 'number' && ` (${indicator.count})`}
        </span>
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
    return (
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Proposed {indicator.count ?? 0} edit
          {indicator.count !== 1 ? 's' : ''}
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

