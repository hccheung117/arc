"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/lib/chat-store";

export default function NewChatPage() {
  const router = useRouter();
  const createChat = useChatStore((state) => state.createChat);

  // Create a new chat on mount and redirect to home
  useEffect(() => {
    createChat("New Chat");
    router.push("/");
  }, [createChat, router]);

  // Show loading state while redirecting
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
