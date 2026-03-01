import styles from './PromotionBadge.module.css';

interface PromotionBadgeProps {
  isPromoted: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function PromotionBadge({ isPromoted, onClick, disabled }: PromotionBadgeProps) {
  return (
    <button
      className={`${styles.badge} ${isPromoted ? styles.promoted : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={isPromoted ? 'Unpromote' : 'Promote as evidence'}
    >
      {isPromoted ? '\u2605' : '\u2606'}
    </button>
  );
}
