import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "./Card";
import { Button } from "./Button";
import { Icon } from "./Icon";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error in app:", error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <Card intensity="strong" className="max-w-sm text-center">
          <div className="mb-2 flex justify-center text-amber-400">
            <Icon name="warning" className="text-4xl" filled />
          </div>
          <h1 className="font-display text-lg font-bold text-white">Something went wrong</h1>
          <p className="mt-2 text-sm text-white/60">
            An unexpected error interrupted the page. Reloading usually fixes it.
          </p>
          <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Card>
      </div>
    );
  }
}
