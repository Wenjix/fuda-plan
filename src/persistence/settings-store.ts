import { openDB, type IDBPDatabase } from 'idb';
import type { DBSchema } from 'idb';
import { z } from 'zod';

const SETTINGS_DB_NAME = 'fuda-settings';
const SETTINGS_DB_VERSION = 1;

export const ThemeSchema = z.enum(['light', 'dark']).default('light');
export type Theme = z.infer<typeof ThemeSchema>;

export const AppSettingsSchema = z.object({
  geminiApiKey: z.string().default(''),
  challengeDepth: z.enum(['gentle', 'balanced', 'intense']).default('balanced'),
  autoSaveEnabled: z.boolean().default(true),
  animationsEnabled: z.boolean().default(true),
  theme: ThemeSchema,
  elevenLabsApiKey: z.string().default(''),
  voiceInputMode: z.enum(['hold_to_talk', 'toggle']).default('hold_to_talk'),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

interface SettingsDB extends DBSchema {
  settings: {
    key: string;
    value: AppSettings;
  };
}

const SETTINGS_KEY = 'app-settings';

let dbPromise: Promise<IDBPDatabase<SettingsDB>> | null = null;

function getSettingsDB(): Promise<IDBPDatabase<SettingsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SettingsDB>(SETTINGS_DB_NAME, SETTINGS_DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

export async function loadSettings(): Promise<AppSettings> {
  const db = await getSettingsDB();
  const raw = await db.get('settings', SETTINGS_KEY);
  if (!raw) return AppSettingsSchema.parse({});
  return AppSettingsSchema.parse(raw);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const validated = AppSettingsSchema.parse(settings);
  const db = await getSettingsDB();
  await db.put('settings', validated, SETTINGS_KEY);
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings();
  const updated = AppSettingsSchema.parse({ ...current, ...partial });
  await saveSettings(updated);
  return updated;
}
