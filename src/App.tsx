import { useCallback, useEffect } from 'react';
import { useSessionStore } from './store/session-store';
import { switchSession, deleteSession, listSessions } from './store/workspace-actions';
import { TopicInput } from './components/TopicInput/TopicInput';
import { FudaCanvas } from './components/Canvas/FudaCanvas';
import { SessionList } from './components/SessionList/SessionList';
import { Toolbar } from './components/Toolbar/Toolbar';
import { useTheme } from './components/Settings/ThemeProvider';
import './App.css';

function App() {
  useTheme();
  const uiMode = useSessionStore(s => s.uiMode);
  const session = useSessionStore(s => s.session);

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
        {(uiMode === 'compass' || uiMode === 'exploring') && <FudaCanvas />}
      </main>
    </div>
  );
}

export default App;
