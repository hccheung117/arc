import type { Metadata } from "next";
import "./globals.css";
import { CoreProvider } from "@/lib/core-provider";
import { ElectronIntegration } from "@/components/ElectronIntegration";
import { AppEffects } from "@/components/app-effects";

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
        <CoreProvider>
          {children}
          <ElectronIntegration />
        </CoreProvider>
      </body>
    </html>
  );
}
