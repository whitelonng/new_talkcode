import { AlertTriangle, RefreshCw } from 'lucide-react';
import type React from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  toolName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ToolErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Tool Error Boundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  override render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                Tool Error{this.props.toolName ? `: ${this.props.toolName}` : ''}
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                {this.state.error?.message ||
                  'An unexpected error occurred while rendering this tool.'}
              </div>

              {/* Show error details in development */}
              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="mt-3">
                  <summary className="text-xs text-orange-600 cursor-pointer hover:text-orange-700">
                    Error Details
                  </summary>
                  <pre className="mt-2 text-xs text-orange-600 bg-orange-100 p-2 rounded overflow-auto max-h-32">
                    {this.state.error?.stack}
                  </pre>
                  <pre className="mt-2 text-xs text-orange-600 bg-orange-100 p-2 rounded overflow-auto max-h-32">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <button
                type="button"
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping tool components
export function withToolErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  toolName?: string
) {
  return function WrappedComponent(props: T) {
    return (
      <ToolErrorBoundary toolName={toolName}>
        <Component {...props} />
      </ToolErrorBoundary>
    );
  };
}
