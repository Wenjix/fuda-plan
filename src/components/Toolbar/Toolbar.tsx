import { useState, useCallback } from 'react';
import { useSessionStore } from '../../store/session-store.ts';
import { useSemanticStore } from '../../store/semantic-store.ts';
import { useViewStore } from '../../store/view-store.ts';
import { usePlanTalkStore } from '../../store/plan-talk-store.ts';
import { useQuadrantStore } from '../../store/quadrant-store.ts';
import { toggleTerminal } from '../../store/terminal-actions.ts';
import { saveSession } from '../../persistence/hooks.ts';
import { Settings } from '../Settings/Settings.tsx';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const session = useSessionStore(s => s.session);
  const uiMode = useSessionStore(s => s.uiMode);
  const layoutMode = useSessionStore(s => s.layoutMode);
  const setLayoutMode = useSessionStore(s => s.setLayoutMode);
  const planPanelOpen = useSessionStore(s => s.planPanelOpen);
  const togglePlanPanel = useSessionStore(s => s.togglePlanPanel);
  const nodeCount = useSemanticStore(s => s.nodes.length);
  const unifiedPlan = useSemanticStore(s => s.unifiedPlan);
  const openPlanTalk = usePlanTalkStore(s => s.open);
  const terminalOpen = useViewStore(s => s.terminalOpen);
  const autoResize = useQuadrantStore(s => s.autoResize);
  const setAutoResize = useQuadrantStore(s => s.setAutoResize);
  const resetSplits = useQuadrantStore(s => s.resetSplits);
  const panes = useQuadrantStore(s => s.panes);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleWorkspaceClick = useCallback(() => {
    saveSession().catch(() => {});
    useSessionStore.getState().setUIMode('workspace');
  }, []);

  const hasManualOverride = panes.some(p => p.pinned);

  const showLayoutToggle = session && (uiMode === 'exploring' || uiMode === 'compass');

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
          {showLayoutToggle ? (
            <div className={styles.layoutToggle}>
              <button
                className={`${styles.layoutBtn} ${layoutMode === 'single' ? styles.layoutBtnActive : ''}`}
                onClick={() => setLayoutMode('single')}
                type="button"
              >
                Canvas
              </button>
              <button
                className={`${styles.layoutBtn} ${layoutMode === 'quadrant' ? styles.layoutBtnActive : ''}`}
                onClick={() => setLayoutMode('quadrant')}
                type="button"
              >
                Quadrant
              </button>
            </div>
          ) : (
            session && <span className={styles.mode}>{uiMode}</span>
          )}
        </div>
        <div className={styles.right}>
          {session && (
            <span className={styles.nodeCount}>{nodeCount} nodes</span>
          )}
          {/* Auto-resize toggle (quadrant mode only) */}
          {session && layoutMode === 'quadrant' && uiMode === 'exploring' && (
            <button
              className={`${styles.planToggle} ${autoResize ? styles.planToggleActive : ''}`}
              onClick={() => setAutoResize(!autoResize)}
              type="button"
              title="Auto-resize panes based on activity"
            >
              Auto
            </button>
          )}
          {/* Reset button (visible when panes have manual overrides) */}
          {session && layoutMode === 'quadrant' && hasManualOverride && (
            <button
              className={styles.planToggle}
              onClick={resetSplits}
              type="button"
              title="Reset pane sizes to equal"
            >
              Reset
            </button>
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
