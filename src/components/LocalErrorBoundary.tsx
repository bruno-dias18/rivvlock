import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface LocalErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

interface LocalErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onRetry?: () => void;
}

export class LocalErrorBoundary extends React.Component<LocalErrorBoundaryProps, LocalErrorBoundaryState> {
  constructor(props: LocalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LocalErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error("🚨 [LocalErrorBoundary] Component error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Erreur de composant</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {this.state.error?.message || "Une erreur s'est produite dans ce composant."}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={this.handleRetry}
          className="text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Réessayer
        </Button>
      </div>
    );
  }
}