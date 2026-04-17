import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="max-w-md w-full border border-destructive rounded-lg p-6 bg-destructive/10">
              <div className="flex gap-3 items-start">
                <AlertCircle className="w-6 h-6 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-destructive text-base">Application Error</h3>
                  <p className="text-sm text-destructive/80 mt-1">
                    {this.state.error?.message || 'An unexpected error occurred.'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-3">
                    If this is a fresh install, make sure you have a <code className="bg-muted px-1 rounded">.env.local</code> file
                    based on <code className="bg-muted px-1 rounded">.env.example</code> with your Firebase credentials.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 text-sm px-3 py-1.5 rounded bg-destructive text-white hover:bg-destructive/90"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
