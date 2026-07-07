'use client';

import { useIfessStore } from '../stores/ifessStore';

export function PropertiesPanel() {
  const { selectedNode, rightPanelCollapsed, toggleRightPanel, moduleStatuses } = useIfessStore();

  return (
    <div
      className={`border-l border-[#3c3c3c] bg-[#252526] flex flex-col transition-all duration-200 ${
        rightPanelCollapsed ? 'w-8' : 'w-64'
      }`}
    >
      <button onClick={toggleRightPanel} className="self-end p-2 text-gray-500 hover:text-white">
        {rightPanelCollapsed ? '◀' : '▶'}
      </button>
      {!rightPanelCollapsed && (
        <div className="p-3 overflow-y-auto flex-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Properties</div>
          {!selectedNode && <div className="text-gray-500 text-[12px]">Select an object to view properties</div>}
          {selectedNode && (
            <div className="space-y-3">
              <Property label="Object Type" value={selectedNode.type} />
              <Property label="ID" value={selectedNode.id} />
              <Property label="Label" value={selectedNode.label} />
              {selectedNode.status && <Property label="Status" value={selectedNode.status} />}
              {selectedNode.type === 'client' && <ClientProperties clientId={selectedNode.id.replace('client-', '')} />}
              {selectedNode.type === 'command-status' && <CommandStatusProperties status={selectedNode.status || ''} />}
              {selectedNode.type === 'client-group' && <GroupProperties groupCode={selectedNode.id.replace('group-', '')} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#2d2d2d] rounded p-2">
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <div className="text-[12px] text-gray-200 break-all">{value}</div>
    </div>
  );
}

function ClientProperties({ clientId }: { clientId: string }) {
  const { clients, moduleStatuses } = useIfessStore();
  const client = clients.find((c) => c.clientId === clientId);
  const statuses = moduleStatuses.filter((m) => m.clientId === clientId);

  if (!client) return <div className="text-gray-500 text-[12px]">Client not found</div>;

  return (
    <>
      <Property label="Client Name" value={client.clientName} />
      <Property label="Machine" value={client.machineName || '-'} />
      <Property label="Environment" value={client.environment || '-'} />
      <Property label="OS" value={client.os || '-'} />
      <Property label="Modules" value={String(statuses.length)} />
    </>
  );
}

function CommandStatusProperties({ status }: { status: string }) {
  const { commands } = useIfessStore();
  const count = commands.filter((c) => c.status === status || (status === 'Running' && c.status === 'Executing') || (status === 'Success' && (c.status === 'Completed' || c.status === 'Success'))).length;
  return <Property label="Count" value={String(count)} />;
}

function GroupProperties({ groupCode }: { groupCode: string }) {
  const { groups } = useIfessStore();
  const group = groups.find((g) => g.groupCode === groupCode);
  if (!group) return <div className="text-gray-500 text-[12px]">Group not found</div>;
  return (
    <>
      <Property label="Code" value={group.groupCode} />
      <Property label="Name" value={group.groupName} />
      <Property label="Members" value={String((group.clients || []).length)} />
    </>
  );
}
