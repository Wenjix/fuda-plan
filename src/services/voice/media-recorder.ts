export class MicPermissionError extends Error {
  constructor() {
    super('Microphone permission denied');
    this.name = 'MicPermissionError';
  }
}

/** Pick a mime type the browser supports for MediaRecorder. */
export function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return ''; // browser default
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  /** Start mic capture. Throws MicPermissionError on denial. */
  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new MicPermissionError();
    }

    this.chunks = [];
    const mimeType = getSupportedMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.startedAt = Date.now();
  }

  /** Stop recording and return the captured audio blob. */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder || this.recorder.state !== 'recording') {
        reject(new Error('Not recording'));
        return;
      }
      this.recorder.onstop = () => {
        const mime = this.recorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mime });
        this.chunks = [];
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  getElapsedMs(): number {
    if (!this.startedAt || !this.isRecording()) return 0;
    return Date.now() - this.startedAt;
  }

  /** Release the mic stream. Call this when done. */
  destroy(): void {
    if (this.recorder?.state === 'recording') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.startedAt = 0;
  }
}
