import { useState } from 'react';
import VoiceInputPanel from './components/VoiceInputPanel';
import StatusBar from './components/StatusBar';
import Settings from './components/Settings';
import History from './components/History';

type Tab = 'input' | 'settings' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('input');

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span className="app-icon">🎤</span>
          语音输入法
        </h1>
        <span className="version">v1.0</span>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          <span className="nav-icon">⌨️</span>
          输入
        </button>
        <button
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="nav-icon">📋</span>
          历史
        </button>
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span className="nav-icon">⚙️</span>
          设置
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'input' && <VoiceInputPanel />}
        {activeTab === 'history' && <History />}
        {activeTab === 'settings' && <Settings />}
      </main>

      <StatusBar />
    </div>
  );
}
