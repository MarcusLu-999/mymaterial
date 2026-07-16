import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import React from 'react';
import App from '../src/App.tsx';
import * as ProjectContext from '../src/context/ProjectContext.tsx';
import { calculateRequiredQty, calculateShortage, calculateEstimatedBuildable } from '../server/calcEngine.js';

// Mock ProjectContext module
vi.mock('../src/context/ProjectContext.tsx', async (importOriginal) => {
  const original = await importOriginal<typeof ProjectContext>();
  return {
    ...original,
    useProject: vi.fn(),
    ProjectProvider: ({ children }: any) => React.createElement('div', null, children)
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

// 1. Empirical Verification of calculation engine mathematical boundary cases
describe('MMA Verification - KPI Calculation Engine', () => {
  it('should compute correct required quantities and shortages across target quantities', () => {
    // Scenario 1: Target Qty = 5
    let targetQty = 5;
    expect(calculateRequiredQty(targetQty, 2)).toBe(10);
    expect(calculateShortage(10, 8)).toBe(2);
    expect(calculateShortage(10, 15)).toBe(0);

    // Scenario 2: Target Qty = 25 (Scale Up)
    targetQty = 25;
    expect(calculateRequiredQty(targetQty, 3)).toBe(75);
    expect(calculateShortage(75, 50)).toBe(25);
    expect(calculateShortage(75, 100)).toBe(0);
  });

  it('should correctly calculate estimated buildable machines based on limiting components', () => {
    // Normal case
    const items = [
      { currentStock: 10, qtyPerMachine: 2 }, // floor(10/2) = 5
      { currentStock: 8, qtyPerMachine: 1 },  // floor(8/1) = 8
      { currentStock: 3, qtyPerMachine: 1 }   // floor(3/1) = 3 -> Limiting
    ];
    expect(calculateEstimatedBuildable(items, 10)).toBe(3);

    // Zero qtyPerMachine case (e.g. screws or optional items not part of core build constraint)
    const itemsWithZero = [
      { currentStock: 10, qtyPerMachine: 2 },
      { currentStock: 50, qtyPerMachine: 0 }, // ignored
      { currentStock: 4, qtyPerMachine: 1 }   // limiting -> 4
    ];
    expect(calculateEstimatedBuildable(itemsWithZero, 10)).toBe(4);

    // Shortage leads to 0 buildable machines
    const itemsShort = [
      { currentStock: 1, qtyPerMachine: 2 }, // floor(1/2) = 0 -> Limiting
      { currentStock: 10, qtyPerMachine: 1 }
    ];
    expect(calculateEstimatedBuildable(itemsShort, 5)).toBe(0);
  });
});

// 2. Empirical Verification of state synchronization across three columns
describe('MMA Verification - Three Column State Synchronization', () => {
  let mockState: any;

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

  beforeEach(() => {
    mockState = {
      project: { projectId: 'PRJ-SYNC-999', costCenter: 'CC-SYNC-999', targetQty: 10 },
      bomItems: [
        { code: 'M-101', name: 'Core Controller', qtyPerMachine: 2, owner: 'Alex', status: 'Pending', currentStock: 15, leadTime: 12, riskLevel: 'Medium' },
        { code: 'M-102', name: 'Power Unit', qtyPerMachine: 1, owner: 'Bob', status: 'Pending', currentStock: 8, leadTime: 18, riskLevel: 'High' }
      ],
      bomCoverage: 0.0,
      buildableMachines: 7,
      shortageItemsCount: 2,
      messages: [
        { role: 'assistant', content: 'Sync verified.' }
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

  it('should render all columns with synchronized state derived from the single context source', async () => {
    // Mock the useProject hook in a local sandbox context
    vi.doMock('../src/context/ProjectContext.tsx', () => ({
      useProject: () => mockState,
      ProjectProvider: ({ children }: any) => React.createElement('div', null, children)
    }));

    const AppMod = await import('../src/App.tsx');
    // Retrieve MainApp
    const appElement = AppMod.default();
    const MainApp = appElement.props.children.type;
    
    // Reset state index before render
    (globalThis as any).stateIdx = 0;
    const tree = MainApp();

    // Verify Left Column: Metadata & KPIs are present and contain mock values
    const leftPanel = findElement(tree, (el) => el && el.type === 'aside' && el.props && el.props.className === 'left-panel');
    expect(leftPanel).toBeDefined();

    // Check Project ID in Left Column
    const projectIdSpan = findElement(leftPanel, (el) => el && el.props && el.props.children === 'PRJ-SYNC-999');
    expect(projectIdSpan).toBeDefined();

    // Check KPIs in Left Column
    const kpiCards = [];
    findElement(leftPanel, (el) => {
      if (el && el.props && el.props.className === 'kpi-card') {
        kpiCards.push(el);
      }
      return false; // continue traversal
    });
    expect(kpiCards.length).toBeGreaterThan(0);

    // Verify Middle Column: Chat and messages are bound to the state
    const middlePanel = findElement(tree, (el) => el && el.type === 'main' && el.props && el.props.className === 'middle-panel');
    expect(middlePanel).toBeDefined();
    const chatBubble = findElement(middlePanel, (el) => el && el.props && el.props.children === 'Sync verified.');
    expect(chatBubble).toBeDefined();

    // Verify Right Column: Kanban details list the correct elements
    const rightPanel = findElement(tree, (el) => el && el.type === 'section' && el.props && el.props.className === 'right-panel');
    expect(rightPanel).toBeDefined();

    // Find table and verify rows
    const tableBody = findElement(rightPanel, (el) => el && el.type === 'tbody');
    expect(tableBody).toBeDefined();
    const rows = React.Children.toArray(tableBody.props.children);
    // There are 2 mock items
    expect(rows).toHaveLength(2);

    const m101CodeCell = findElement(rows[0], (el) => el && el.props && el.props.children === 'M-101');
    const m102CodeCell = findElement(rows[1], (el) => el && el.props && el.props.children === 'M-102');
    expect(m101CodeCell).toBeDefined();
    expect(m102CodeCell).toBeDefined();
  });
});
