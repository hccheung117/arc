import type { Metadata } from "next";
import "./globals.css";
import { CoreProvider } from "@/lib/core-provider";
import { ElectronIntegration } from "@/components/ElectronIntegration";
import { AppEffects } from "@/components/app-effects";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";

export const metadata: Metadata = {
  title: "Arc",
  description: "AI Chat Client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppEffects />
        <ErrorBoundary>
          <CoreProvider>
            {children}
            <ElectronIntegration />
            <Toaster />
          </CoreProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
