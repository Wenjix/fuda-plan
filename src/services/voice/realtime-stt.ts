export interface RealtimeSTTCallbacks {
  onPartialTranscript: (text: string) => void;
  onCommittedTranscript: (text: string) => void;
  onError: (error: string) => void;
  onSessionStarted: () => void;
}

type WSMessage =
  | { type: 'session_begin' }
  | { type: 'transcript'; channel: { alternatives: { transcript: string }[] }; is_final: boolean }
  | { type: 'partial_transcript'; text: string }
  | { type: 'committed_transcript'; text: string }
  | { type: 'scribe_error'; message: string }
  | { type: 'scribe_auth_error'; message: string }
  | { type: 'scribe_rate_limited_error'; message: string };

/**
 * ElevenLabs Realtime WebSocket STT client.
 * Opens a WebSocket for streaming audio chunks and receiving live transcripts.
 */
export class RealtimeSTTClient {
  private ws: WebSocket | null = null;
  private committedText = '';
  private closed = false;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private apiKey: string,
    private callbacks: RealtimeSTTCallbacks,
  ) {}

  connect(): void {
    this.closed = false;
    this.committedText = '';

    const params = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      language_code: 'en',
      sample_rate: '16000',
      encoding: 'pcm_s16le',
    });

    const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params}`;

    this.ws = new WebSocket(url);

    // Connection timeout: if not open within 10s, treat as error
    this.connectTimeout = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        this.callbacks.onError('WebSocket connection timed out');
        this.close();
      }
    }, 10_000);

    this.ws.onopen = () => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      // Send auth message
      this.ws?.send(JSON.stringify({
        type: 'authenticate',
        token: this.apiKey,
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data as string);
        this.handleMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      if (!this.closed) {
        this.callbacks.onError('WebSocket connection error');
      }
    };

    this.ws.onclose = (event) => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      if (!this.closed && event.code !== 1000) {
        this.callbacks.onError(`WebSocket closed unexpectedly (code ${event.code})`);
      }
    };
  }

  private handleMessage(msg: WSMessage): void {
    switch (msg.type) {
      case 'session_begin':
        this.callbacks.onSessionStarted();
        break;

      case 'partial_transcript':
        this.callbacks.onPartialTranscript(msg.text);
        break;

      case 'committed_transcript':
        this.committedText += (this.committedText ? ' ' : '') + msg.text;
        this.callbacks.onCommittedTranscript(this.committedText);
        break;

      // Some ElevenLabs WS implementations use a generic "transcript" message
      case 'transcript': {
        const alt = msg.channel?.alternatives?.[0];
        if (alt) {
          if (msg.is_final) {
            this.committedText += (this.committedText ? ' ' : '') + alt.transcript;
            this.callbacks.onCommittedTranscript(this.committedText);
          } else {
            this.callbacks.onPartialTranscript(alt.transcript);
          }
        }
        break;
      }

      case 'scribe_error':
      case 'scribe_auth_error':
      case 'scribe_rate_limited_error':
        this.callbacks.onError(msg.message || `STT error: ${msg.type}`);
        break;
    }
  }

  sendAudioChunk(pcmBase64: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'input_audio_chunk',
        data: pcmBase64,
      }));
    }
  }

  commit(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'commit' }));
    }
  }

  getCommittedText(): string {
    return this.committedText;
  }

  close(): void {
    this.closed = true;
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000);
      }
      this.ws = null;
    }
  }
}
