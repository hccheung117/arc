import type { Metadata } from "next";
import "./globals.css";
import { ChatAPIProvider } from "@/lib/api/chat-api-provider";
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
        <ChatAPIProvider>
          {children}
          <ElectronIntegration />
        </ChatAPIProvider>
      </body>
    </html>
  );
}
