import { useState, useCallback } from 'react';
import { useSessionStore } from '../../store/session-store.ts';
import { useSemanticStore } from '../../store/semantic-store.ts';
import { useViewStore } from '../../store/view-store.ts';
import { usePlanTalkStore } from '../../store/plan-talk-store.ts';
import { toggleTerminal } from '../../store/terminal-actions.ts';
import { saveSession } from '../../persistence/hooks.ts';
import { Settings } from '../Settings/Settings.tsx';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const session = useSessionStore(s => s.session);
  const uiMode = useSessionStore(s => s.uiMode);
  const planPanelOpen = useSessionStore(s => s.planPanelOpen);
  const togglePlanPanel = useSessionStore(s => s.togglePlanPanel);
  const nodeCount = useSemanticStore(s => s.nodes.length);
  const unifiedPlan = useSemanticStore(s => s.unifiedPlan);
  const openPlanTalk = usePlanTalkStore(s => s.open);
  const terminalOpen = useViewStore(s => s.terminalOpen);
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
          {session && uiMode === 'exploring' && (
            <button
              className={`${styles.terminalToggle} ${terminalOpen ? styles.terminalToggleActive : ''}`}
              onClick={() => toggleTerminal()}
              type="button"
              aria-label={terminalOpen ? 'Close terminal' : 'Open terminal'}
              title="Ctrl+`"
            >
              Terminal
            </button>
          )}
          {session && uiMode === 'exploring' && (
            <button
              className={`${styles.planToggle} ${planPanelOpen ? styles.planToggleActive : ''}`}
              onClick={togglePlanPanel}
              type="button"
              aria-label={planPanelOpen ? 'Close plan panel' : 'Open plan panel'}
            >
              Plan
            </button>
          )}
          {session && unifiedPlan && (
            <button
              className={styles.planToggle}
              onClick={openPlanTalk}
              type="button"
              aria-label="Talk to Plan"
            >
              Talk to Plan
            </button>
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
