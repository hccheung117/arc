import { useMemo } from "react";
import type { Message } from "@arc/core/core.js";

export type DisplayItem =
  | { type: "message"; message: Message; index: number }
  | { type: "divider"; model: string | undefined; providerConnectionId: string | undefined; index: number };

export function useDisplayItems(messages: Message[]) {
  const displayItems = useMemo(() => {
    const items: DisplayItem[] = [];
    let lastModel: string | undefined;
    let lastProviderId: string | undefined;

    messages.forEach((message, index) => {
      // Check if model changed (only for assistant messages)
      const currentModel = message.model;
      const currentProviderId = message.providerConnectionId;
      const isModelChange =
        message.role === "assistant" &&
        index > 0 && // Not the first message
        (currentModel !== lastModel || currentProviderId !== lastProviderId) &&
        (currentModel || currentProviderId); // Has model info

      // Insert divider if model changed
      if (isModelChange) {
        items.push({
          type: "divider",
          model: currentModel,
          providerConnectionId: currentProviderId,
          index: items.length,
        });
      }

      // Add the message
      items.push({
        type: "message",
        message,
        index: items.length,
      });

      // Update last model tracking (only for assistant messages with model info)
      if (message.role === "assistant" && (currentModel || currentProviderId)) {
        lastModel = currentModel;
        lastProviderId = currentProviderId;
      }
    });

    return items;
  }, [messages]);

  return displayItems;
}
