import { useSessionStore } from './store/session-store';
import { TopicInput } from './components/TopicInput/TopicInput';
import { FudaCanvas } from './components/Canvas/FudaCanvas';
import { Toolbar } from './components/Toolbar/Toolbar';
import './App.css';

function App() {
  const uiMode = useSessionStore(s => s.uiMode);
  const session = useSessionStore(s => s.session);

  return (
    <div className="app">
      {session && <Toolbar />}
      <main className="app-main">
        {uiMode === 'topic_input' && <TopicInput />}
        {(uiMode === 'compass' || uiMode === 'exploring') && <FudaCanvas />}
      </main>
    </div>
  );
}

export default App;
