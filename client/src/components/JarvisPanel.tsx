import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'jarvis';
  content: string;
  timestamp: Date;
}

interface JarvisPanelProps {
  onQuery: (query: string) => void;
  onSwitchView: (view: 'globe' | 'graph') => void;
  activeView: 'globe' | 'graph';
  loading: boolean;
  graphStats: { nodes: number; edges: number } | null;
}

export default function JarvisPanel({ onQuery, onSwitchView, activeView, loading, graphStats }: JarvisPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'jarvis', content: 'JARVIS Intelligence System online. Enter a query to generate a knowledge graph or analyze global intelligence data.', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const q = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
    setInput('');
    onQuery(q);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'jarvis',
        content: `Generating intelligence graph for: "${q}"...`,
        timestamp: new Date()
      }]);
    }, 300);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'globe') {
      onSwitchView('globe');
    } else if (action === 'graph') {
      onSwitchView('graph');
    } else {
      setInput(action);
    }
  };

  const quickActions = [
    { label: 'GLOBE VIEW', action: 'globe', icon: '◉' },
    { label: 'GRAPH VIEW', action: 'graph', icon: '◈' },
  ];

  const exampleQueries = [
'India LPG supply chain',
'Strait of Hormuz geopolitics',
'India fuel price inflation',
'India transportation logistics',
'Energy diversification India',
'Maritime security Indian Ocean',
'India economic stability risks',
'Global supply chain disruption',
'India strategic oil reserves',
'Public policy fuel subsidies India',
'India household energy impact',
'India import dependency analysis'
  ];

  return (
    <div className="jarvis-panel">
      <div className="jarvis-header">
        <div className="jarvis-title">
          <span className="jarvis-pulse" />
          <h3>JARVIS</h3>
          <span className="jarvis-badge">AI</span>
        </div>
        <span className="jarvis-status">
          {loading ? 'PROCESSING' : 'STANDBY'}
        </span>
      </div>

      {/* View Switcher */}
      <div className="view-switcher">
        {quickActions.map(qa => (
          <button
            key={qa.action}
            className={`view-btn ${activeView === qa.action ? 'active' : ''}`}
            onClick={() => handleQuickAction(qa.action)}
          >
            <span>{qa.icon}</span> {qa.label}
          </button>
        ))}
      </div>

      {/* Graph Stats */}
      {graphStats && activeView === 'graph' && (
        <div className="jarvis-stats">
          <div className="js-stat"><strong>{graphStats.nodes}</strong><span>NODES</span></div>
          <div className="js-stat"><strong>{graphStats.edges}</strong><span>EDGES</span></div>
        </div>
      )}

      {/* Messages */}
      <div className="jarvis-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`jarvis-msg ${msg.role}`}>
            <div className="msg-content">{msg.content}</div>
            <div className="msg-time">
              {msg.timestamp.toLocaleTimeString('en-US', { hour12: false })}
            </div>
          </div>
        ))}
        {loading && (
          <div className="jarvis-msg jarvis typing">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Example Queries */}
      {messages.length <= 2 && (
        <div className="jarvis-examples">
          <span className="ex-label">SUGGESTED QUERIES</span>
          {exampleQueries.map(q => (
            <button key={q} className="ex-chip" onClick={() => { setInput(q); }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form className="jarvis-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter intelligence query..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? '...' : '→'}
        </button>
      </form>
    </div>
  );
}
