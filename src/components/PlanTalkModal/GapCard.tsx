import type { PlanGapCard as GapCardType } from '../../core/types';
import styles from './PlanTalkModal.module.css';

interface GapCardProps {
  card: GapCardType;
}

export function GapCard({ card }: GapCardProps) {
  const severityClass =
    card.severity === 'high' ? styles.gapCardHigh :
    card.severity === 'medium' ? styles.gapCardMedium :
    styles.gapCardLow;

  const badgeClass =
    card.severity === 'high' ? styles.severityHigh :
    card.severity === 'medium' ? styles.severityMedium :
    styles.severityLow;

  return (
    <div className={`${styles.gapCard} ${severityClass}`}>
      <div className={styles.gapHeader}>
        <span className={`${styles.severityBadge} ${badgeClass}`}>
          {card.severity}
        </span>
        <h5 className={styles.gapTitle}>{card.title}</h5>
      </div>
      <p className={styles.gapDescription}>{card.description}</p>
      <span className={styles.gapSection}>{card.sectionKey}</span>
    </div>
  );
}
