import { useCallback } from 'react';
import styles from './ConversationCompass.module.css';

const DIRECTIONS = [
  { pathType: 'clarify', label: 'Clarify', angle: 270 },
  { pathType: 'go-deeper', label: 'Go Deeper', angle: 330 },
  { pathType: 'challenge', label: 'Challenge', angle: 30 },
  { pathType: 'apply', label: 'Apply', angle: 90 },
  { pathType: 'connect', label: 'Connect', angle: 150 },
  { pathType: 'surprise', label: 'Surprise', angle: 210 },
] as const;

interface CompassProps {
  onSelect: (pathType: string) => void;
  questions?: Record<string, string>;
  disabled?: boolean;
}

export function ConversationCompass({ onSelect, questions, disabled }: CompassProps) {
  const handleClick = useCallback((pathType: string) => {
    if (!disabled) onSelect(pathType);
  }, [onSelect, disabled]);

  return (
    <div className={styles.compass}>
      <div className={styles.center}>
        <span className={styles.centerLabel}>Explore</span>
      </div>
      {DIRECTIONS.map(({ pathType, label, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const radius = 120;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        const question = questions?.[pathType];

        return (
          <button
            key={pathType}
            className={styles.direction}
            style={{
              transform: `translate(${x}px, ${y}px)`,
            }}
            onClick={() => handleClick(pathType)}
            disabled={disabled}
            title={question}
          >
            <span className={styles.directionLabel}>{label}</span>
            {question && (
              <span className={styles.directionQuestion}>{question.slice(0, 60)}...</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
