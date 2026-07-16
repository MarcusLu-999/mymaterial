import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface ProjectConfig {
  projectId: string;
  costCenter: string;
  targetQty: number;
}

export interface BomItem {
  code: string;
  name: string;
  qtyPerMachine: number;
  owner: string;
  status: 'Pending' | 'OA Submitted';
  currentStock: number;
  leadTime: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  riskAlert?: {
    code: string;
    reason: string;
  };
  emailDraft?: {
    subject: string;
    body: string;
    recipient?: string;
  };
}

interface ProjectContextType {
  project: ProjectConfig | null;
  bomItems: BomItem[];
  bomCoverage: number;
  buildableMachines: number;
  shortageItemsCount: number;
  messages: Message[];
  inputText: string;
  setInputText: (text: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: 'All' | 'Shortage' | 'High Risk';
  setFilter: (filter: 'All' | 'Shortage' | 'High Risk') => void;
  loading: boolean;
  syncing: boolean;
  exporting: boolean;
  error: string | null;
  fetchProjectState: () => Promise<void>;
  sendMessage: (customText?: string) => Promise<void>;
  syncMass: () => Promise<void>;
  exportOa: () => Promise<void>;
  resetProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<ProjectConfig | null>(null);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [bomCoverage, setBomCoverage] = useState<number>(0);
  const [buildableMachines, setBuildableMachines] = useState<number>(0);
  const [shortageItemsCount, setShortageItemsCount] = useState<number>(0);
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '您好！我是您的物料管理助手。在首次开始前，请告诉我您的项目号、成本中心，并提供您的产品 BOM 清单。' }
  ]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Shortage' | 'High Risk'>('All');
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch complete project state
  const fetchProjectState = useCallback(async () => {
    try {
      const res = await fetch('/api/project');
      if (!res.ok) throw new Error('Failed to load project details');
      const data = await res.json();
      
      setProject(data.project);
      setBomItems(data.bomItems || []);
      setBomCoverage(data.bomCoverage || 0);
      setBuildableMachines(data.buildableMachines || 0);
      setShortageItemsCount(data.shortageItemsCount || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch state on mount
  useEffect(() => {
    fetchProjectState();
  }, [fetchProjectState]);

  // Send message to assistant
  const sendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim()) return;

    setError(null);
    const updatedMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(updatedMessages);
    setInputText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
      });
      if (!res.ok) {
        throw new Error('对话超时或服务不可用。请检查网络。');
      }
      const data = await res.json();
      setMessages(data.chatHistory || [...updatedMessages, { role: 'assistant', content: data.reply }]);
      
      // Post-message actions (e.g. project setup detected, new BOM, reset)
      // Refetch state as the project might be created or updated
      await fetchProjectState();
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
  };

  // Sync with MASS system
  const syncMass = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/mass/sync');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'MASS sync request failed.');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error('Synchronization returned unsuccessful status.');
      }
      
      // Refresh local store details
      await fetchProjectState();
      
      // Auto-append sync summary/alert messages if new assistant entries were pushed on the backend
      const checkRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        setMessages(checkData.chatHistory);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Export to OA Purchase system
  const exportOa = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/purchase/export', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to trigger purchase export.');
      }
      
      // Fetch binary blob of CSV
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `${project?.projectId || 'project'}_purchase.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      // Download file to disk
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Re-fetch project state since BOM status transitions to "OA Submitted"
      await fetchProjectState();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  // Explicit Wiping & Reset Utility
  const resetProject = async () => {
    setError(null);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Reset project' }] })
      });
      await fetchProjectState();
      setMessages([
        { role: 'assistant', content: '您好！我是您的物料管理助手。在首次开始前，请告诉我您的项目号、成本中心，并提供您的产品 BOM 清单。' }
      ]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <ProjectContext.Provider value={{
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
      fetchProjectState,
      sendMessage,
      syncMass,
      exportOa,
      resetProject
    }}>
      {children}
    </ProjectContext.Provider>
  );
};
