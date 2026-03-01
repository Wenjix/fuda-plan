import { useState, useCallback } from 'react';
import { useSessionStore } from '../../store/session-store.ts';
import { useSemanticStore } from '../../store/semantic-store.ts';
import { saveSession } from '../../persistence/hooks.ts';
import { Settings } from '../Settings/Settings.tsx';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const session = useSessionStore(s => s.session);
  const uiMode = useSessionStore(s => s.uiMode);
  const nodeCount = useSemanticStore(s => s.nodes.length);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleWorkspaceClick = useCallback(() => {
    // Save current work before navigating
    saveSession().catch(() => {
      // Best-effort save; don't block navigation
    });
    useSessionStore.getState().setUIMode('workspace');
  }, []);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.left}>
          <button
            className={styles.brand}
            onClick={handleWorkspaceClick}
            type="button"
            title="Back to sessions"
          >
            FUDA
          </button>
          {session && (
            <>
              <span className={styles.topic}>{session.topic}</span>
              <span className={styles.status}>{session.status}</span>
            </>
          )}
        </div>
        <div className={styles.center}>
          {session && <span className={styles.mode}>{uiMode}</span>}
        </div>
        <div className={styles.right}>
          {session && (
            <span className={styles.nodeCount}>{nodeCount} nodes</span>
          )}
          <button
            className={styles.settingsButton}
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            &#x2699;
          </button>
        </div>
      </div>
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
