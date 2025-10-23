import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { useAdminUsers } from '@/hooks/useAdminUsers';

export default function AdminUsersPage() {
  const { data: users } = useAdminUsers(10);

  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <input
          placeholder="Rechercher un utilisateur"
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <div className="space-y-2">
          {(users || []).map((u) => (
            <div key={u.id} data-testid="user-row" className="p-3 border rounded">
              {u.seller_display_name || u.buyer_display_name || `User ${u.id.slice(0,8)}`}
            </div>
          ))}
          {!users && (
            <div data-testid="user-row" className="p-3 border rounded">User placeholder</div>
          )}
        </div>
      </div>
    </DashboardLayoutWithSidebar>
  );
}