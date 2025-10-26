import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { KycStatusRecord, KycDocument } from '@/types';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export const useKycStatus = (userId?: string) => {
  const queryClient = useQueryClient();

  const { data: kycStatus, isLoading } = useQuery({
    queryKey: ['kyc-status', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kyc_status')
        .select('*')
        .eq('user_id', userId || '')
        .single();

      if (error) throw error;
      return data as KycStatusRecord;
    },
    enabled: !!userId,
  });

  const { data: documents } = useQuery({
    queryKey: ['kyc-documents', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', userId || '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KycDocument[];
    },
    enabled: !!userId,
  });

  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      documentType,
    }: {
      file: File;
      documentType: string;
    }) => {
      if (!userId) throw new Error('User ID required');

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${documentType}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);

      // Insert document record
      const { error: insertError } = await supabase
        .from('kyc_documents')
        .insert({
          user_id: userId,
          document_type: documentType,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        });

      if (insertError) throw insertError;

      // Update KYC status to "in_review" if still pending
      if (kycStatus?.status === 'pending') {
        await supabase
          .from('kyc_status')
          .update({ status: 'in_review' })
          .eq('user_id', userId);
      }

      return { publicUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-documents', userId] });
      queryClient.invalidateQueries({ queryKey: ['kyc-status', userId] });
      toast.success('Document téléchargé avec succès');
    },
    onError: (error) => {
      logger.error('Failed to upload KYC document', error);
      toast.error('Erreur lors du téléchargement du document');
    },
  });

  return {
    kycStatus,
    documents,
    isLoading,
    uploadDocument,
  };
};
