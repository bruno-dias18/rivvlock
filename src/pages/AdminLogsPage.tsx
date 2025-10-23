import { useState } from 'react';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { Button } from '@/components/ui/button';

export default function AdminLogsPage() {
  const [showExport, setShowExport] = useState(false);

  const handleDownload = () => {
    const blob = new Blob(["type,message\ninfo,example"], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'activity-logs.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Logs d'activité</h1>
        <div className="flex items-end gap-4">
          <div className="flex flex-col">
            <label htmlFor="type" className="text-sm">Type d'activité</label>
            <select id="type" className="border rounded px-2 py-1">
              <option value="all">All</option>
              <option value="payment">payment</option>
            </select>
          </div>
          <Button>Filtrer</Button>
          <Button onClick={() => setShowExport(v => !v)}>Exporter</Button>
          {showExport && (
            <Button onClick={handleDownload}>Télécharger CSV</Button>
          )}
        </div>
        <div role="table" className="border rounded p-4">
          <div role="row" className="flex justify-between text-sm text-muted-foreground">
            <div role="cell">time</div>
            <div role="cell">type</div>
            <div role="cell">message</div>
          </div>
        </div>
      </div>
    </DashboardLayoutWithSidebar>
  );
}