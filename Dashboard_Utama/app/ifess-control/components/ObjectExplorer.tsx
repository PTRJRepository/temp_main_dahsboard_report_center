'use client';

import { useMemo } from 'react';
import { ChevronRight, ChevronDown, LayoutDashboard, Monitor, Server, Cpu, Command as CommandIcon, Database, Settings, FileText, Users, Activity } from 'lucide-react';
import { useIfessStore } from '../stores/ifessStore';
import type { Client, ExplorerNode } from '../types';

type TreeNode = {
  id: string;
  label: string;
  type: ExplorerNode['type'];
  icon: React.ReactNode;
  status?: string;
  children?: TreeNode[];
  data?: unknown;
};

export function ObjectExplorer() {
  const { clients, commands, groups, openTab, setSelectedNode, log } = useIfessStore();

  const onlineClients = clients.filter((c) => c.status === 'Online');
  const offlineClients = clients.filter((c) => c.status === 'Offline' || c.status === 'Error');

  const pendingCommands = commands.filter((c) => c.status === 'Pending');
  const runningCommands = commands.filter((c) => c.status === 'Running' || c.status === 'Executing');
  const failedCommands = commands.filter((c) => c.status === 'Failed');
  const successCommands = commands.filter((c) => c.status === 'Completed' || c.status === 'Success');

  const tree: TreeNode[] = useMemo(() => {
    return [
      {
        id: 'dashboard',
        label: 'Dashboard',
        type: 'dashboard',
        icon: <LayoutDashboard size={14} />,
      },
      {
        id: 'clients',
        label: 'Clients',
        type: 'clients',
        icon: <Monitor size={14} />,
        children: [
          {
            id: 'clients-online',
            label: `Online (${onlineClients.length})`,
            type: 'client-status',
            icon: <Activity size={14} />,
            status: 'Online',
            children: onlineClients.map((c) => clientNode(c)),
          },
          {
            id: 'clients-offline',
            label: `Offline/Error (${offlineClients.length})`,
            type: 'client-status',
            icon: <Activity size={14} />,
            status: 'Offline',
            children: offlineClients.map((c) => clientNode(c)),
          },
        ],
      },
      {
        id: 'client-groups',
        label: 'Client Groups',
        type: 'client-groups',
        icon: <Users size={14} />,
        children: groups.map((g) => ({
          id: `group-${g.groupCode}`,
          label: g.groupName,
          type: 'client-group',
          icon: <Users size={14} />,
          data: g,
        })),
      },
      {
        id: 'modules',
        label: 'Modules',
        type: 'modules',
        icon: <Cpu size={14} />,
      },
      {
        id: 'commands',
        label: 'Commands',
        type: 'commands',
        icon: <CommandIcon size={14} />,
        children: [
          { id: 'cmd-pending', label: `Pending (${pendingCommands.length})`, type: 'command-status', icon: <CommandIcon size={14} />, status: 'Pending' },
          { id: 'cmd-running', label: `Running (${runningCommands.length})`, type: 'command-status', icon: <CommandIcon size={14} />, status: 'Running' },
          { id: 'cmd-success', label: `Success (${successCommands.length})`, type: 'command-status', icon: <CommandIcon size={14} />, status: 'Success' },
          { id: 'cmd-failed', label: `Failed (${failedCommands.length})`, type: 'command-status', icon: <CommandIcon size={14} />, status: 'Failed' },
        ],
      },
      {
        id: 'query-gateway',
        label: 'Query Gateway',
        type: 'query-gateway',
        icon: <Database size={14} />,
        children: [
          { id: 'query-editor', label: 'Query Editor', type: 'query-editor', icon: <FileText size={14} /> },
          { id: 'query-templates', label: 'Query Templates', type: 'query-templates', icon: <FileText size={14} /> },
          { id: 'query-history', label: 'Query History', type: 'query-history', icon: <FileText size={14} /> },
        ],
      },
      {
        id: 'configuration',
        label: 'Configuration',
        type: 'configuration',
        icon: <Settings size={14} />,
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        type: 'audit-logs',
        icon: <FileText size={14} />,
      },
    ];
  }, [clients, groups, commands, onlineClients.length, offlineClients.length, pendingCommands.length, runningCommands.length, failedCommands.length, successCommands.length]);

  function clientNode(client: Client): TreeNode {
    return {
      id: `client-${client.clientId}`,
      label: client.clientName,
      type: 'client',
      icon: <Server size={14} />,
      status: client.status,
      data: client,
    };
  }

  const handleSelect = (node: TreeNode) => {
    const explorerNode: ExplorerNode = {
      id: node.id,
      type: node.type,
      label: node.label,
      status: node.status,
      data: node.data,
    };
    setSelectedNode(explorerNode);
    openTab({
      id: node.id,
      label: node.label,
      nodeType: node.type,
      nodeId: node.id,
    });
    log(`Opened ${node.label}`, 'info');
  };

  return (
    <div className="w-72 bg-[#252526] border-r border-[#3c3c3c] flex flex-col shrink-0">
      <div className="px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#3c3c3c]">Object Explorer</div>
      <div className="flex-1 overflow-y-auto p-2">
        {tree.map((node) => (
          <TreeItem key={node.id} node={node} level={0} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}

function TreeItem({
  node,
  level,
  onSelect,
}: {
  node: TreeNode;
  level: number;
  onSelect: (node: TreeNode) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => onSelect(node)}
        className="w-full text-left px-2 py-1.5 text-[12px] text-gray-300 hover:bg-[#094771] hover:text-white rounded flex items-center gap-1.5"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <span className="text-gray-500">{hasChildren ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span className="text-gray-400">{node.icon}</span>
        <span className="truncate">{node.label}</span>
        {node.status && <StatusBadge status={node.status} />}
      </button>
      {hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} level={level + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Online: 'bg-emerald-500',
    Running: 'bg-emerald-500',
    Success: 'bg-emerald-500',
    Offline: 'bg-gray-500',
    Stopped: 'bg-gray-500',
    Error: 'bg-red-500',
    Failed: 'bg-red-500',
    Pending: 'bg-yellow-500',
    Executing: 'bg-blue-500',
    Completed: 'bg-emerald-500',
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'}`} />;
}
