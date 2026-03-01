import { useEffect, useCallback } from 'react';
import { usePlanTalkStore } from '../../store/plan-talk-store';
import { useSemanticStore } from '../../store/semantic-store';
import { applyAllAccepted } from '../../store/plan-talk-actions';
import { VoicePane } from './VoicePane';
import { AnalysisPane } from './AnalysisPane';
import styles from './PlanTalkModal.module.css';

export function PlanTalkModal() {
  const isOpen = usePlanTalkStore((s) => s.isOpen);
  const close = usePlanTalkStore((s) => s.close);
  const clear = usePlanTalkStore((s) => s.clear);
  const pendingEdits = usePlanTalkStore((s) => s.pendingEdits);
  const unifiedPlan = useSemanticStore((s) => s.unifiedPlan);

  const acceptedCount = pendingEdits.filter((e) => e.approved).length;

  const handleClose = useCallback(() => {
    close();
    clear();
  }, [close, clear]);

  const handleApply = useCallback(() => {
    applyAllAccepted();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.modalTitle}>Talk to Plan</h2>
            {unifiedPlan && (
              <span className={styles.revisionBadge}>
                rev {unifiedPlan.revision ?? 1}
              </span>
            )}
          </div>
          <button className={styles.closeBtn} onClick={handleClose} type="button">
            Close
          </button>
        </div>

        <VoicePane />
        <AnalysisPane />

        <div className={styles.footer}>
          <button
            className={styles.applyBtn}
            onClick={handleApply}
            disabled={acceptedCount === 0}
            type="button"
          >
            Apply {acceptedCount > 0 ? `${acceptedCount} edit${acceptedCount > 1 ? 's' : ''}` : 'selected edits'}
          </button>
        </div>
      </div>
    </div>
  );
}
