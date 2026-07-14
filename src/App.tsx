import React, { useState } from 'react';

export default function App() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    { role: 'assistant', content: '您好！我是您的物料管理助手。在首次开始前，请告诉我您的项目号、成本中心，并提供您的产品 BOM 清单。' }
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: inputText }]);
    setInputText('');
  };

  return (
    <div className="app-container">
      {/* Column 1: Project Metadata Panel */}
      <aside className="left-panel">
        <header className="panel-header">
          <h2>项目概览</h2>
        </header>
        <div className="panel-content">
          <div className="meta-card">
            <span className="label">项目号</span>
            <span className="value">—</span>
          </div>
          <div className="meta-card">
            <span className="label">成本中心</span>
            <span className="value">—</span>
          </div>
          <div className="meta-card">
            <span className="label">目标建造样机</span>
            <span className="value">—</span>
          </div>
        </div>
      </aside>

      {/* Column 2: Agent Conversational Chat Window */}
      <main className="middle-panel">
        <header className="panel-header">
          <h2>Agent 对话窗口</h2>
        </header>
        <div className="chat-history">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-bubble ${msg.role}`}>
              <div className="sender">{msg.role === 'assistant' ? 'Agent' : '用户'}</div>
              <div className="content">{msg.content}</div>
            </div>
          ))}
        </div>
        <div className="chat-input-bar">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="与 Agent 对话，或粘贴 BOM 进行配置..."
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button onClick={handleSend}>发送</button>
        </div>
      </main>

      {/* Column 3: Kanban & Inventory Dashboard */}
      <section className="right-panel">
        <header className="panel-header">
          <h2>可视化物料看板</h2>
        </header>
        <div className="dashboard-content">
          <div className="no-project-alert">
            <p>请在中间对话框中配置项目信息和 BOM 之后查看物料看板。</p>
          </div>
        </div>
      </section>
    </div>
  );
}
