import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';

export default function AdminSettingsPage() {
  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <div className="max-w-md">
          <label htmlFor="role" className="block text-sm mb-1">Rôle</label>
          <select id="role" disabled className="w-full border rounded px-2 py-2 bg-muted">
            <option>admin</option>
          </select>
        </div>
      </div>
    </DashboardLayoutWithSidebar>
  );
}