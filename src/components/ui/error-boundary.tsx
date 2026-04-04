import React from 'react';
import { logger } from '@/lib/logger';
import { Button } from './button';

type Props = {
  fallback?: React.ReactNode;
  children: React.ReactNode;
  onReset?: () => void;
};

type State = {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onReset?.();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start justify-between mb-2">
            <div className="text-red-600 text-sm dark:text-red-400 font-medium">
              Something went wrong
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={this.handleReset}
              className="h-auto p-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800"
            >
              Reset
            </Button>
          </div>
          <div className="text-red-600 text-xs dark:text-red-400 mb-2">
            An error occurred while rendering this component.
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details className="text-xs">
              <summary className="cursor-pointer text-red-500 dark:text-red-300">
                Error details (development only)
              </summary>
              <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs overflow-auto">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-2">
                    Component stack:
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
