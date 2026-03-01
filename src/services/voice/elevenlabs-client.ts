export class ElevenLabsSTTError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ElevenLabsSTTError';
    this.status = status;
  }
}

/**
 * Transcribe audio using ElevenLabs Speech-to-Text API.
 * Returns the transcript text.
 */
export async function transcribeAudio(audioBlob: Blob, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.webm');
    form.append('model_id', 'scribe_v1');

    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 401) throw new ElevenLabsSTTError('Invalid ElevenLabs API key', 401);
      if (res.status === 429) throw new ElevenLabsSTTError('Rate limit exceeded, try again shortly', 429);
      throw new ElevenLabsSTTError(`ElevenLabs service error (${res.status})`, res.status);
    }

    const data: { text: string } = await res.json();
    if (!data.text?.trim()) throw new ElevenLabsSTTError('Empty transcription returned');
    return data.text.trim();
  } catch (err) {
    if (err instanceof ElevenLabsSTTError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new ElevenLabsSTTError('Transcription request timed out');
    }
    throw new ElevenLabsSTTError('Network error, check your connection');
  } finally {
    clearTimeout(timeout);
  }
}
