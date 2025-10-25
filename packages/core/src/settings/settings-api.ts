import type { Settings } from "./settings.js";
import type { ISettingsRepository } from "./settings-repository.type.js";
import { defaultSettings } from "./settings.js";

/**
 * Public API for managing user preferences
 */
export class SettingsAPI {
  private repository: ISettingsRepository;
  private readonly settingsKey = "app:settings";

  constructor(repository: ISettingsRepository) {
    this.repository = repository;
  }

  /**
   * Retrieve user settings
   *
   * Returns default settings if none are saved.
   */
  async get(): Promise<Settings> {
    const saved = await this.repository.get<Settings>(this.settingsKey);
    if (!saved) {
      return { ...defaultSettings };
    }

    // Merge with defaults to ensure all keys exist
    return {
      ...defaultSettings,
      ...saved,
    };
  }

  /**
   * Update and persist user settings
   *
   * Merges the provided settings with existing settings.
   */
  async update(newSettings: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const updated: Settings = {
      ...current,
      ...newSettings,
    };

    await this.repository.set(this.settingsKey, updated);
    return updated;
  }

  /**
   * Reset settings to defaults
   */
  async reset(): Promise<Settings> {
    await this.repository.delete(this.settingsKey);
    return { ...defaultSettings };
  }
}
