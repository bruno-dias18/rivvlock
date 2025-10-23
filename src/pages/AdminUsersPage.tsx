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
          {(users || []).map((u) => {
            const displayName = u.company_name || 
                               (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : null) ||
                               `User ${u.user_id.slice(0,8)}`;
            return (
              <div key={u.id} data-testid="user-row" className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{displayName}</div>
                  <div className="text-sm text-muted-foreground">{u.user_type} • {u.country}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            );
          })}
          {!users && (
            <div data-testid="user-row" className="p-3 border rounded">User placeholder</div>
          )}
        </div>
      </div>
    </DashboardLayoutWithSidebar>
  );
}