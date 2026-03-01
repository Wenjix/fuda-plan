import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlanTalkStore } from '../../store/plan-talk-store';
import { analyzeReflection, transcribeAndAnalyze } from '../../store/plan-talk-actions';
import { loadSettings } from '../../persistence/settings-store';
import { VoiceRecorder, MicPermissionError } from '../../services/voice/media-recorder';
import styles from './PlanTalkModal.module.css';

export function VoicePane() {
  const turns = usePlanTalkStore((s) => s.turns);
  const turnState = usePlanTalkStore((s) => s.turnState);
  const [input, setInput] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [voiceInputMode, setVoiceInputMode] = useState<'hold_to_talk' | 'toggle'>('hold_to_talk');
  const [micDenied, setMicDenied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy = turnState === 'analyzing' || turnState === 'transcribing' || turnState === 'recording';
  const isRecording = turnState === 'recording';
  const micAvailable = !!elevenLabsKey && !micDenied;

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setElevenLabsKey(s.elevenLabsApiKey);
      setVoiceInputMode(s.voiceInputMode);
    });
  }, []);

  // Auto-scroll on new turns
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length, turnState]);

  // Cleanup recorder on unmount
  useEffect(() => {
    return () => {
      recorderRef.current?.destroy();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isBusy) return;
    const recorder = new VoiceRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start();
      usePlanTalkStore.getState().setTurnState('recording');
      usePlanTalkStore.getState().setError(null);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(recorder.getElapsedMs());
      }, 200);
    } catch (err) {
      if (err instanceof MicPermissionError) {
        setMicDenied(true);
      }
      recorder.destroy();
      recorderRef.current = null;
    }
  }, [isBusy]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording()) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const blob = await recorder.stop();
      recorder.destroy();
      recorderRef.current = null;
      await transcribeAndAnalyze(blob, elevenLabsKey);
    } catch {
      usePlanTalkStore.getState().setError('Recording failed. Please try again.');
      usePlanTalkStore.getState().setTurnState('error');
    }
  }, [elevenLabsKey]);

  const handleMicPointerDown = useCallback(() => {
    if (voiceInputMode === 'hold_to_talk' && !isRecording) {
      startRecording();
    }
  }, [voiceInputMode, isRecording, startRecording]);

  const handleMicPointerUp = useCallback(() => {
    if (voiceInputMode === 'hold_to_talk' && isRecording) {
      stopRecording();
    }
  }, [voiceInputMode, isRecording, stopRecording]);

  const handleMicClick = useCallback(() => {
    if (voiceInputMode === 'toggle') {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  }, [voiceInputMode, isRecording, startRecording, stopRecording]);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput('');
    analyzeReflection(text).catch(() => {});
  }, [input, isBusy]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className={styles.voicePane}>
      <div className={styles.transcriptArea} ref={scrollRef}>
        {turns.length === 0 && (
          <div className={styles.emptyState}>
            Share your thoughts about the plan. The AI will analyze gaps and suggest improvements.
          </div>
        )}
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`${styles.turnBubble} ${turn.speaker === 'user' ? styles.turnUser : styles.turnAi}`}
          >
            <div className={styles.turnLabel}>
              {turn.speaker}
              {turn.source === 'voice' && ' (voice)'}
            </div>
            {turn.transcriptText}
          </div>
        ))}
        {turnState === 'analyzing' && (
          <div className={styles.analyzing}>
            <div className={styles.spinner} />
            <span className={styles.analyzingText}>Analyzing your reflection...</span>
          </div>
        )}
      </div>

      {turnState === 'transcribing' && (
        <div className={styles.transcribingBar}>
          <div className={styles.spinner} style={{ width: 16, height: 16, borderWidth: 2 }} />
          <span>Transcribing...</span>
        </div>
      )}

      <div className={styles.inputArea}>
        <textarea
          className={styles.textInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={micAvailable ? 'Type or use mic...' : 'Type your reflection on the plan...'}
          disabled={isBusy}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {isRecording && (
            <span className={styles.recordingTimer}>{formatElapsed(elapsed)}</span>
          )}
          <button
            className={`${styles.micBtn} ${isRecording ? styles.micBtnRecording : ''}`}
            onPointerDown={handleMicPointerDown}
            onPointerUp={handleMicPointerUp}
            onClick={handleMicClick}
            disabled={!micAvailable || (isBusy && !isRecording)}
            type="button"
            title={!elevenLabsKey ? 'Set ElevenLabs API key in Settings' : micDenied ? 'Microphone permission denied' : isRecording ? 'Stop recording' : 'Record'}
          >
            {isRecording ? '⏹' : '🎙'}
          </button>
          <button
            className={styles.sendBtn}
            onClick={handleSubmit}
            disabled={!input.trim() || isBusy}
            type="button"
          >
            Send
          </button>
        </div>
      </div>
      {micDenied && (
        <div className={styles.micHint}>Microphone access was denied. You can still type your reflections.</div>
      )}
    </div>
  );
}
