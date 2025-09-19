import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SecurityFinding {
  id: string;
  name: string;
  level: 'error' | 'warn' | 'info';
  description: string;
  status: 'fixed' | 'requires_action' | 'pending';
  remediation?: string;
}

export const SecurityDashboard = () => {
  const { isAdmin } = useAuth();
  const [findings, setFindings] = useState<SecurityFinding[]>([
    {
      id: 'profiles_data_exposure',
      name: 'Customer Financial Data Protection',
      level: 'error',
      description: 'The profiles table contains sensitive financial data (IBAN, Stripe IDs) that needed proper access controls.',
      status: 'fixed',
      remediation: 'Added admin-only access policies, audit logging, and enhanced RLS protection for sensitive fields.'
    },
    {
      id: 'admin_email_exposure',
      name: 'Admin Identity Protection',
      level: 'warn',
      description: 'Admin email addresses were exposed in policies and could be harvested for targeted attacks.',
      status: 'fixed',
      remediation: 'Removed hardcoded emails from policies and implemented secure admin role checking.'
    },
    {
      id: 'payment_data_exposure',
      name: 'Payment Information Security',
      level: 'warn',
      description: 'Transaction table contains Stripe payment intent IDs that need additional safeguards.',
      status: 'fixed',
      remediation: 'Enhanced RLS policies with admin oversight and audit capabilities.'
    },
    {
      id: 'leaked_password_protection',
      name: 'Leaked Password Protection',
      level: 'warn',
      description: 'Password breach protection is currently disabled in Supabase Auth settings.',
      status: 'requires_action',
      remediation: 'Enable this setting in your Supabase dashboard under Authentication > Settings.'
    }
  ]);

  const getStatusColor = (status: SecurityFinding['status']) => {
    switch (status) {
      case 'fixed': return 'default';
      case 'requires_action': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'secondary';
    }
  };

  const getLevelColor = (level: SecurityFinding['level']) => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warn': return 'outline';
      case 'info': return 'secondary';
      default: return 'secondary';
    }
  };

  const fixedCount = findings.filter(f => f.status === 'fixed').length;
  const actionRequiredCount = findings.filter(f => f.status === 'requires_action').length;

  if (!isAdmin) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Security dashboard is only available to administrators.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold">Security Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{findings.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fixed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fixedCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Requires Action</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{actionRequiredCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security Improvements Implemented</CardTitle>
          <CardDescription>
            Recent security enhancements to protect customer data and system integrity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {findings.map((finding) => (
            <div key={finding.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {finding.status === 'fixed' ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  <h3 className="font-medium">{finding.name}</h3>
                </div>
                <div className="flex gap-2">
                  <Badge variant={getLevelColor(finding.level)}>
                    {finding.level.toUpperCase()}
                  </Badge>
                  <Badge variant={getStatusColor(finding.status)}>
                    {finding.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {finding.description}
              </p>
              
              {finding.remediation && (
                <div className="bg-muted p-3 rounded text-sm">
                  <strong>Resolution:</strong> {finding.remediation}
                </div>
              )}
              
              {finding.id === 'leaked_password_protection' && finding.status === 'requires_action' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open('https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Documentation
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Next Steps:</strong> To complete the security hardening, please enable "Leaked Password Protection" 
          in your Supabase dashboard under Authentication → Settings. This will prevent users from using passwords 
          that have been compromised in data breaches.
        </AlertDescription>
      </Alert>
    </div>
  );
};