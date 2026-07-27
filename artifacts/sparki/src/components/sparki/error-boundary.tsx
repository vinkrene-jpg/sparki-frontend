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
          <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#040506] px-6 text-center">
            <Zap className="h-7 w-7 text-accent-cyan" aria-hidden="true" />
            <p className="font-sans text-base font-semibold text-white/80">
              Er ging iets mis
            </p>
            <p className="max-w-xs text-sm text-white/40">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-2 rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/80"
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
