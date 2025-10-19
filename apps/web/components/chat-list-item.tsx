"use client";

import { useState, useRef, useEffect } from "react";
import type { Chat } from "@/lib/types";
import { useChatStore } from "@/lib/chat-store";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(chat.title);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { renameChat, deleteChat } = useChatStore();

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== chat.title) {
      renameChat(chat.id, trimmedTitle);
    } else {
      setEditedTitle(chat.title);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(chat.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${chat.title}"?`)) {
      deleteChat(chat.id);
    }
  };

  return (
    <div
      className={`group relative w-full text-left p-3 rounded-md transition-colors mb-1 ${
        isActive
          ? "bg-accent"
          : "hover:bg-accent/50"
      }`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full text-sm font-medium bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="text-sm font-medium text-sidebar-foreground truncate pr-8"
          onDoubleClick={handleDoubleClick}
          title="Double-click to rename"
        >
          {chat.title}
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-1">
        {formatTimestamp(chat.lastMessageAt)}
      </div>

      {/* Delete button - show on hover */}
      {isHovered && !isEditing && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Delete chat"
        >
          <Trash2 className="size-3" />
        </Button>
      )}
    </div>
  );
}
