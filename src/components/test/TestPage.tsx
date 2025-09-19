import { Layout } from '@/components/layout/Layout';
import { TestRunner } from './TestRunner';
import { InvitationLinkTest } from './InvitationLinkTest';

export const TestPage = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Tests RIVVLOCK</h1>
          <p className="text-muted-foreground mt-1">
            Tests automatisés pour valider les fonctionnalités
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InvitationLinkTest />
          <TestRunner />
        </div>
      </div>
    </Layout>
  );
};