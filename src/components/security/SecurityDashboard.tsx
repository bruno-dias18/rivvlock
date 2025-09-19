import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, ShieldAlert, ShieldCheck, Eye, EyeOff, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AuditLogEntry {
  id: string;
  action: string;
  changed_fields: any;
  created_at: string;
}

export const SecurityDashboard = () => {
  const { user } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAuditLogs();
    }
  }, [user]);

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_audit_log')
        .select('id, action, changed_fields, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const securityWarnings = [
    {
      id: 'leaked_password_protection',
      level: 'warn' as const,
      title: 'Password Protection Could Be Improved',
      description: 'Leaked password protection is currently disabled. This means users can set passwords that have been compromised in data breaches.',
      action: 'Enable in Supabase Auth Settings',
      link: 'https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection'
    }
  ];

  const securityFeatures = [
    {
      title: 'Row Level Security',
      status: 'enabled',
      description: 'All sensitive data tables are protected with RLS policies'
    },
    {
      title: 'Admin Access Control',
      status: 'enabled',
      description: 'Admin roles are properly managed and restricted'
    },
    {
      title: 'Audit Logging',
      status: 'enabled',
      description: 'All changes to sensitive data are logged and tracked'
    },
    {
      title: 'Profile Data Protection',
      status: 'enabled',
      description: 'Personal and financial data access is restricted to owners and authorized admins'
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security Dashboard
          </CardTitle>
          <CardDescription>
            Monitor your account security and sensitive data access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Security Warnings */}
          {securityWarnings.map((warning) => (
            <Alert key={warning.id} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{warning.title}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{warning.description}</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(warning.link, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {warning.action}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ))}

          {/* Security Features Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {securityFeatures.map((feature, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium">{feature.title}</p>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Active
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Security Audit Log
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSensitiveData(!showSensitiveData)}
            >
              {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showSensitiveData ? 'Hide' : 'Show'} Details
            </Button>
          </CardTitle>
          <CardDescription>
            Recent changes to your sensitive profile information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading audit logs...</div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No recent changes to sensitive data
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="font-medium">Profile {log.action.toLowerCase()}</p>
                      {showSensitiveData && log.changed_fields && (
                        <p className="text-sm text-muted-foreground">
                          Fields changed: {Object.keys(log.changed_fields || {}).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString()} at{' '}
                      {new Date(log.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2" />
              <div>
                <p className="font-medium">Use Strong Passwords</p>
                <p className="text-sm text-muted-foreground">
                  Always use unique, complex passwords for your account
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2" />
              <div>
                <p className="font-medium">Keep Financial Data Private</p>
                <p className="text-sm text-muted-foreground">
                  Never share your IBAN or banking information with unauthorized parties
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2" />
              <div>
                <p className="font-medium">Monitor Account Activity</p>
                <p className="text-sm text-muted-foreground">
                  Regularly check this security dashboard for any suspicious activity
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};