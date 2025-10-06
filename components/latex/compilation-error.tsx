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
}

export function CompilationError({ error, onRetry, onDismiss }: CompilationErrorProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4">
      <Card className="border-red-200 bg-red-50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800 text-lg">
                LaTeX Compilation Failed
              </CardTitle>
            </div>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Main Error Message */}
          <div className="space-y-2">
            <p className="text-red-700 font-medium">{error.message}</p>
            {error.details && (
              <p className="text-red-600 text-sm">{error.details}</p>
            )}
            {error.summary && (
              <p className="text-red-600 text-xs whitespace-pre-wrap bg-red-100/60 border border-red-200 rounded p-2">
                {error.summary}
              </p>
            )}
          </div>

          {/* Error Code */}
          {error.code !== undefined && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive" className="text-xs">
                Exit Code: {error.code}
              </Badge>
              {typeof error.queueMs === 'number' && (
                <Badge variant="secondary" className="text-xs text-red-700">
                  Queue: {error.queueMs}ms
                </Badge>
              )}
              {typeof error.durationMs === 'number' && (
                <Badge variant="outline" className="text-xs border-red-300 text-red-700">
                  Duration: {error.durationMs}ms
                </Badge>
              )}
              {error.requestId && (
                <Badge variant="outline" className="text-xs border-red-300 text-red-700">
                  Request: {error.requestId}
                </Badge>
              )}
            </div>
          )}

          {/* Toggle Details Button */}
          {(error.log || error.stdout || error.stderr) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-red-700 border-red-300 hover:bg-red-100"
            >
              <FileText className="h-4 w-4 mr-2" />
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
          )}

          {/* Detailed Error Information */}
          {showDetails && (
            <div className="space-y-3">
              {/* LaTeX Log */}
              {error.log && (
                <div>
                  <h4 className="font-medium text-red-800 mb-2">LaTeX Log:</h4>
                  <pre className="bg-red-100 border border-red-200 rounded p-3 text-xs overflow-x-auto max-h-40">
                    {error.log}
                  </pre>
                </div>
              )}

              {/* Standard Output */}
              {error.stdout && (
                <div>
                  <h4 className="font-medium text-red-800 mb-2">Output:</h4>
                  <pre className="bg-red-100 border border-red-200 rounded p-3 text-xs overflow-x-auto max-h-40">
                    {error.stdout}
                  </pre>
                </div>
              )}

              {/* Standard Error */}
              {error.stderr && (
                <div>
                  <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                  <pre className="bg-red-100 border border-red-200 rounded p-3 text-xs overflow-x-auto max-h-40">
                    {error.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                className="bg-red-600 hover:bg-red-700 text-white"
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
              className="text-red-700 border-red-300 hover:bg-red-100"
            >
              Copy Error Details
            </Button>
          </div>

          {/* Common Solutions */}
          <div className="bg-red-100 border border-red-200 rounded p-3">
            <h4 className="font-medium text-red-800 mb-2">Common Solutions:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Check for missing packages or commands</li>
              <li>• Verify LaTeX syntax (missing braces, incorrect commands)</li>
              <li>• Ensure all required packages are included</li>
              <li>• Check for special characters that need escaping</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
