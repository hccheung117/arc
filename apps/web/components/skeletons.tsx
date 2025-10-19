import { Skeleton } from "@/components/ui/skeleton";

export function ChatListSkeleton() {
  return (
    <div className="p-2 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 rounded-md">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
        >
          <div className="max-w-[80%] space-y-2">
            <Skeleton className="h-20 w-64 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyChatState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center space-y-2">
        <p className="text-muted-foreground">No conversations yet</p>
        <p className="text-sm text-muted-foreground">
          Start a new chat to begin
        </p>
      </div>
    </div>
  );
}
