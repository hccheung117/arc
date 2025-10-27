/**
 * Reusable empty state components
 *
 * These components provide consistent, informative empty states throughout
 * the application to guide users on what to do next.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Search,
  DatabaseZap,
  AlertCircle,
  FileSearch,
} from "lucide-react";
import type { ReactNode } from "react";

// ============================================================================
// Base Empty State Component
// ============================================================================

interface BaseEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
}

function BaseEmptyState({ icon, title, description, action }: BaseEmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action && (
          <Button
            onClick={action.onClick}
            variant={action.variant || "default"}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Specific Empty States
// ============================================================================

interface EmptyStateWithActionProps {
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Empty state for when no AI providers are configured
 */
export function NoProvidersState({ action }: EmptyStateWithActionProps) {
  return (
    <BaseEmptyState
      icon={<DatabaseZap className="size-8 text-muted-foreground" />}
      title="No providers configured"
      description="Add an AI provider to start chatting with AI models. You can configure multiple providers like OpenAI, Anthropic, or Google Gemini."
      action={action}
    />
  );
}

/**
 * Empty state for when a chat has no messages
 */
export function NoMessagesState() {
  return (
    <BaseEmptyState
      icon={<Sparkles className="size-8 text-muted-foreground" />}
      title="No messages yet"
      description="Start a conversation by typing a message below. You can ask questions, request code help, or have a creative discussion."
    />
  );
}

/**
 * Empty state for when there are no chats in the sidebar
 */
export function NoChatsState({ action }: EmptyStateWithActionProps) {
  return (
    <Card className="m-2">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <Sparkles className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No conversations yet</p>
          <p className="text-xs text-muted-foreground">
            Create a new chat to get started
          </p>
        </div>
        {action && (
          <Button onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Empty state for when search returns no results
 */
export function NoSearchResultsState({ query }: { query: string }) {
  return (
    <BaseEmptyState
      icon={<FileSearch className="size-8 text-muted-foreground" />}
      title="No results found"
      description={`No messages found matching "${query}". Try searching with different keywords or phrases.`}
    />
  );
}

/**
 * Empty state for when in-chat search returns no results
 */
export function NoInChatSearchResultsState({ query }: { query: string }) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center space-y-2 max-w-sm">
        <Search className="size-6 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          No matches found for &quot;{query}&quot; in this chat
        </p>
      </div>
    </div>
  );
}

/**
 * Empty state for when models fail to load
 */
export function NoModelsAvailableState({ providerName }: { providerName?: string }) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center space-y-2 max-w-sm">
        <AlertCircle className="size-6 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          {providerName
            ? `No models available from ${providerName}`
            : "No models available"}
        </p>
        <p className="text-xs text-muted-foreground">
          Please check your provider configuration and connection.
        </p>
      </div>
    </div>
  );
}

/**
 * Empty state for when global search returns no results
 */
export function NoGlobalSearchResultsState({ query }: { query: string }) {
  return (
    <div className="text-center py-8 px-4">
      <Search className="size-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">
        No messages found matching &quot;{query}&quot;
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Try different keywords or check your spelling
      </p>
    </div>
  );
}

/**
 * Empty state for when provider list is empty in settings
 */
export function EmptyProviderListState({ onAddProvider }: { onAddProvider: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <DatabaseZap className="size-12 text-muted-foreground" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">No providers configured yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Add your first AI provider to get started. You can connect to OpenAI,
            Anthropic, Google Gemini, or use a custom endpoint.
          </p>
        </div>
        <Button onClick={onAddProvider}>
          Add Provider
        </Button>
      </CardContent>
    </Card>
  );
}
