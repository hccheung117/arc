import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar border-sidebar-border p-4">
        <div className="text-sm font-medium text-sidebar-foreground">
          Navigation
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Chat list will go here
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="border-b h-14 flex items-center px-6">
          <h1 className="text-lg font-semibold">Arc shell</h1>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Welcome to Arc</h2>
              <p className="text-muted-foreground mb-6">
                AI Chat Client - Next.js + shadcn/ui
              </p>
            </div>
            <Button>Click me to test shadcn Button</Button>
          </div>
        </main>
      </div>
    </div>
  );
}
