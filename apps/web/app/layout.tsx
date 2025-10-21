import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";
import { ChatAPIProvider } from "@/lib/api/chat-api-provider";
import { ElectronIntegration } from "@/components/ElectronIntegration";

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
        <AppProvider>
          <ChatAPIProvider>
            {children}
            <ElectronIntegration />
          </ChatAPIProvider>
        </AppProvider>
      </body>
    </html>
  );
}
