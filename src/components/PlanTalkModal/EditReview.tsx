import type { ProposedPlanEdit } from '../../core/types';
import styles from './PlanTalkModal.module.css';

interface EditReviewProps {
  edit: ProposedPlanEdit;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function EditReview({ edit, onAccept, onReject }: EditReviewProps) {
  return (
    <div className={styles.editCard}>
      <div className={styles.editHeader}>
        <span className={styles.editOp}>{edit.operation.replace(/_/g, ' ')}</span>
        <span className={styles.editConfidence}>
          {Math.round(edit.confidence * 100)}% confidence
        </span>
      </div>

      {edit.targetHeading && (
        <p className={styles.editTarget}>Target: {edit.targetHeading}</p>
      )}

      <p className={styles.editReason}>{edit.reason}</p>

      {edit.draftContent && edit.draftContent.length > 0 && (
        <ul className={styles.editDraft}>
          {edit.draftContent.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      <div className={styles.editActions}>
        <button
          className={`${styles.acceptBtn} ${edit.approved ? styles.accepted : ''}`}
          onClick={() => onAccept(edit.id)}
          type="button"
        >
          {edit.approved ? 'Accepted' : 'Accept'}
        </button>
        {!edit.approved && (
          <button
            className={styles.rejectBtn}
            onClick={() => onReject(edit.id)}
            type="button"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
