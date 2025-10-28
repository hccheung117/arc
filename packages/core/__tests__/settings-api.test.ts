import { describe, it, expect, beforeEach, vi } from "vitest";
import { SettingsAPI } from "../src/settings/settings-api.js";
import type { SettingsRepository } from "../src/settings/settings-repository.type.js";
import { defaultSettings, type Settings } from "../src/settings/settings.js";

/**
 * SettingsAPI Tests
 *
 * Tests the SettingsAPI with mocked repository.
 */

describe("SettingsAPI", () => {
  let api: SettingsAPI;
  let mockRepository: SettingsRepository;

  beforeEach(() => {
    mockRepository = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
      clear: vi.fn(),
    };

    api = new SettingsAPI(mockRepository);
  });

  describe("get", () => {
    it("should return only defaults if no saved settings", async () => {
      vi.mocked(mockRepository.get).mockResolvedValue(null);

      const result = await api.get();

      expect(result).toEqual(defaultSettings);
    });

    it("should merge saved settings with defaults", async () => {
      const savedSettings: Partial<Settings> = {
        theme: "dark",
        fontSize: "large",
      };

      vi.mocked(mockRepository.get).mockResolvedValue(savedSettings);

      const result = await api.get();

      expect(result.theme).toBe("dark");
      expect(result.fontSize).toBe("large");
      expect(result.showTokenCounts).toBe(defaultSettings.showTokenCounts);
      expect(result.enableMarkdown).toBe(defaultSettings.enableMarkdown);
    });

    it("should handle partial saved settings", async () => {
      const savedSettings: Partial<Settings> = {
        theme: "light",
      };

      vi.mocked(mockRepository.get).mockResolvedValue(savedSettings);

      const result = await api.get();

      expect(result.theme).toBe("light");
      expect(result.fontSize).toBe(defaultSettings.fontSize);
      expect(result.showTokenCounts).toBe(defaultSettings.showTokenCounts);
    });
  });

  describe("update", () => {
    it("should save new settings", async () => {
      vi.mocked(mockRepository.get).mockResolvedValue(null);
      vi.mocked(mockRepository.set).mockResolvedValue();

      const newSettings: Partial<Settings> = {
        theme: "dark",
      };

      await api.update(newSettings);

      expect(mockRepository.set).toHaveBeenCalledWith(
        "app:settings",
        expect.objectContaining({ theme: "dark" })
      );
    });

    it("should merge with existing settings", async () => {
      const existingSettings: Settings = {
        ...defaultSettings,
        theme: "dark",
      };

      vi.mocked(mockRepository.get).mockResolvedValue(existingSettings);
      vi.mocked(mockRepository.set).mockResolvedValue();

      const newSettings: Partial<Settings> = {
        fontSize: "large",
      };

      const result = await api.update(newSettings);

      expect(result.theme).toBe("dark");
      expect(result.fontSize).toBe("large");
    });

    it("should return updated settings", async () => {
      vi.mocked(mockRepository.get).mockResolvedValue(null);
      vi.mocked(mockRepository.set).mockResolvedValue();

      const newSettings: Partial<Settings> = {
        theme: "light",
        fontSize: "small",
      };

      const result = await api.update(newSettings);

      expect(result.theme).toBe("light");
      expect(result.fontSize).toBe("small");
      expect(result.showTokenCounts).toBe(defaultSettings.showTokenCounts);
    });
  });

  describe("reset", () => {
    it("should clear all settings", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      await api.reset();

      expect(mockRepository.delete).toHaveBeenCalledWith("app:settings");
    });

    it("should return default settings", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await api.reset();

      expect(result).toEqual(defaultSettings);
    });
  });

  describe("new settings fields (Phase 8)", () => {
    describe("favoriteModels", () => {
      it("should return empty array by default", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);

        const result = await api.get();

        expect(result.favoriteModels).toEqual([]);
      });

      it("should correctly persist favoriteModels array", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);
        vi.mocked(mockRepository.set).mockResolvedValue();

        const favorites = ["openai:gpt-4", "anthropic:claude-3-5-sonnet"];
        await api.update({ favoriteModels: favorites });

        expect(mockRepository.set).toHaveBeenCalledWith(
          "app:settings",
          expect.objectContaining({ favoriteModels: favorites })
        );
      });
    });

    describe("typography settings", () => {
      it("should return correct defaults for lineHeight and fontFamily", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);

        const result = await api.get();

        expect(result.lineHeight).toBe("normal");
        expect(result.fontFamily).toBe("sans");
      });

      it("should correctly persist lineHeight enum", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);
        vi.mocked(mockRepository.set).mockResolvedValue();

        await api.update({ lineHeight: "relaxed" });

        expect(mockRepository.set).toHaveBeenCalledWith(
          "app:settings",
          expect.objectContaining({ lineHeight: "relaxed" })
        );
      });

      it("should correctly persist fontFamily enum", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);
        vi.mocked(mockRepository.set).mockResolvedValue();

        await api.update({ fontFamily: "mono" });

        expect(mockRepository.set).toHaveBeenCalledWith(
          "app:settings",
          expect.objectContaining({ fontFamily: "mono" })
        );
      });
    });

    describe("defaultSystemPrompt", () => {
      it("should return undefined by default", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);

        const result = await api.get();

        expect(result.defaultSystemPrompt).toBeUndefined();
      });

      it("should correctly persist defaultSystemPrompt string", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);
        vi.mocked(mockRepository.set).mockResolvedValue();

        const systemPrompt = "You are a helpful coding assistant.";
        await api.update({ defaultSystemPrompt: systemPrompt });

        expect(mockRepository.set).toHaveBeenCalledWith(
          "app:settings",
          expect.objectContaining({ defaultSystemPrompt: systemPrompt })
        );
      });
    });

    describe("autoTitleChats", () => {
      it("should return true by default", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);

        const result = await api.get();

        expect(result.autoTitleChats).toBe(true);
      });

      it("should correctly persist autoTitleChats boolean", async () => {
        vi.mocked(mockRepository.get).mockResolvedValue(null);
        vi.mocked(mockRepository.set).mockResolvedValue();

        await api.update({ autoTitleChats: false });

        expect(mockRepository.set).toHaveBeenCalledWith(
          "app:settings",
          expect.objectContaining({ autoTitleChats: false })
        );
      });
    });

    describe("merging behavior", () => {
      it("should merge new settings without losing existing ones", async () => {
        const existingSettings: Settings = {
          ...defaultSettings,
          favoriteModels: ["openai:gpt-4"],
          theme: "dark",
        };

        vi.mocked(mockRepository.get).mockResolvedValue(existingSettings);
        vi.mocked(mockRepository.set).mockResolvedValue();

        const result = await api.update({ lineHeight: "compact" });

        expect(result.favoriteModels).toEqual(["openai:gpt-4"]);
        expect(result.theme).toBe("dark");
        expect(result.lineHeight).toBe("compact");
      });
    });
  });
});
