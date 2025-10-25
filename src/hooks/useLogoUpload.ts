import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';

interface UseLogoUploadReturn {
  uploadLogo: (file: File, userId: string) => Promise<string | null>;
  deleteLogo: (logoUrl: string, userId: string) => Promise<boolean>;
  isUploading: boolean;
}

export function useLogoUpload(): UseLogoUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadLogo = async (file: File, userId: string): Promise<string | null> => {
    try {
      setIsUploading(true);

      // Validation
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        toast.error(new Error("Fichier trop volumineux (max 2MB)"));
        return null;
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(new Error("Format non supporté. Formats acceptés : JPG, PNG, WEBP"));
        return null;
      }

      // Générer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/logo.${fileExt}`;

      // Upload vers Storage
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          upsert: true, // Remplacer si existe déjà
          cacheControl: '3600'
        });

      if (uploadError) {
        logger.error('Error uploading logo:', uploadError);
        throw uploadError;
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      // Mettre à jour le profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ company_logo_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) {
        logger.error('Error updating profile:', updateError);
        throw updateError;
      }

      toast.success("Logo mis à jour. Il apparaîtra sur vos factures");

      return publicUrl;
    } catch (error) {
      logger.error('Logo upload failed:', error);
      toast.error(error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteLogo = async (logoUrl: string, userId: string): Promise<boolean> => {
    try {
      setIsUploading(true);

      // Extraire le chemin du fichier depuis l'URL
      const urlParts = logoUrl.split('/company-logos/');
      if (urlParts.length < 2) {
        throw new Error('Invalid logo URL');
      }
      const filePath = urlParts[1];

      // Supprimer du Storage
      const { error: deleteError } = await supabase.storage
        .from('company-logos')
        .remove([filePath]);

      if (deleteError) {
        logger.error('Error deleting logo:', deleteError);
        throw deleteError;
      }

      // Mettre à jour le profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ company_logo_url: null })
        .eq('user_id', userId);

      if (updateError) {
        logger.error('Error updating profile:', updateError);
        throw updateError;
      }

      toast.success("Logo supprimé. Le logo par défaut sera utilisé");

      return true;
    } catch (error) {
      logger.error('Logo deletion failed:', error);
      toast.error(error);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadLogo,
    deleteLogo,
    isUploading
  };
}
