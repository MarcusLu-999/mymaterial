import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';

// Initialize global tracking arrays
(globalThis as any).states = [];
(globalThis as any).stateSetters = [];
(globalThis as any).stateIdx = 0;

// Mock the React module
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  
  const mockUseState = (initialValue: any) => {
    const idx = (globalThis as any).stateIdx++;
    if ((globalThis as any).states[idx] === undefined) {
      (globalThis as any).states[idx] = initialValue;
    }
    const setter = (val: any) => {
      if (typeof val === 'function') {
        (globalThis as any).states[idx] = val((globalThis as any).states[idx]);
      } else {
        (globalThis as any).states[idx] = val;
      }
    };
    (globalThis as any).stateSetters[idx] = setter;
    return [(globalThis as any).states[idx], setter];
  };

  const mockUseRef = (initialValue: any) => {
    return { current: initialValue };
  };

  const mockUseEffect = (fn: any, deps: any) => {
    // Stub
  };

  return {
    ...original,
    default: {
      ...original,
      useState: mockUseState,
      useRef: mockUseRef,
      useEffect: mockUseEffect,
    },
    useState: mockUseState,
    useRef: mockUseRef,
    useEffect: mockUseEffect,
  };
});

// Setup mock clipboard
const mockClipboard = {
  clipboardText: '',
  async writeText(text: string) {
    this.clipboardText = text;
  },
  async readText() {
    return this.clipboardText;
  }
};

if (typeof globalThis.navigator === 'undefined') {
  (globalThis as any).navigator = { clipboard: mockClipboard };
} else {
  (globalThis as any).navigator.clipboard = mockClipboard;
}

