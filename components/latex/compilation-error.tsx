import React from 'react';
import {
  AlertCircle,
  FileText,
  X,
  RefreshCw,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CompilationError } from '@/types/compilation';
import { formatCompilationErrorForClipboard } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CompilationErrorProps {
  error: CompilationError;
  onRetry?: () => void;
  onDismiss?: () => void;
  onFixWithAI?: () => void;
  className?: string;
}

export function CompilationError({
  error,
  onRetry,
  onDismiss,
  onFixWithAI,
  className,
}: CompilationErrorProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div
      className={cn(
        className ||
          'fixed left-1/2 top-20 z-50 w-full max-w-4xl -translate-x-1/2 transform px-4'
      )}
    >
      <Card className="bg-white backdrop-blur-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Compilation Failed
              </CardTitle>
            </div>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Main Error Message */}
          <div className="space-y-3">
            <p className="font-medium leading-relaxed text-slate-900">
              {error.message}
            </p>
            {error.details && (
              <p className="text-sm leading-relaxed text-slate-600">
                {error.details}
              </p>
            )}
            {error.summary && (
              <div className="rounded-r border-l-2 border-red-500 bg-slate-50 p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">
                  {error.summary}
                </pre>
              </div>
            )}
          </div>

          {/* Error Metadata */}
          {error.code !== undefined && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-50 font-mono text-xs text-slate-700"
              >
                Exit: {error.code}
              </Badge>
              {typeof error.queueMs === 'number' && (
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-50 font-mono text-xs text-slate-700"
                >
                  Queue: {error.queueMs}ms
                </Badge>
              )}
              {typeof error.durationMs === 'number' && (
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-50 font-mono text-xs text-slate-700"
                >
                  Duration: {error.durationMs}ms
                </Badge>
              )}
              {error.requestId && (
                <Badge
                  variant="outline"
                  className="max-w-[200px] truncate border-slate-200 bg-slate-50 font-mono text-xs text-slate-700"
                >
                  {error.requestId}
                </Badge>
              )}
            </div>
          )}

          {/* Toggle Details Button */}
          {(error.log || error.stdout || error.stderr) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="-ml-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <FileText className="mr-2 h-4 w-4" />
              {showDetails ? 'Hide' : 'Show'} Technical Details
            </Button>
          )}

          {/* Detailed Error Information */}
          {showDetails && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              {/* LaTeX Log */}
              {error.log && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-900">
                    LaTeX Log
                  </h4>
                  <pre className="max-h-40 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
                    {error.log}
                  </pre>
                </div>
              )}

              {/* Standard Output */}
              {error.stdout && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-900">
                    Output
                  </h4>
                  <pre className="max-h-40 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
                    {error.stdout}
                  </pre>
                </div>
              )}

              {/* Standard Error */}
              {error.stderr && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-900">
                    Error Stream
                  </h4>
                  <pre className="max-h-40 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
                    {error.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 border-t border-slate-100 pt-4">
            {onFixWithAI && (
              <Button onClick={onFixWithAI}>
                <WandSparkles className="h-4 w-4" />
                Fix with AI
              </Button>
            )}
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                const errorText = formatCompilationErrorForClipboard(error);
                navigator.clipboard.writeText(errorText);
              }}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Copy Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
