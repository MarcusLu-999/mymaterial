import React, { useState, useEffect, useRef } from 'react';
import { ProjectProvider, useProject, Message, BomItem } from './context/ProjectContext';
import { 
  Search, 
  RotateCw, 
  Download, 
  AlertTriangle, 
  Mail, 
  Copy, 
  Check, 
  Folder, 
  Layers, 
  Cpu, 
  User, 
  Sparkles, 
  Info,
  RefreshCw,
  Send,
  Trash2
} from 'lucide-react';

function MainApp() {
  const {
    project,
    bomItems,
    bomCoverage,
    buildableMachines,
    shortageItemsCount,
    messages,
    inputText,
    setInputText,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    loading,
    syncing,
    exporting,
    error,
    sendMessage,
    syncMass,
    exportOa,
    resetProject
  } = useProject();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedProject, setCopiedProject] = useState(false);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage();
  };

  const handleCopyProject = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedProject(true);
      setTimeout(() => setCopiedProject(false), 2000);
    } catch (err) {
      console.error('Failed to copy project ID', err);
    }
  };

  const handleCopyDraft = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(idx);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy draft', err);
    }
  };

  const isEmailDraft = (content: string) => {
    return content && (content.includes('Subject:') || content.includes('主题：'));
  };

  // Filter BOM items
  const filteredBomItems = bomItems.filter((item) => {
    const targetQty = project?.targetQty || 0;
    const reqQty = item.qtyPerMachine * targetQty;
    const isShortage = item.currentStock < reqQty;
    const isHighRisk = item.riskLevel === 'High';

    const matchesSearch = 
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'Shortage') {
      return isShortage;
    } else if (filter === 'High Risk') {
      return isHighRisk;
    }
    return true;
  });

  return (
    <div className="app-container">
      {/* Column 1: Left Panel - Metadata & KPIs */}
      <aside className="left-panel">
        <header className="panel-header">
          <h2>
            <Folder size={18} className="text-violet-400" />
            项目看板概览
          </h2>
        </header>
        
        <div className="panel-content">
          <div className="meta-group-title">项目基本信息</div>
          
          <div className="meta-card">
            <div className="label">项目号</div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="value truncate">
                {project?.projectId || '未配置'}
              </span>
              {project?.projectId && (
                <button 
                  onClick={() => handleCopyProject(project.projectId)}
                  className="copy-btn-small"
                  title="复制项目号"
                >
                  {copiedProject ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>

          <div className="meta-card">
            <div className="label">成本中心</div>
            <span className="value mt-1 block truncate">
              {project?.costCenter || '未配置'}
            </span>
          </div>

          <div className="meta-card">
            <div className="label">目标建造样机</div>
            <span className="value mt-1 block">
              {project?.targetQty !== undefined ? `${project.targetQty} 台` : '未配置'}
            </span>
          </div>

          <div className="meta-group-title mt-4">物料关键指标 (KPI)</div>

          <div className="kpi-container">
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="label">BOM 齐套率</span>
                <span className="value">{(bomCoverage * 100).toFixed(0)}%</span>
              </div>
              <div className="kpi-progress-bar">
                <div 
                  className="kpi-progress-fill" 
                  style={{ width: `${bomCoverage * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="label">预计可装配台数</span>
                <span className="value">{buildableMachines} 台</span>
              </div>
              {project && buildableMachines < project.targetQty && (
                <div className="badge badge-warning mt-2 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  少于目标台数值 ({project.targetQty} 台)
                </div>
              )}
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="label">缺口款数</span>
                <span className={`value flex items-center gap-2 ${shortageItemsCount > 0 ? 'text-red-400 font-glow' : 'text-emerald-400'}`}>
                  {shortageItemsCount} 款
                  {shortageItemsCount === 0 && project && (
                    <Check size={14} className="text-emerald-400" />
                  )}
                </span>
              </div>
              {shortageItemsCount > 0 ? (
                <div className="badge badge-high mt-2 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  需要跟单催交
                </div>
              ) : project ? (
                <div className="badge badge-low mt-2 flex items-center gap-1">
                  <Check size={10} />
                  物料无缺口
                </div>
              ) : null}
            </div>
          </div>
          
          {error && (
            <div className="error-banner">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Column 2: Middle Panel - Chat & Agent Helper */}
      <main className="middle-panel">
        <header className="panel-header">
          <h2>
            <Sparkles size={18} className="text-violet-400" />
            AI 智能跟单助手
            <span className="status-dot"></span>
          </h2>
        </header>

        <div className="chat-history">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-bubble ${msg.role}`}>
              <div className="sender">
                {msg.role === 'assistant' ? (
                  <span className="flex items-center gap-1">
                    <Cpu size={12} />
                    Agent
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    用户
                  </span>
                )}
              </div>
              <div className="content whitespace-pre-wrap">{msg.content}</div>

              {/* Risk Alert Proactive Warning Card */}
              {msg.riskAlert && (
                <div className="alert-card">
                  <div className="alert-card-header">
                    <AlertTriangle size={14} />
                    <span>高风险物料警报: {msg.riskAlert.code}</span>
                  </div>
                  <div className="text-xs text-gray-300">
                    原因: {msg.riskAlert.reason}
                  </div>
                  <button 
                    onClick={() => sendMessage(`生成中文邮件草稿 ${msg.riskAlert?.code}`)}
                    className="alert-action-btn"
                  >
                    生成催货邮件
                  </button>
                </div>
              )}

              {/* Email Draft Card */}
              {msg.role === 'assistant' && (isEmailDraft(msg.content) || msg.emailDraft) && (
                <div className="draft-card">
                  <div className="draft-card-header">
                    <span className="flex items-center gap-1">
                      <Mail size={14} />
                      跟进邮件草稿
                    </span>
                  </div>
                  <div className="draft-body">
                    {msg.emailDraft ? (
                      `Subject: ${msg.emailDraft.subject}\n\n${msg.emailDraft.body}`
                    ) : (
                      msg.content
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      const textToCopy = msg.emailDraft
                        ? `Subject: ${msg.emailDraft.subject}\n\n${msg.emailDraft.body}`
                        : msg.content;
                      handleCopyDraft(textToCopy, idx);
                    }}
                    className="draft-btn"
                  >
                    {copiedId === idx ? (
                      <>
                        <Check size={12} />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        复制草稿
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-bar">
          <div className="shortcut-row">
            <span 
              onClick={() => sendMessage("催交高风险物料")}
              className="shortcut-badge"
            >
              催交高风险物料
            </span>
            <span 
              onClick={() => sendMessage("检查 M-001 缺口")}
              className="shortcut-badge"
            >
              检查 M-001 缺口
            </span>
            <span 
              onClick={() => resetProject()}
              className="shortcut-badge text-red-400 hover:bg-red-950/20"
            >
              重置项目
            </span>
          </div>

          <div className="input-wrapper">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="与 Agent 对话，或粘贴 BOM 进行配置..."
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend}>
              <Send size={16} />
            </button>
          </div>
        </div>
      </main>

      {/* Column 3: Right Panel - Kanban Dashboard */}
      <section className="right-panel">
        <header className="panel-header">
          <h2>
            <Layers size={18} className="text-violet-400" />
            物料库存明细
            {bomItems.length > 0 && (
              <span className="row-count-badge">{bomItems.length} 项</span>
            )}
          </h2>
        </header>

        <div className="dashboard-content">
          {(!project || bomItems.length === 0) ? (
            <div className="empty-state-card">
              <Layers size={48} className="text-gray-500 animate-pulse" />
              <p>请通过对话框配置项目信息并导入 BOM 以激活物料看板</p>
              <div className="text-left w-full mt-4 p-4 rounded bg-white/5 border border-white/5 text-xs text-gray-400 space-y-2">
                <div className="font-semibold text-violet-300">快速开始引导：</div>
                <div>1. 在对话框输入并发送配置信息，例如：</div>
                <code className="block bg-black/40 p-2 rounded text-emerald-400">
                  项目号: PRJ-2026-X1, 成本中心: CC-RD-HW-03, 目标台数: 5
                </code>
                <div>2. 然后粘贴 BOM 清单并发送，例如：</div>
                <code className="block bg-black/40 p-2 rounded text-emerald-400 whitespace-pre">
                  物料号,物料名称,单机用量,负责人{"\n"}
                  M-001,MCU Board,2,张三{"\n"}
                  M-002,12V Adapter,1,李四
                </code>
              </div>
            </div>
          ) : (
            <>
              <div className="dashboard-toolbar">
                <div className="search-container">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="按物料编码或名称搜索..."
                  />
                </div>

                <div className="filter-group">
                  <button
                    onClick={() => setFilter('All')}
                    className={`filter-btn ${filter === 'All' ? 'active' : ''}`}
                  >
                    All ({bomItems.length})
                  </button>
                  <button
                    onClick={() => setFilter('Shortage')}
                    className={`filter-btn ${filter === 'Shortage' ? 'active' : ''}`}
                  >
                    Shortage (有缺口) ({bomItems.filter(item => item.currentStock < item.qtyPerMachine * project.targetQty).length})
                  </button>
                  <button
                    onClick={() => setFilter('High Risk')}
                    className={`filter-btn ${filter === 'High Risk' ? 'active' : ''}`}
                  >
                    High Risk (高风险) ({bomItems.filter(item => item.riskLevel === 'High').length})
                  </button>
                </div>

                <div className="action-buttons">
                  <button
                    onClick={syncMass}
                    disabled={syncing}
                    className="btn-secondary"
                    title="同步 MASS 系统最新库存"
                  >
                    <RefreshCw size={14} className={syncing ? 'spin-icon' : ''} />
                    {syncing ? 'Syncing...' : 'Sync MASS'}
                  </button>

                  <button
                    onClick={exportOa}
                    disabled={exporting}
                    className="btn-primary"
                    title="导出有缺口的物料以生成采购申请单"
                  >
                    <Download size={14} />
                    {exporting ? 'Exporting...' : 'Export OA'}
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="bom-table">
                  <thead>
                    <tr>
                      <th>物料号</th>
                      <th>物料名称</th>
                      <th>单机用量</th>
                      <th>需求用量</th>
                      <th>当前库存</th>
                      <th>缺口数量</th>
                      <th>负责人</th>
                      <th>采购提前期</th>
                      <th>风险等级</th>
                      <th>物料状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBomItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center text-gray-500 py-8">
                          未找到匹配过滤条件的物料
                        </td>
                      </tr>
                    ) : (
                      filteredBomItems.map((item) => {
                        const reqQty = item.qtyPerMachine * project.targetQty;
                        const shortage = Math.max(0, reqQty - item.currentStock);
                        const isHighRisk = item.riskLevel === 'High';

                        return (
                          <tr 
                            key={item.code} 
                            className={isHighRisk ? 'high-risk-row' : ''}
                          >
                            <td className="font-semibold text-violet-300">{item.code}</td>
                            <td className="max-w-[120px] truncate" title={item.name}>{item.name}</td>
                            <td>{item.qtyPerMachine}</td>
                            <td className="font-semibold">{reqQty}</td>
                            <td className={item.currentStock < reqQty ? 'text-amber-400' : 'text-emerald-400'}>
                              {item.currentStock}
                            </td>
                            <td className={shortage > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                              {shortage}
                            </td>
                            <td>{item.owner || '—'}</td>
                            <td>{item.leadTime !== null && item.leadTime !== undefined ? `${item.leadTime}天` : '—'}</td>
                            <td>
                              <span className={`badge badge-${item.riskLevel.toLowerCase()}`}>
                                {item.riskLevel === 'High' ? '高风险' : item.riskLevel === 'Medium' ? '中风险' : '低风险'}
                              </span>
                            </td>
                            <td>
                              <span className={item.status === 'OA Submitted' ? 'status-badge-submitted' : 'status-badge-pending'}>
                                {item.status === 'OA Submitted' ? (
                                  <>
                                    <Check size={12} />
                                    OA Submitted
                                  </>
                                ) : (
                                  'Pending'
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <MainApp />
    </ProjectProvider>
  );
}
