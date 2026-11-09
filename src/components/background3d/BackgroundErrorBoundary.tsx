"use client";

import * as React from "react";

type Props = {
  /** Shown when a child throws. Defaults to rendering nothing. */
  fallback?: React.ReactNode;
  /** Short label for the console warning, e.g. "background canvas". */
  label?: string;
  children: React.ReactNode;
};

type State = { failed: boolean };

/**
 * Keeps a failure in the decorative 3D background from unmounting the whole
 * page. Without this, a rejected asset fetch inside the canvas propagates to
 * the React root and Next shows its "Application error" screen.
 */
export class BackgroundErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const label = this.props.label ?? "background";
    console.warn(`[${label}] disabled after error:`, error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