describe('Frontend Component Empirical Verification', () => {
  let mockState: any;
  let MainApp: any;

  beforeAll(async () => {
    // Mock the useProject hook in a local sandbox context
    vi.doMock('../src/context/ProjectContext.tsx', () => ({
      useProject: () => mockState,
      ProjectProvider: ({ children }: any) => React.createElement('div', null, children)
    }));

    const AppMod = await import('../src/App.tsx');
    const appElement = AppMod.default();
    MainApp = appElement.props.children.type;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockClipboard.clipboardText = '';

    // Mock implementation for ProjectContext
    mockState = {
      project: { projectId: 'PRJ-TEST-123', costCenter: 'CC-TEST', targetQty: 10 },
      bomItems: [
        { code: 'M-001', name: 'MCU Board', qtyPerMachine: 2, owner: '张三', status: 'Pending', currentStock: 15, leadTime: 10, riskLevel: 'Low' },
        { code: 'M-002', name: '12V Adapter', qtyPerMachine: 1, owner: '李四', status: 'Pending', currentStock: 25, leadTime: 5, riskLevel: 'High' },
        { code: 'M-003', name: 'Resistor', qtyPerMachine: 5, owner: '王五', status: 'Pending', currentStock: 5, leadTime: 2, riskLevel: 'Low' },
      ],
      bomCoverage: 0.67,
      buildableMachines: 1,
      shortageItemsCount: 2,
      messages: [
        { role: 'assistant', content: '您好！我是您的物料管理助手。' },
        { role: 'assistant', content: 'Subject: 跟进 M-002\n\n请尽快交货。' }
      ],
      inputText: '',
      setInputText: vi.fn(),
      searchQuery: '',
      setSearchQuery: vi.fn(),
      filter: 'All',
      setFilter: vi.fn(),
      loading: false,
      syncing: false,
      exporting: false,
      error: null,
      sendMessage: vi.fn(),
      syncMass: vi.fn(),
      exportOa: vi.fn(),
      resetProject: vi.fn()
    };

    // Reset state tracking before each run
    (globalThis as any).states = [];
    (globalThis as any).stateSetters = [];
    (globalThis as any).stateIdx = 0;
  });

  // Helper to find a React element by its props or types
  function findElement(element: any, predicate: (el: any) => boolean): any {
    if (!element) return null;
    if (predicate(element)) return element;
    if (element.props && element.props.children) {
      const children = React.Children.toArray(element.props.children);
      for (const child of children) {
        const found = findElement(child, predicate);
        if (found) return found;
      }
    }
    return null;
  }

  // Helper to find all React elements by type/predicate
  function findAllElements(element: any, predicate: (el: any) => boolean, results: any[] = []): any[] {
    if (!element) return results;
    if (predicate(element)) results.push(element);
    if (element.props && element.props.children) {
      const children = React.Children.toArray(element.props.children);
      for (const child of children) {
        findAllElements(child, predicate, results);
      }
    }
    return results;
  }

  describe('1. Component Interactions (Search, Filters, Handlers)', () => {
    it('should support search and live keyword filtering', () => {
      // Case 1: Search for "MCU"
      mockState.searchQuery = 'MCU';
      let tree = MainApp();
      let tableBody = findElement(tree, (el) => el && el.type === 'tbody');
      expect(tableBody).toBeDefined();

      let rows = React.Children.toArray(tableBody.props.children);
      // M-001 matches "MCU Board"
      expect(rows).toHaveLength(1);
      const codeCell = findElement(rows[0], (el) => el && el.type === 'td' && el.props && el.props.className?.includes('text-violet-300'));
      expect(codeCell.props.children).toBe('M-001');

      // Case 2: Search with no matches
      mockState.searchQuery = 'NonExistentItem';
      // Reset state index for re-rendering
      (globalThis as any).stateIdx = 0;
      tree = MainApp();
      tableBody = findElement(tree, (el) => el && el.type === 'tbody');
      rows = React.Children.toArray(tableBody.props.children);
      expect(rows).toHaveLength(1); // shows the empty state row
      const centerCell = findElement(rows[0], (el) => el && el.type === 'td' && el.props && el.props.className?.includes('text-center'));
      expect(centerCell.props.children).toContain('未找到匹配过滤条件的物料');
    });

    it('should support quick filter options (All, Shortage, High Risk)', () => {
      // Under 'All', there should be 3 items
      mockState.filter = 'All';
      let tree = MainApp();
      let tableBody = findElement(tree, (el) => el && el.type === 'tbody');
      let rows = React.Children.toArray(tableBody.props.children);
      expect(rows).toHaveLength(3);

      // Under 'Shortage', only M-001 (15 stock vs 20 req) and M-003 (5 stock vs 50 req) should be visible
      mockState.filter = 'Shortage';
      (globalThis as any).stateIdx = 0;
      tree = MainApp();
      tableBody = findElement(tree, (el) => el && el.type === 'tbody');
      rows = React.Children.toArray(tableBody.props.children);
      expect(rows).toHaveLength(2);
      const row1Code = findElement(rows[0], (el) => el && el.props && el.props.children === 'M-001');
      const row2Code = findElement(rows[1], (el) => el && el.props && el.props.children === 'M-003');
      expect(row1Code).toBeDefined();
      expect(row2Code).toBeDefined();

      // Under 'High Risk', only M-002 (riskLevel = High) should be visible
      mockState.filter = 'High Risk';
      (globalThis as any).stateIdx = 0;
      tree = MainApp();
      tableBody = findElement(tree, (el) => el && el.type === 'tbody');
      rows = React.Children.toArray(tableBody.props.children);
      expect(rows).toHaveLength(1);
      const rowHighRiskCode = findElement(rows[0], (el) => el && el.props && el.props.children === 'M-002');
      expect(rowHighRiskCode).toBeDefined();
    });

    it('should correctly hook up click handlers for Sync MASS and Export OA', () => {
      const tree = MainApp();
      
      // Find Sync MASS button
      const syncBtn = findElement(tree, (el) => el && el.type === 'button' && el.props && el.props.title?.includes('同步 MASS'));
      expect(syncBtn).toBeDefined();
      expect(syncBtn.props.onClick).toBe(mockState.syncMass);

      // Find Export OA button
      const exportBtn = findElement(tree, (el) => el && el.type === 'button' && el.props && el.props.title?.includes('导出有缺口'));
      expect(exportBtn).toBeDefined();
      expect(exportBtn.props.onClick).toBe(mockState.exportOa);
    });

    it('should correctly hook up chat input and handle text submission', () => {
      mockState.inputText = 'Test Chat Message';
      const tree = MainApp();

      // Find the input element
      const inputEl = findElement(tree, (el) => el && el.type === 'input' && el.props && el.props.placeholder?.includes('与 Agent 对话'));
      expect(inputEl).toBeDefined();
      expect(inputEl.props.value).toBe('Test Chat Message');

      // Test onChange handler
      inputEl.props.onChange({ target: { value: 'Updated Chat Message' } });
      expect(mockState.setInputText).toHaveBeenCalledWith('Updated Chat Message');

      // Find Send button by locating its wrapper
      const inputWrapper = findElement(tree, (el) => el && el.props && el.props.className === 'input-wrapper');
      expect(inputWrapper).toBeDefined();
      const sendBtn = findElement(inputWrapper, (el) => el && el.type === 'button');
      expect(sendBtn).toBeDefined();

      // Trigger onClick on the send button
      sendBtn.props.onClick();
      expect(mockState.sendMessage).toHaveBeenCalled();

      // Trigger onKeyDown (Enter key) on input
      mockState.sendMessage.mockClear();
      inputEl.props.onKeyDown({ key: 'Enter' });
      expect(mockState.sendMessage).toHaveBeenCalled();

      // Trigger onKeyDown (non-Enter key) on input - should not submit
      mockState.sendMessage.mockClear();
      inputEl.props.onKeyDown({ key: 'Escape' });
      expect(mockState.sendMessage).not.toHaveBeenCalled();
    });

    it('should not submit chat message if input text is empty or whitespace', () => {
      mockState.inputText = '   ';
      const tree = MainApp();

      const inputWrapper = findElement(tree, (el) => el && el.props && el.props.className === 'input-wrapper');
      const sendBtn = findElement(inputWrapper, (el) => el && el.type === 'button');
      sendBtn.props.onClick();
      expect(mockState.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('2. Clipboard Actions (Email Drafts & Project ID)', () => {
    it('should copy project ID to clipboard and toggle copy feedback status', async () => {
      const tree = MainApp();
      const projectCopyBtn = findElement(tree, (el) => el && el.type === 'button' && el.props && el.props.title === '复制项目号');
      expect(projectCopyBtn).toBeDefined();

      // Trigger onClick
      await projectCopyBtn.props.onClick();

      // Verify navigator.clipboard was called with the project ID
      expect(mockClipboard.clipboardText).toBe('PRJ-TEST-123');

      // Verify state changes (copiedProject set to true)
      // copiedProject is the 2nd useState hook (copiedId is the 1st)
      expect((globalThis as any).states[1]).toBe(true);

      // Fast-forward timers by 2 seconds
      vi.advanceTimersByTime(2000);
      expect((globalThis as any).states[1]).toBe(false);
    });

    it('should copy email drafts from assistant messages and toggle copy feedback', async () => {
      const tree = MainApp();
      
      // Find email draft cards
      const draftCards = findAllElements(tree, (el) => el && el.type === 'div' && el.props && el.props.className === 'draft-card');
      expect(draftCards).toHaveLength(1);

      const copyDraftBtn = findElement(draftCards[0], (el) => el && el.type === 'button' && el.props && el.props.className === 'draft-btn');
      expect(copyDraftBtn).toBeDefined();

      // Trigger onClick
      await copyDraftBtn.props.onClick();

      // Verify draft content copied to clipboard
      expect(mockClipboard.clipboardText).toBe('Subject: 跟进 M-002\n\n请尽快交货。');

      // Verify copiedId state (1st useState hook) is set to index 1 (the message index)
      expect((globalThis as any).states[0]).toBe(1);

      // Fast-forward timers by 2 seconds
      vi.advanceTimersByTime(2000);
      expect((globalThis as any).states[0]).toBe(null);
    });
  });

  describe('3. Dynamic KPI Calculations & Display', () => {
    it('should display BOM Coverage % correctly', () => {
      const tree = MainApp();
      const coverageLabel = findElement(tree, (el) => el && el.type === 'span' && el.props && el.props.children === 'BOM 齐套率');
      expect(coverageLabel).toBeDefined();

      const kpiCard = findElement(tree, (el) => el && el.props && el.props.className === 'kpi-card');
      const coverageValue = findElement(kpiCard, (el) => el && el.type === 'span' && el.props && el.props.className === 'value');
      
      const childrenString = React.Children.toArray(coverageValue.props.children).join('');
      expect(childrenString).toBe('67%');
    });

    it('should display Buildable Machines correctly', () => {
      const tree = MainApp();
      const buildableLabel = findElement(tree, (el) => el && el.type === 'span' && el.props && el.props.children === '预计可装配台数');
      expect(buildableLabel).toBeDefined();

      const kpiCard = findElement(tree, (el) => el && el.props && el.props.className === 'kpi-card' && findElement(el, (child) => child && child.props && child.props.children === '预计可装配台数'));
      const buildableValue = findElement(kpiCard, (el) => el && el.type === 'span' && el.props && el.props.className === 'value');
      
      const childrenString = React.Children.toArray(buildableValue.props.children).join('');
      expect(childrenString).toContain('1 台');
    });

    it('should display Shortage Count correctly', () => {
      const tree = MainApp();
      const shortageLabel = findElement(tree, (el) => el && el.type === 'span' && el.props && el.props.children === '缺口款数');
      expect(shortageLabel).toBeDefined();

      const kpiCard = findElement(tree, (el) => el && el.props && el.props.className === 'kpi-card' && findElement(el, (child) => child && child.props && child.props.children === '缺口款数'));
      const shortageValue = findElement(kpiCard, (el) => el && el.props && el.props.className?.includes('value'));
      
      const childrenString = React.Children.toArray(shortageValue.props.children).filter(item => typeof item === 'string' || typeof item === 'number').join('');
      expect(childrenString).toContain('2 款');
    });
  });
});
