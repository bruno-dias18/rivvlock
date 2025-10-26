import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { KycStatusRecord, KycDocument } from '@/types';
import { KycStatusCard } from '@/components/kyc/KycStatusCard';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';

export default function AdminKycVerification() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Fetch all KYC statuses
  const { data: kycStatuses } = useQuery({
    queryKey: ['admin-kyc-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kyc_status')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            company_name,
            user_type,
            country
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (KycStatusRecord & { profiles: any })[];
    },
  });

  // Fetch documents for selected user
  const { data: documents } = useQuery({
    queryKey: ['admin-kyc-documents', selectedUser],
    queryFn: async () => {
      if (!selectedUser) return [];
      
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', selectedUser)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KycDocument[];
    },
    enabled: !!selectedUser,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ 
      userId, 
      status, 
      notes 
    }: { 
      userId: string; 
      status: string; 
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('kyc_status')
        .update({
          status,
          notes,
          verified_at: status === 'approved' ? new Date().toISOString() : null,
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-statuses'] });
      toast.success('Statut mis à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const verifyDocument = useMutation({
    mutationFn: async ({ documentId, verified }: { documentId: string; verified: boolean }) => {
      const { error } = await supabase
        .from('kyc_documents')
        .update({
          verified,
          verified_at: verified ? new Date().toISOString() : null,
        })
        .eq('id', documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-documents'] });
      toast.success('Document vérifié');
    },
  });

  const pendingCount = kycStatuses?.filter(k => k.status === 'pending' || k.status === 'in_review').length || 0;

  return (
    <DashboardLayoutWithSidebar>
      <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Vérification KYC</h1>
        <p className="text-muted-foreground">
          {pendingCount} demande(s) en attente de vérification
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">
            En attente ({kycStatuses?.filter(k => k.status === 'pending' || k.status === 'in_review').length || 0})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approuvés ({kycStatuses?.filter(k => k.status === 'approved').length || 0})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejetés ({kycStatuses?.filter(k => k.status === 'rejected').length || 0})
          </TabsTrigger>
        </TabsList>

        {['pending', 'approved', 'rejected'].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {kycStatuses
              ?.filter(k => {
                if (tab === 'pending') return k.status === 'pending' || k.status === 'in_review';
                return k.status === tab;
              })
              .map((kycStatus) => (
                <KycStatusCard
                  key={kycStatus.id}
                  kycStatus={kycStatus}
                  documents={selectedUser === kycStatus.user_id ? documents : undefined}
                  verifyDocument={verifyDocument}
                  updateStatus={updateStatus}
                  onSelectUser={setSelectedUser}
                />
              ))}
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </DashboardLayoutWithSidebar>
  );
}
