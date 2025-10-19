"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, SendIcon, Sparkles } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { ConnectProviderModal } from "@/components/connect-provider-modal";

export default function NewChatPage() {
  const { providerConfig } = useApp();
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b h-14 flex items-center gap-4 px-4 md:px-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">New Chat</h1>
      </header>

      {/* Message panel - Empty state */}
      <ScrollArea className="flex-1">
        {!providerConfig ? (
          // No provider configured
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="size-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold">No Provider Connected</h2>
              <p className="text-muted-foreground">
                Connect an AI provider to start chatting.
              </p>
              <Button onClick={() => setProviderModalOpen(true)}>
                Connect Provider
              </Button>
            </div>
          </div>
        ) : (
          // Provider configured - ready to chat
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="size-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold">Start a New Conversation</h2>
              <p className="text-muted-foreground">
                Type your message below to begin chatting with {providerConfig.provider}.
              </p>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Composer bar */}
      <div className="border-t p-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Input
              placeholder={
                providerConfig
                  ? "Type a message..."
                  : "Connect a provider first..."
              }
              className="flex-1"
              disabled={!providerConfig}
              aria-label="Message input"
            />
            <Button size="icon" disabled={!providerConfig} aria-label="Send message">
              <SendIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Connect Provider Modal */}
      <ConnectProviderModal
        open={providerModalOpen}
        onOpenChange={setProviderModalOpen}
      />
    </div>
  );
}
