import type { GenerationProvider } from './types';
import { DemoProvider } from './demo-provider';
import { GeminiProvider } from './gemini';

export type { GenerationProvider } from './types';

let cachedProvider: { key: string; provider: GenerationProvider } | null = null;

export function getProvider(apiKey: string): GenerationProvider {
  if (!apiKey) {
    return new DemoProvider();
  }

  // Cache provider instance to reuse connections
  if (cachedProvider && cachedProvider.key === apiKey) {
    return cachedProvider.provider;
  }

  const provider = new GeminiProvider(apiKey);
  cachedProvider = { key: apiKey, provider };
  return provider;
}
