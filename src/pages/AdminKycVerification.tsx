import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, FileText, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { KycStatusRecord, KycDocument } from '@/types';

export default function AdminKycVerification() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

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
      setReviewNotes('');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success">Approuvé</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeté</Badge>;
      case 'in_review':
        return <Badge className="bg-warning">En cours</Badge>;
      case 'additional_info_required':
        return <Badge variant="outline">Info requise</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const pendingCount = kycStatuses?.filter(k => k.status === 'pending' || k.status === 'in_review').length || 0;

  return (
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
              .map((kycStatus) => {
                const profile = kycStatus.profiles as any;
                const displayName = profile?.company_name || 
                  `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                  'Utilisateur sans nom';

                return (
                  <Card key={kycStatus.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{displayName}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {profile?.user_type} • {profile?.country}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(kycStatus.status)}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUser(kycStatus.user_id)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Examiner
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Vérification KYC - {displayName}</DialogTitle>
                              </DialogHeader>

                              <div className="space-y-6">
                                {/* Documents */}
                                <div>
                                  <h3 className="font-semibold mb-3">Documents téléchargés</h3>
                                  <div className="space-y-2">
                                    {documents?.map((doc) => (
                                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                          <FileText className="h-5 w-5" />
                                          <div>
                                            <p className="font-medium">{doc.document_type}</p>
                                            <p className="text-sm text-muted-foreground">
                                              {doc.file_name} • {new Date(doc.created_at).toLocaleDateString()}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {doc.verified ? (
                                            <Badge className="bg-success">
                                              <CheckCircle className="h-3 w-3 mr-1" /> Vérifié
                                            </Badge>
                                          ) : (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => verifyDocument.mutate({ documentId: doc.id, verified: true })}
                                            >
                                              <CheckCircle className="h-4 w-4 mr-2" />
                                              Valider
                                            </Button>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => window.open(doc.file_url, '_blank')}
                                          >
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Notes */}
                                <div>
                                  <label className="font-semibold block mb-2">Notes internes</label>
                                  <Textarea
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    placeholder="Ajouter des notes sur cette vérification..."
                                    rows={3}
                                  />
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 justify-end pt-4 border-t">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      updateStatus.mutate({
                                        userId: kycStatus.user_id,
                                        status: 'additional_info_required',
                                        notes: reviewNotes,
                                      });
                                    }}
                                    disabled={updateStatus.isPending}
                                  >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Info supplémentaire
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => {
                                      if (!reviewNotes) {
                                        toast.error('Veuillez ajouter une raison de rejet');
                                        return;
                                      }
                                      updateStatus.mutate({
                                        userId: kycStatus.user_id,
                                        status: 'rejected',
                                        notes: reviewNotes,
                                      });
                                    }}
                                    disabled={updateStatus.isPending}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Rejeter
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      updateStatus.mutate({
                                        userId: kycStatus.user_id,
                                        status: 'approved',
                                        notes: reviewNotes,
                                      });
                                    }}
                                    disabled={updateStatus.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approuver
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Créé le {new Date(kycStatus.created_at).toLocaleDateString()}
                        {kycStatus.notes && (
                          <p className="mt-2 text-foreground">
                            <strong>Notes:</strong> {kycStatus.notes}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
