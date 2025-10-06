import React from 'react';
import { AlertCircle, FileText, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CompilationErrorProps {
  error: {
    message: string;
    details?: string;
    log?: string;
    stdout?: string;
    stderr?: string;
    code?: number;
    requestId?: string | null;
    queueMs?: number | null;
    durationMs?: number | null;
    summary?: string;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
  onFixWithAI?: () => void;
}

export function CompilationError({ error, onRetry, onDismiss, onFixWithAI }: CompilationErrorProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4">
      <Card className="border-red-500/20 bg-white shadow-2xl backdrop-blur-sm">
        <CardHeader className="border-b border-red-500/10 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-slate-900 text-lg font-semibold">
                Compilation Failed
              </CardTitle>
            </div>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-6">
          {/* Main Error Message */}
          <div className="space-y-3">
            <p className="text-slate-900 font-medium leading-relaxed">{error.message}</p>
            {error.details && (
              <p className="text-slate-600 text-sm leading-relaxed">{error.details}</p>
            )}
            {error.summary && (
              <div className="bg-slate-50 border-l-2 border-red-500 rounded-r p-4">
                <pre className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                  {error.summary}
                </pre>
              </div>
            )}
          </div>

          {/* Error Metadata */}
          {error.code !== undefined && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 text-xs font-mono">
                Exit: {error.code}
              </Badge>
              {typeof error.queueMs === 'number' && (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 text-xs font-mono">
                  Queue: {error.queueMs}ms
                </Badge>
              )}
              {typeof error.durationMs === 'number' && (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 text-xs font-mono">
                  Duration: {error.durationMs}ms
                </Badge>
              )}
              {error.requestId && (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 text-xs font-mono truncate max-w-[200px]">
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
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 -ml-2"
            >
              <FileText className="h-4 w-4 mr-2" />
              {showDetails ? 'Hide' : 'Show'} Technical Details
            </Button>
          )}

          {/* Detailed Error Information */}
          {showDetails && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              {/* LaTeX Log */}
              {error.log && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">LaTeX Log</h4>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 overflow-x-auto max-h-40 font-mono leading-relaxed">
                    {error.log}
                  </pre>
                </div>
              )}

              {/* Standard Output */}
              {error.stdout && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Output</h4>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 overflow-x-auto max-h-40 font-mono leading-relaxed">
                    {error.stdout}
                  </pre>
                </div>
              )}

              {/* Standard Error */}
              {error.stderr && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Error Stream</h4>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 overflow-x-auto max-h-40 font-mono leading-relaxed">
                    {error.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            {onFixWithAI && (
              <Button
                onClick={onFixWithAI}
                className="bg-red-500 hover:bg-red-600 text-white shadow-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Fix with AI
              </Button>
            )}
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                className="text-slate-700 border-slate-200 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                // Copy error details to clipboard
                const errorText = [
                  `Error: ${error.message}`,
                  error.details && `Details: ${error.details}`,
                  error.requestId && `Request ID: ${error.requestId}`,
                  typeof error.queueMs === 'number' && `Queue: ${error.queueMs}ms`,
                  typeof error.durationMs === 'number' && `Duration: ${error.durationMs}ms`,
                  error.summary && `Summary:\n${error.summary}`,
                  error.log && `Log:\n${error.log}`,
                  error.stdout && `Output:\n${error.stdout}`,
                  error.stderr && `Errors:\n${error.stderr}`
                ].filter(Boolean).join('\n\n');
                
                navigator.clipboard.writeText(errorText);
              }}
              className="text-slate-700 border-slate-200 hover:bg-slate-50"
            >
              Copy Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
