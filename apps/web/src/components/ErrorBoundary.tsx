import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import { buttonClasses } from "./button-styles";
import { StatusPanel } from "./StatusPanel";

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
        <div className="flex min-h-[50vh] items-center justify-center">
          <StatusPanel
            role="alert"
            icon="warning"
            tone="warning"
            title="This page ran into a problem"
            actions={
              <>
                <Button onClick={() => this.setState({ error: null })}>Try again</Button>
                <Link to="/" className={buttonClasses({ variant: "ghost" })}>
                  Back to today
                </Link>
              </>
            }
          >
            Your progress is saved. Try again, or head back to today&rsquo;s games.
          </StatusPanel>
        </div>
      );
    }

    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <StatusPanel
          icon="warning"
          tone="warning"
          title="Something went wrong"
          actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
        >
          An unexpected error interrupted the page. Reloading usually fixes it.
        </StatusPanel>
      </div>
    );
  }
}
