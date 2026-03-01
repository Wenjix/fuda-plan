import type { GenerationProvider } from './types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.0-flash';

// Timeout constants (spec section 10b-1)
const NON_STREAMING_TIMEOUT_MS = 30_000;
const STREAMING_INACTIVITY_TIMEOUT_MS = 10_000;
const HARD_CEILING_MS = 60_000;

// Exponential backoff: 2s, 4s, 8s
const BACKOFF_BASE_MS = 2_000;
const MAX_RETRIES = 3;

function createTimeoutController(timeoutMs: number): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    clear: () => clearTimeout(timer),
  };
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { controller, clear } = createTimeoutController(timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clear();

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        if (attempt < MAX_RETRIES - 1) {
          const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (err) {
      clear();
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error(`Gemini API timeout after ${timeoutMs}ms`);
      } else if (err instanceof Error) {
        lastError = err;
      } else {
        lastError = new Error('Unknown fetch error');
      }
      if (attempt < MAX_RETRIES - 1) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error('Gemini API request failed after retries');
}

export class GeminiProvider implements GenerationProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(prompt: string): Promise<string> {
    const url = `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${this.apiKey}`;
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      },
      NON_STREAMING_TIMEOUT_MS,
    );

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  async generateStream(
    prompt: string,
    onChunk: (delta: string) => void
  ): Promise<string> {
    const url = `${GEMINI_API_BASE}/${MODEL}:streamGenerateContent?key=${this.apiKey}&alt=sse`;

    // Hard ceiling abort controller for entire streaming session
    const hardCeiling = createTimeoutController(HARD_CEILING_MS);

    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
        signal: hardCeiling.controller.signal,
      },
      STREAMING_INACTIVITY_TIMEOUT_MS,
    );

    const reader = response.body?.getReader();
    if (!reader) {
      hardCeiling.clear();
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let accumulated = '';

    try {
      while (true) {
        // Inactivity timeout per chunk read
        const inactivityTimer = setTimeout(
          () => hardCeiling.controller.abort(),
          STREAMING_INACTIVITY_TIMEOUT_MS,
        );

        const { done, value } = await reader.read();
        clearTimeout(inactivityTimer);

        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6);
          if (json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (delta) {
              accumulated += delta;
              onChunk(delta);
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      hardCeiling.clear();
    }

    return accumulated;
  }
}
