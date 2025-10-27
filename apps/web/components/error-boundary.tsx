"use client";

/**
 * Global Error Boundary Component
 *
 * Catches unhandled errors in the React component tree and displays
 * a user-friendly fallback UI instead of crashing the entire app.
 *
 * Features:
 * - User-friendly error message
 * - Reload button to recover
 * - Report issue link (GitHub issues)
 * - Error details in development mode
 * - Console logging for debugging
 */

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Github } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    // Log error details to console for debugging
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // TODO: Send error to error reporting service (e.g., Sentry)
    // Example: logErrorToService(error, errorInfo);
  }

  handleReload = (): void => {
    // Reset error state and reload the page
    window.location.reload();
  };

  handleReset = (): void => {
    // Reset error state without reloading
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReportIssue = (): void => {
    const { error } = this.state;

    // Construct GitHub issue URL with pre-filled template
    const issueTitle = encodeURIComponent(`Error: ${error?.message || "Unknown error"}`);
    const issueBody = encodeURIComponent(
      `## Error Report\n\n` +
      `**Error Message:**\n${error?.message || "Unknown error"}\n\n` +
      `**Stack Trace:**\n\`\`\`\n${error?.stack || "No stack trace"}\n\`\`\`\n\n` +
      `**Browser:** ${navigator.userAgent}\n\n` +
      `**Timestamp:** ${new Date().toISOString()}\n\n` +
      `## Steps to Reproduce\n\n1. \n2. \n3. \n\n` +
      `## Expected Behavior\n\n` +
      `## Actual Behavior\n\n`
    );

    const githubIssueUrl = `https://github.com/your-repo/arc/issues/new?title=${issueTitle}&body=${issueBody}`;
    window.open(githubIssueUrl, "_blank");
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children } = this.props;

    if (hasError) {
      const isDevelopment = process.env.NODE_ENV === "development";

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full bg-destructive/10">
                  <AlertCircle className="size-6 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Something went wrong</CardTitle>
                  <CardDescription className="mt-1">
                    Arc encountered an unexpected error
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-semibold">Error:</span>{" "}
                  {error?.message || "An unknown error occurred"}
                </AlertDescription>
              </Alert>

              <p className="text-sm text-muted-foreground">
                We apologize for the inconvenience. You can try reloading the application
                or report this issue to help us improve Arc.
              </p>

              <div className="flex gap-3 flex-wrap">
                <Button onClick={this.handleReload} className="gap-2">
                  <RefreshCw className="size-4" />
                  Reload Application
                </Button>

                <Button
                  onClick={this.handleReportIssue}
                  variant="outline"
                  className="gap-2"
                >
                  <Github className="size-4" />
                  Report Issue
                </Button>

                {isDevelopment && (
                  <Button
                    onClick={this.handleReset}
                    variant="secondary"
                  >
                    Try to Recover
                  </Button>
                )}
              </div>

              {/* Show error details in development mode */}
              {isDevelopment && error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 p-4 bg-muted rounded-md space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        Error Message:
                      </p>
                      <code className="text-xs text-destructive block whitespace-pre-wrap">
                        {error.message}
                      </code>
                    </div>

                    {error.stack && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          Stack Trace:
                        </p>
                        <code className="text-xs text-muted-foreground block whitespace-pre-wrap overflow-auto max-h-48">
                          {error.stack}
                        </code>
                      </div>
                    )}

                    {errorInfo?.componentStack && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          Component Stack:
                        </p>
                        <code className="text-xs text-muted-foreground block whitespace-pre-wrap overflow-auto max-h-48">
                          {errorInfo.componentStack}
                        </code>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}
