import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "./Card";
import { Button } from "./Button";
import { Icon } from "./Icon";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * "app" (default) replaces the whole screen and offers a reload — the last line of defence.
   * "page" keeps the surrounding layout (header, navigation) and shows the error in place of
   * just the page, with Try again / Back to today. Must render inside the router.
   */
  variant?: "app" | "page";
  /** When this changes (e.g. the route path), a caught error is cleared so the new page renders. */
  resetKey?: unknown;
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

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey)
      this.setState({ error: null });
  }

  override render() {
    if (!this.state.error) return this.props.children;

    if (this.props.variant === "page") {
      return (
        <Card intensity="strong" className="mx-auto max-w-sm text-center" role="alert">
          <div className="mb-2 flex justify-center text-amber-400">
            <Icon name="warning" className="text-4xl" filled />
          </div>
          <h1 className="font-display text-lg font-bold text-white">
            This page ran into a problem
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Your progress is saved. Try again, or head back to today's games.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
            <Link to="/" className="text-sm font-medium text-brand-300 hover:text-brand-200">
              Back to today
            </Link>
          </div>
        </Card>
      );
    }

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
