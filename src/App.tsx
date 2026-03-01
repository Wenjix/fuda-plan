import { useCallback, useEffect } from 'react';
import { useSessionStore } from './store/session-store';
import { useSemanticStore } from './store/semantic-store';
import { useViewStore } from './store/view-store';
import { switchSession, deleteSession, listSessions } from './store/workspace-actions';
import { generateLanePlan } from './store/plan-actions';
import { triggerSynthesis } from './store/synthesis-actions';
import { toggleTerminal } from './store/terminal-actions';
import { usePlanTalkStore } from './store/plan-talk-store';
import { TopicInput } from './components/TopicInput/TopicInput';
import { FudaCanvas } from './components/Canvas/FudaCanvas';
import { PlanPanel } from './components/PlanPanel/PlanPanel';
import { SessionList } from './components/SessionList/SessionList';
import { Toolbar } from './components/Toolbar/Toolbar';
import { PlanTalkModal } from './components/PlanTalkModal/PlanTalkModal';
import { TerminalDrawer } from './components/TerminalDrawer/TerminalDrawer';
import { useTheme } from './components/Settings/ThemeProvider';
import './App.css';

function App() {
  useTheme();
  const uiMode = useSessionStore(s => s.uiMode);
  const session = useSessionStore(s => s.session);
  const planPanelOpen = useSessionStore(s => s.planPanelOpen);
  const terminalOpen = useViewStore(s => s.terminalOpen);

  // On initial mount with no session, check IDB for saved sessions
  useEffect(() => {
    if (session) return; // Already have a session
    if (uiMode !== 'topic_input') return; // Already navigating somewhere

    let cancelled = false;
    listSessions()
      .then((sessions) => {
        if (cancelled) return;
        if (sessions.length > 0) {
          useSessionStore.getState().setUIMode('workspace');
        }
      })
      .catch(() => {
        // IDB unavailable; stay on topic_input
      });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenSession = useCallback((sessionId: string) => {
    switchSession(sessionId).catch((err) => {
      console.warn('Failed to switch session:', err);
    });
  }, []);

  const handleNewSession = useCallback(() => {
    useSessionStore.getState().setUIMode('topic_input');
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    deleteSession(sessionId).catch((err) => {
      console.warn('Failed to delete session:', err);
    });
  }, []);

  const handleGeneratePlan = useCallback((laneId: string) => {
    const lanes = useSemanticStore.getState().lanes;
    const lane = lanes.find(l => l.id === laneId);
    const personaId = lane?.personaId ?? 'analytical';
    generateLanePlan(laneId, personaId).catch((err) => {
      console.error('Failed to generate lane plan:', err);
    });
  }, []);

  const handleSynthesize = useCallback(async () => {
    try {
      await triggerSynthesis();
    } catch (err) {
      console.error('Failed to trigger synthesis:', err);
    }
  }, []);

  const handleTalkToPlan = useCallback(() => {
    usePlanTalkStore.getState().open();
  }, []);

  // Keyboard shortcut: Ctrl+` toggles terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToolbar = session || uiMode === 'workspace';

  return (
    <div className="app">
      {showToolbar && <Toolbar />}
      <main className="app-main">
        {uiMode === 'topic_input' && <TopicInput />}
        {uiMode === 'workspace' && (
          <SessionList
            onOpenSession={handleOpenSession}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
          />
        )}
        {(uiMode === 'compass' || uiMode === 'exploring') && (
          <div className="exploring-layout">
            <div className="exploring-content">
              <FudaCanvas />
              {terminalOpen && <TerminalDrawer />}
            </div>
            {planPanelOpen && (
              <div className="plan-panel-container">
                <PlanPanel
                  onGeneratePlan={handleGeneratePlan}
                  onSynthesize={handleSynthesize}
                  onTalkToPlan={handleTalkToPlan}
                />
              </div>
            )}
          </div>
        )}
      </main>
      <PlanTalkModal />
    </div>
  );
}

export default App;
