import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { AdminProblematicTransactions } from '@/components/AdminProblematicTransactions';

export default function AdminProblematicTransactionsPage() {
  return (
    <DashboardLayoutWithSidebar>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transactions problématiques</h1>
          <p className="text-muted-foreground">Transactions nécessitant une attention</p>
        </div>
        <AdminProblematicTransactions />
      </div>
    </DashboardLayoutWithSidebar>
  );
}