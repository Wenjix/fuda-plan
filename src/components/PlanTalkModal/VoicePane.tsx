import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlanTalkStore } from '../../store/plan-talk-store';
import { analyzeReflection } from '../../store/plan-talk-actions';
import styles from './PlanTalkModal.module.css';

export function VoicePane() {
  const turns = usePlanTalkStore((s) => s.turns);
  const turnState = usePlanTalkStore((s) => s.turnState);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAnalyzing = turnState === 'analyzing';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length]);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || isAnalyzing) return;
    setInput('');
    analyzeReflection(text).catch(() => {
      // Error is captured in the store
    });
  }, [input, isAnalyzing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

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
            <div className={styles.turnLabel}>{turn.speaker}</div>
            {turn.transcriptText}
          </div>
        ))}
        {isAnalyzing && (
          <div className={styles.analyzing}>
            <div className={styles.spinner} />
            <span className={styles.analyzingText}>Analyzing your reflection...</span>
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <textarea
          className={styles.textInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your reflection on the plan... (Enter to send, Shift+Enter for newline)"
          disabled={isAnalyzing}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSubmit}
          disabled={!input.trim() || isAnalyzing}
          type="button"
        >
          Send
        </button>
      </div>
    </div>
  );
}
