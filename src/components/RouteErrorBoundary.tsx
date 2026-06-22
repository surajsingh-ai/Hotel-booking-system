import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type RouteErrorBoundaryProps = {
  children: ReactNode;
};

type RouteErrorBoundaryState = {
  error: Error | null;
};

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route render failed", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="min-h-screen bg-background px-6 py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <AlertTriangle className="mx-auto mb-4 size-10 text-destructive" />
          <h1 className="font-display text-3xl text-foreground">Something went wrong</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This page could not load correctly. Please go back and try again.
          </p>
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
          <Button className="mt-6 gradient-cta border-0" onClick={() => window.history.back()}>
            Go back
          </Button>
        </div>
      </main>
    );
  }
}

export default RouteErrorBoundary;
