'use client';

/**
 * app/report-center/[module]/ModuleToolbar.tsx
 * Client component — wraps the ExportButtonGroup for use inside
 * a Server Component page.
 */

import ExportButtonGroup from '@modules/report-center/components/shared/ExportButtonGroup';
import type { ExportFormat } from '@modules/report-center/components/shared/ExportButtonGroup';

interface ModuleToolbarProps {
  totalRows: number;
}

function handleExport(format: ExportFormat) {
  // TODO: wire up real export logic (API call / file download)
}

export default function ModuleToolbar({ totalRows }: ModuleToolbarProps) {
  return (
    <ExportButtonGroup
      label="Export"
      size="sm"
      onExport={handleExport}
      rowCount={totalRows}
      showBadge
    />
  );
}
