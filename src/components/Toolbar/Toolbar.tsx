import { useSessionStore } from '../../store/session-store.ts';
import { useSemanticStore } from '../../store/semantic-store.ts';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const session = useSessionStore(s => s.session);
  const uiMode = useSessionStore(s => s.uiMode);
  const nodeCount = useSemanticStore(s => s.nodes.length);

  if (!session) return null;

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.topic}>{session.topic}</span>
        <span className={styles.status}>{session.status}</span>
      </div>
      <div className={styles.center}>
        <span className={styles.mode}>{uiMode}</span>
      </div>
      <div className={styles.right}>
        <span className={styles.nodeCount}>{nodeCount} nodes</span>
      </div>
    </div>
  );
}
