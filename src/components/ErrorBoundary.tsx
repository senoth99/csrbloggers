"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { primaryActionButtonClass } from "@/screens/dashboard-shared";

type Props = { children: ReactNode };
type State = { hasError: boolean; resetKey: number };

const secondaryButtonClass =
  "inline-flex min-h-[42px] items-center justify-center border border-app-fg/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/40";

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState((s) => ({
      hasError: false,
      resetKey: s.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg font-semibold text-app-fg">Что-то пошло не так</p>
          <p className="max-w-sm text-sm text-app-fg/55">
            Произошла непредвиденная ошибка. Попробуйте продолжить или перезагрузить страницу.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={this.handleRetry} className={secondaryButtonClass}>
              Попробовать снова
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={primaryActionButtonClass}
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}
