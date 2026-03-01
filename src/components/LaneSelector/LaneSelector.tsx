import { useSessionStore } from '../../store/session-store';
import styles from './LaneSelector.module.css';

interface Lane {
  id: string;
  label: string;
  colorToken: string;
  personaId: string;
}

interface LaneSelectorProps {
  lanes: Lane[];
}

export function LaneSelector({ lanes }: LaneSelectorProps) {
  const activeLaneId = useSessionStore(s => s.activeLaneId);
  const setActiveLane = useSessionStore(s => s.setActiveLane);

  return (
    <div className={styles.selector}>
      {lanes.map(lane => (
        <button
          key={lane.id}
          className={`${styles.tab} ${activeLaneId === lane.id ? styles.active : ''}`}
          onClick={() => setActiveLane(lane.id)}
          style={{ '--lane-color': lane.colorToken } as React.CSSProperties}
        >
          <span className={styles.dot} style={{ background: lane.colorToken }} />
          <span className={styles.label}>{lane.label}</span>
        </button>
      ))}
    </div>
  );
}
