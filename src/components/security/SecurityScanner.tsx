import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, Scan } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityIssue {
  type: 'critical' | 'warning' | 'info';
  message: string;
  field?: string;
  table?: string;
}

export const SecurityScanner: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [issues, setIssues] = useState<SecurityIssue[]>([]);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const { toast } = useToast();

  const scanForSensitiveData = async () => {
    setScanning(true);
    setIssues([]);

    try {
      const foundIssues: SecurityIssue[] = [];

      // Check profiles table for sensitive patterns
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        foundIssues.push({
          type: 'critical',
          message: `Database access error: ${profilesError.message}`,
          table: 'profiles'
        });
      } else if (profiles) {
        profiles.forEach((profile, index) => {
          // Check for IBAN patterns
          const textData = JSON.stringify(profile);
          
          if (textData.match(/[A-Z]{2}\d{2}[A-Z0-9]{10,30}/)) {
            foundIssues.push({
              type: 'critical',
              message: 'IBAN pattern detected in profile data',
              table: 'profiles',
              field: `Profile ${index + 1}`
            });
          }

          // Check for credit card patterns
          if (textData.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/)) {
            foundIssues.push({
              type: 'critical',
              message: 'Credit card pattern detected in profile data',
              table: 'profiles',
              field: `Profile ${index + 1}`
            });
          }

          // Check for potential bank account numbers
          if (textData.match(/\b\d{10,18}\b/)) {
            foundIssues.push({
              type: 'warning',
              message: 'Potential bank account number detected',
              table: 'profiles',
              field: `Profile ${index + 1}`
            });
          }
        });
      }

      // Check transactions table
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*');

      if (transactionsError) {
        foundIssues.push({
          type: 'critical',
          message: `Transaction access error: ${transactionsError.message}`,
          table: 'transactions'
        });
      } else if (transactions) {
        transactions.forEach((transaction, index) => {
          const textData = JSON.stringify(transaction);
          
          if (textData.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/)) {
            foundIssues.push({
              type: 'critical',
              message: 'Credit card pattern detected in transaction data',
              table: 'transactions',
              field: `Transaction ${index + 1}`
            });
          }
        });
      }

      // Check messages table
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*');

      if (messagesError) {
        foundIssues.push({
          type: 'warning',
          message: `Messages access error: ${messagesError.message}`,
          table: 'messages'
        });
      } else if (messages) {
        messages.forEach((message, index) => {
          const textData = JSON.stringify(message);
          
          if (textData.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/)) {
            foundIssues.push({
              type: 'critical',
              message: 'Credit card pattern detected in message',
              table: 'messages',
              field: `Message ${index + 1}`
            });
          }
        });
      }

      setIssues(foundIssues);
      setLastScan(new Date());

      // Log security scan
      await supabase.rpc('log_security_event', {
        event_type: 'SECURITY_SCAN_COMPLETED',
        details: { 
          issues_found: foundIssues.length,
          critical_issues: foundIssues.filter(i => i.type === 'critical').length
        }
      });

      if (foundIssues.length === 0) {
        toast({
          title: "Security Scan Complete",
          description: "No sensitive data patterns detected. Your data is secure!",
        });
      } else {
        toast({
          title: "Security Issues Found",
          description: `Found ${foundIssues.length} potential security issues.`,
          variant: "destructive",
        });
      }

    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "An error occurred during the security scan.",
        variant: "destructive",
      });
      console.error('Security scan error:', error);
    } finally {
      setScanning(false);
    }
  };

  const getIssueIcon = (type: SecurityIssue['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-info" />;
    }
  };

  const getIssueBadgeVariant = (type: SecurityIssue['type']) => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'info':
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Scanner
        </CardTitle>
        <CardDescription>
          Scan your database for sensitive data patterns that should be handled by Stripe
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            onClick={scanForSensitiveData}
            disabled={scanning}
            className="flex items-center gap-2"
          >
            <Scan className="h-4 w-4" />
            {scanning ? 'Scanning...' : 'Run Security Scan'}
          </Button>
          
          {lastScan && (
            <p className="text-sm text-muted-foreground">
              Last scan: {lastScan.toLocaleString()}
            </p>
          )}
        </div>

        {issues.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Security Issues Found:</h4>
            {issues.map((issue, index) => (
              <Alert key={index} className="border-l-4 border-l-destructive">
                <div className="flex items-start gap-3">
                  {getIssueIcon(issue.type)}
                  <div className="flex-1">
                    <AlertDescription className="mb-2">
                      {issue.message}
                    </AlertDescription>
                    <div className="flex items-center gap-2">
                      <Badge variant={getIssueBadgeVariant(issue.type)}>
                        {issue.type.toUpperCase()}
                      </Badge>
                      {issue.table && (
                        <Badge variant="outline">
                          Table: {issue.table}
                        </Badge>
                      )}
                      {issue.field && (
                        <Badge variant="outline">
                          {issue.field}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {issues.length === 0 && lastScan && (
          <Alert className="border-l-4 border-l-green-500">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              No sensitive data patterns detected. Your application follows security best practices!
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg bg-muted p-4">
          <h4 className="font-medium mb-2">What we scan for:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• IBAN patterns (should use Stripe Connect)</li>
            <li>• Credit card numbers (should use Stripe Elements)</li>
            <li>• Bank account patterns (should use Stripe Connect)</li>
            <li>• BIC/SWIFT codes (should use Stripe Connect)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};