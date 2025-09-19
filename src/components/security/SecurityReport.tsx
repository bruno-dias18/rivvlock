import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Shield, Eye, Lock, FileText } from "lucide-react";

export const SecurityReport = () => {
  const fixedIssues = [
    {
      title: "Customer Financial Data Protection",
      description: "Added proper admin access policies for profiles table with sensitive data (IBAN, Stripe IDs)",
      level: "error",
      status: "fixed"
    },
    {
      title: "Admin Role Security",
      description: "Improved admin role policies, removed hardcoded emails, enhanced access controls",
      level: "warn", 
      status: "fixed"
    },
    {
      title: "Audit Logging System",
      description: "Created comprehensive audit trail for all sensitive profile data changes",
      level: "info",
      status: "added"
    }
  ];

  const remainingIssues = [
    {
      title: "Leaked Password Protection",
      description: "Password security feature needs to be enabled in Supabase Auth settings",
      level: "warn",
      action: "Manual configuration required",
      link: "https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection"
    }
  ];

  const securityImprovements = [
    {
      icon: Shield,
      title: "Enhanced RLS Policies",
      description: "Added admin access controls for profile management and support"
    },
    {
      icon: Eye,
      title: "Audit Trail",
      description: "All changes to sensitive data (IBAN, phone, address) are now logged"
    },
    {
      icon: Lock,
      title: "Secure Admin Functions",
      description: "Removed email exposure from admin role checking functions"
    },
    {
      icon: FileText,
      title: "Data Access Logging",
      description: "Profile audit log tracks who changed what sensitive information"
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Security Fixes Applied
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fixedIssues.map((issue, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-green-900">{issue.title}</h4>
                  <Badge variant={issue.level === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                    {issue.level.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-green-700">{issue.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Manual Action Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {remainingIssues.map((issue, index) => (
            <Alert key={index} className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <strong className="text-orange-900">{issue.title}</strong>
                    <Badge variant="outline" className="text-orange-700 border-orange-300">
                      {issue.action}
                    </Badge>
                  </div>
                  <p className="text-orange-700">{issue.description}</p>
                  <a 
                    href={issue.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-orange-800 underline hover:text-orange-900"
                  >
                    View Configuration Guide →
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Improvements Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {securityImprovements.map((improvement, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <improvement.icon className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-slate-900 mb-1">{improvement.title}</h4>
                  <p className="text-sm text-slate-600">{improvement.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          <strong className="text-blue-900">Security Status:</strong> Your RIVVLOCK system now has enterprise-grade security for customer financial data. The profiles table is protected with proper admin access controls, comprehensive audit logging, and secure role-based permissions.
        </AlertDescription>
      </Alert>
    </div>
  );
};