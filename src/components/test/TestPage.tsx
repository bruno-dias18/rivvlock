import { Layout } from '@/components/layout/Layout';
import { TestRunner } from './TestRunner';
import { InvitationLinkTest } from './InvitationLinkTest';
import { StripeEscrowTest } from './StripeEscrowTest';
import { BugFixTest } from './BugFixTest';
import { ImplementationReport } from '../reports/ImplementationReport';
import { UserTestingGuide } from '../guides/UserTestingGuide';
import { SecurityReport } from '../security/SecurityReport';

export const TestPage = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Tests & Validation RIVVLOCK</h1>
          <p className="text-muted-foreground mt-1">
            Tests automatisés, guide utilisateur et rapport d'implémentation
          </p>
        </div>
        
        {/* User Testing Guide */}
        <UserTestingGuide />
        
        {/* Implementation Report */}
        <ImplementationReport />
        
        {/* Security Report */}
        <SecurityReport />
        
        {/* Automated Tests */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InvitationLinkTest />
          <StripeEscrowTest />
          <BugFixTest />
          <TestRunner />
        </div>
      </div>
    </Layout>
  );
};