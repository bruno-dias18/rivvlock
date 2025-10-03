import React from "react";
import { logger } from "@/lib/logger";

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

export class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, GlobalErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error("🚨 [ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    // Attempt to clear potential SW/caches issues
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    }
    if ('caches' in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center border rounded-lg p-8 bg-card">
          <h1 className="text-2xl font-bold mb-2">Une erreur s'est produite</h1>
          <p className="text-muted-foreground mb-6">
            {this.state.error?.message || "L'application a rencontré un problème inattendu."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={this.handleReload} className="inline-flex items-center justify-center rounded-md px-4 py-2 border">
              Recharger la page
            </button>
            <button onClick={() => (window.location.href = '/')} className="inline-flex items-center justify-center rounded-md px-4 py-2 border">
              Retour à l'accueil
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Si le problème persiste, videz le cache et réessayez.</p>
        </div>
      </div>
    );
  }
}
