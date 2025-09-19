import { Layout } from '@/components/layout/Layout';
import { SecurityDashboard } from '@/components/security/SecurityDashboard';

export const Security = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your account security settings
          </p>
        </div>
        
        <SecurityDashboard />
      </div>
    </Layout>
  );
};