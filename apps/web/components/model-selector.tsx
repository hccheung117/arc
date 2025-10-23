"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModelInfo } from "@/lib/api/chat-api.interface";
import { useChatAPI } from "@/lib/api/chat-api-provider";

interface ModelSelectorProps {
  value: string;
  onValueChange: (modelId: string) => void;
  disabled?: boolean | undefined;
}

export function ModelSelector({ value, onValueChange, disabled }: ModelSelectorProps) {
  const { api } = useChatAPI();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const availableModels = await api.getAvailableModels();
        setModels(availableModels);

        // If current value is not in the list, select the first model
        if (availableModels.length > 0 && !availableModels.some((m) => m.id === value)) {
          onValueChange(availableModels[0]!.id);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchModels();
  }, [api, onValueChange, value]);

  if (loading) {
    return (
      <Select disabled value="">
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Loading models..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (models.length === 0) {
    return (
      <Select disabled value="">
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="No models available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled ?? false}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={`${model.provider}-${model.id}`} value={model.id}>
            {model.name} ({model.provider})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
