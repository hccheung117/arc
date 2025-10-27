import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Message } from "@/components/message";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ProviderConfig } from "@arc/core/core.js";

describe("Message - Pin/Unpin Feature", () => {
  const mockProviders: ProviderConfig[] = [
    {
      id: "provider-1",
      name: "OpenAI",
      type: "openai",
      apiKey: "test-key",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const baseMessage = {
    id: "msg-1",
    role: "assistant" as const,
    content: "This is a test message",
    status: "complete" as const,
    model: "gpt-4",
    providerConnectionId: "provider-1",
  };

  it("should show 'Pin Message' option when message is not pinned", () => {
    const onPin = vi.fn();

    render(
      <TooltipProvider>
        <Message
          message={{ ...baseMessage, isPinned: false }}
          isLatestAssistant={false}
          providers={mockProviders}
          onPin={onPin}
        />
      </TooltipProvider>
    );

    // Open context menu
    const menuButton = screen.getByLabelText("Message options");
    fireEvent.click(menuButton);

    // Check that "Pin Message" option is visible
    expect(screen.getByText("Pin Message")).toBeInTheDocument();
  });

  it("should show 'Unpin Message' option when message is pinned", () => {
    const onPin = vi.fn();

    render(
      <TooltipProvider>
        <Message
          message={{ ...baseMessage, isPinned: true }}
          isLatestAssistant={false}
          providers={mockProviders}
          onPin={onPin}
        />
      </TooltipProvider>
    );

    // Open context menu
    const menuButton = screen.getByLabelText("Message options");
    fireEvent.click(menuButton);

    // Check that "Unpin Message" option is visible
    expect(screen.getByText("Unpin Message")).toBeInTheDocument();
  });

  it("should call onPin with correct arguments when pinning", () => {
    const onPin = vi.fn();

    render(
      <TooltipProvider>
        <Message
          message={{ ...baseMessage, isPinned: false }}
          isLatestAssistant={false}
          providers={mockProviders}
          onPin={onPin}
        />
      </TooltipProvider>
    );

    // Open context menu and click "Pin Message"
    const menuButton = screen.getByLabelText("Message options");
    fireEvent.click(menuButton);

    const pinOption = screen.getByText("Pin Message");
    fireEvent.click(pinOption);

    // Verify onPin was called with correct arguments
    expect(onPin).toHaveBeenCalledWith("msg-1", true);
  });

  it("should call onPin with correct arguments when unpinning", () => {
    const onPin = vi.fn();

    render(
      <TooltipProvider>
        <Message
          message={{ ...baseMessage, isPinned: true }}
          isLatestAssistant={false}
          providers={mockProviders}
          onPin={onPin}
        />
      </TooltipProvider>
    );

    // Open context menu and click "Unpin Message"
    const menuButton = screen.getByLabelText("Message options");
    fireEvent.click(menuButton);

    const unpinOption = screen.getByText("Unpin Message");
    fireEvent.click(unpinOption);

    // Verify onPin was called with correct arguments
    expect(onPin).toHaveBeenCalledWith("msg-1", false);
  });

  it("should show pinned indicator when message is pinned", () => {
    render(
      <TooltipProvider>
        <Message
          message={{ ...baseMessage, isPinned: true }}
          isLatestAssistant={false}
          providers={mockProviders}
        />
      </TooltipProvider>
    );

    // Check that pinned indicator is visible
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  it("should not show pinned indicator when message is not pinned", () => {
    render(
      <TooltipProvider>
        <Message
          message={{ ...baseMessage, isPinned: false }}
          isLatestAssistant={false}
          providers={mockProviders}
        />
      </TooltipProvider>
    );

    // Check that pinned indicator is not visible
    expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
  });
});
