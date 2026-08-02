import { Component, type ErrorInfo, type ReactNode } from "react";
import { Zap } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Sparki] Uncaught render error:", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
            <Zap className="h-7 w-7 text-accent-cyan" aria-hidden="true" />
            <p className="font-sans text-base font-semibold text-foreground/80">
              Er ging iets mis
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-accent-cyan/30 hover:text-accent-cyan"
            >
              Probeer opnieuw
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
