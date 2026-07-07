import { create } from 'zustand';
import type { ExplorerNode, Client, Command, ModuleStatus, ClientGroup, QueryBatch, AuditLog, QueryTemplate } from '../types';

export interface Tab {
  id: string;
  label: string;
  nodeType: ExplorerNode['type'];
  nodeId: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface IfessStore {
  selectedNode: ExplorerNode | null;
  openTabs: Tab[];
  activeTabId: string | null;
  rightPanelCollapsed: boolean;
  bottomPanelHeight: number;
  leftPanelWidth: number;
  logs: LogEntry[];
  clients: Client[];
  commands: Command[];
  moduleStatuses: ModuleStatus[];
  groups: ClientGroup[];
  batches: QueryBatch[];
  auditLogs: AuditLog[];
  templates: QueryTemplate[];

  setSelectedNode: (node: ExplorerNode | null) => void;
  openTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  toggleRightPanel: () => void;
  setBottomPanelHeight: (height: number) => void;
  setLeftPanelWidth: (width: number) => void;
  log: (message: string, level?: LogEntry['level']) => void;
  clearLogs: () => void;
  setClients: (clients: Client[]) => void;
  setCommands: (commands: Command[]) => void;
  setModuleStatuses: (statuses: ModuleStatus[]) => void;
  setGroups: (groups: ClientGroup[]) => void;
  setBatches: (batches: QueryBatch[]) => void;
  setAuditLogs: (logs: AuditLog[]) => void;
  setTemplates: (templates: QueryTemplate[]) => void;
}

export const useIfessStore = create<IfessStore>((set, get) => ({
  selectedNode: null,
  openTabs: [],
  activeTabId: null,
  rightPanelCollapsed: false,
  bottomPanelHeight: 180,
  leftPanelWidth: 280,
  logs: [],
  clients: [],
  commands: [],
  moduleStatuses: [],
  groups: [],
  batches: [],
  auditLogs: [],
  templates: [],

  setSelectedNode: (node) => set({ selectedNode: node }),

  openTab: (tab) => {
    const existing = get().openTabs.find((t) => t.id === tab.id);
    if (!existing) {
      set({ openTabs: [...get().openTabs, tab] });
    }
    set({ activeTabId: tab.id });
  },

  closeTab: (tabId) => {
    const remaining = get().openTabs.filter((t) => t.id !== tabId);
    set({ openTabs: remaining });
    if (get().activeTabId === tabId && remaining.length > 0) {
      set({ activeTabId: remaining[remaining.length - 1].id });
    } else if (remaining.length === 0) {
      set({ activeTabId: null });
    }
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  toggleRightPanel: () => set({ rightPanelCollapsed: !get().rightPanelCollapsed }),

  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),

  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),

  log: (message, level = 'info') => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toLocaleTimeString('id-ID'),
      level,
      message,
    };
    set({ logs: [entry, ...get().logs].slice(0, 500) });
  },

  clearLogs: () => set({ logs: [] }),

  setClients: (clients) => set({ clients }),
  setCommands: (commands) => set({ commands }),
  setModuleStatuses: (statuses) => set({ moduleStatuses: statuses }),
  setGroups: (groups) => set({ groups }),
  setBatches: (batches) => set({ batches }),
  setAuditLogs: (logs) => set({ auditLogs: logs }),
  setTemplates: (templates) => set({ templates }),
}));
