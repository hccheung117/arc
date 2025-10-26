/**
 * Test Data Fixtures
 *
 * Sample data for integration tests.
 */

import type { ProviderConfig } from "../../../src/providers/provider-config.js";
import type { ImageAttachment } from "../../../src/shared/image-attachment.js";

/**
 * Sample provider configurations
 */
export const sampleProviders: Omit<ProviderConfig, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "OpenAI Test",
    type: "openai",
    apiKey: "sk-test-key-1",
    baseUrl: "https://api.openai.com/v1",
    enabled: true,
  },
  {
    name: "Anthropic Test",
    type: "anthropic",
    apiKey: "sk-ant-test-key",
    baseUrl: "https://api.anthropic.com/v1",
    enabled: true,
  },
  {
    name: "Gemini Test",
    type: "gemini",
    apiKey: "gemini-test-key",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    enabled: true,
  },
];

/**
 * Sample chat titles
 */
export const sampleChatTitles = [
  "My First Chat",
  "Planning Weekend Trip",
  "Code Review Notes",
  "Recipe Ideas",
  "Project Discussion",
];

/**
 * Sample user messages
 */
export const sampleUserMessages = [
  "Hello, how are you?",
  "Can you help me with this task?",
  "What's the weather like today?",
  "Explain quantum physics in simple terms",
  "Write a poem about coding",
];

/**
 * Sample assistant responses
 */
export const sampleAssistantResponses = [
  "Hello! I'm doing well, thank you for asking. How can I assist you today?",
  "Of course! I'd be happy to help. What specific task do you need assistance with?",
  "I don't have real-time weather data, but I can help you find current weather information.",
  "Quantum physics deals with the behavior of matter at very small scales...",
  "In lines of code we write,\nBugs appear both day and night...",
];

/**
 * Sample image attachment (1x1 transparent PNG)
 */
export const sampleImageAttachment: ImageAttachment = {
  id: "test-img-1",
  data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  mimeType: "image/png",
  size: 68,
  name: "test.png",
};

/**
 * Generate a unique ID for testing
 */
export function generateTestId(prefix = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a sample provider config with test data
 */
export function createSampleProviderConfig(
  index = 0
): Omit<ProviderConfig, "id" | "createdAt" | "updatedAt"> {
  const sample = sampleProviders[index % sampleProviders.length];
  return { ...sample };
}
