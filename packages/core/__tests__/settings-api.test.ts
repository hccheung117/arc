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
});
